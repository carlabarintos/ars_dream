import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { APP_URL, escapeHtml, renderEmailHtml } from './email-template.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Admin creates an account from just an email. No password is set; the invite email carries a
 * password-reset link, so the person picks their own password on first visit. The profile doc is
 * written here (not left to first sign-in) so the account shows on the Users page right away, and
 * that write also fires claimPendingWaitlist for any earlier waitlist imports to this email.
 */
/** Creates the Auth account + profile and emails a set-your-password invite. Shared with transferRegistration. */
export async function createInvitedUser(email: string) {
  const user = await auth.createUser({ email }).catch((error) => {
    if (error?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.')
    }
    throw error
  })

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    displayName: null,
    email,
    photoURL: null,
    role: 'user',
    fcmTokens: [],
    createdAt: FieldValue.serverTimestamp(),
  })

  const link = await auth.generatePasswordResetLink(email, { url: `${APP_URL}/sign-in` })
  await sendEmail({
    to: email,
    subject: "You're invited to ARS Dream",
    html: renderEmailHtml({
      title: 'Your ARS Dream account is ready',
      body: `ARS Dream has created an account for you (${escapeHtml(email)}). Set your password to sign in and manage your marathon tour bookings.`,
      ctaLabel: 'Set My Password',
      ctaUrl: link,
    }),
  })
  return user
}

export const createUser = onCall<{ email: string }>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<{ email: string }>) => {
    const actorId = await requireAdmin(request)
    const email = String(request.data.email ?? '').trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email.')

    const user = await createInvitedUser(email)

    await logAuditEntry({ actorId, action: 'user_created', targetType: 'user', targetId: user.uid, targetLabel: email })
    return { uid: user.uid }
  }),
)
