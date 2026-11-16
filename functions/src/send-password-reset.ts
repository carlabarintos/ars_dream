import { createHash } from 'node:crypto'

import { logger } from 'firebase-functions'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { EMAIL_PATTERN } from './create-user.js'
import { appResetLink, renderEmailHtml } from './email-template.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const COOLDOWN_MS = 60_000

/**
 * Sends the password reset link through Resend (our verified domain) instead of Firebase's own
 * mailer, whose noreply@<project>.firebaseapp.com sender wasn't reaching inboxes. Public: always
 * returns success so the form can't be used to probe which emails have accounts.
 */
export const sendPasswordReset = onCall<{ email: string }>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<{ email: string }>) => {
    const email = String(request.data.email ?? '').trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email.')

    // One email per address per minute, so the endpoint can't be used to flood someone's inbox.
    const limitRef = db.collection('passwordResetRateLimits').doc(createHash('sha256').update(email).digest('hex'))
    const allowed = await db.runTransaction(async (tx) => {
      const now = Date.now()
      const last = (await tx.get(limitRef)).data()?.sentAt as number | undefined
      if (last && now - last < COOLDOWN_MS) return false
      tx.set(limitRef, { sentAt: now })
      return true
    })
    if (!allowed) return { ok: true }

    const link = await auth.generatePasswordResetLink(email).catch((error) => {
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/email-not-found') return null
      logger.error('generatePasswordResetLink failed', { code: error?.code, message: error?.message })
      throw error
    })
    if (!link) return { ok: true }

    await sendEmail({
      to: email,
      subject: 'Reset your ARS Dream password',
      html: renderEmailHtml({
        title: 'Reset your password',
        body: "We received a request to reset your ARS Dream password. If it wasn't you, you can ignore this email.",
        ctaLabel: 'Reset My Password',
        ctaUrl: appResetLink(link),
      }),
    })
    return { ok: true }
  }),
)
