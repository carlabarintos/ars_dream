import { randomInt } from 'node:crypto'

import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { APP_URL, escapeHtml, renderEmailHtml } from './email-template.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// No look-alike characters (0/O, 1/l/I), since the admin reads it out to the user.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/**
 * Admin gives a user a new, randomly generated password, for when the reset email isn't working
 * for them. It's emailed to the user with a sign-in link (email prefilled) and also returned once to
 * the admin, in case the email doesn't arrive. Never stored. Signs the user out of their other
 * sessions so the old password stops working everywhere.
 */
export const setUserPassword = onCall<{ uid: string }>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<{ uid: string }>) => {
    const actorId = await requireAdmin(request)
    const uid = String(request.data.uid ?? '')
    if (!uid) throw new HttpsError('invalid-argument', 'Missing user.')
    const password = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

    const user = await auth.updateUser(uid, { password }).catch((error) => {
      if (error?.code === 'auth/user-not-found') throw new HttpsError('not-found', 'No account found for this user.')
      throw error
    })
    await auth.revokeRefreshTokens(uid)

    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: 'Your new ARS Dream password',
        html: renderEmailHtml({
          title: 'Your password has been reset',
          body: `ARS Dream has set a new password for your account (${escapeHtml(user.email)}):<br><br><strong style="font-family: monospace; font-size: 18px; letter-spacing: 1px;">${password}</strong><br><br>Use it to sign in. You can ask us to change it again any time.`,
          ctaLabel: 'Sign In',
          ctaUrl: `${APP_URL}/sign-in?email=${encodeURIComponent(user.email)}`,
        }),
      })
    }

    await logAuditEntry({ actorId, action: 'user_password_set', targetType: 'user', targetId: uid, targetLabel: user.email })
    return { password }
  }),
)
