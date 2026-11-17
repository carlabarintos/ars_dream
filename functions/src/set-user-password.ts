import { randomInt } from 'node:crypto'

import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { requireAdmin } from './require-admin.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// No look-alike characters (0/O, 1/l/I), since the admin reads it out to the user.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/**
 * Admin gives a user a new, randomly generated password, for when the reset email isn't working
 * for them. It's returned once to the admin to pass on, never emailed or stored. Signs the user
 * out of their other sessions so the old password stops working everywhere.
 */
export const setUserPassword = onCall<{ uid: string }>(
  { enforceAppCheck },
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

    await logAuditEntry({ actorId, action: 'user_password_set', targetType: 'user', targetId: uid, targetLabel: user.email })
    return { password }
  }),
)
