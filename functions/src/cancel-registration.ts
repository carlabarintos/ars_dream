import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { withSentry } from './sentry.js'

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// Every non-terminal status a registrant can still back out of themselves.
// Routed through this callable rather than a client-side rule (unlike the
// terms/payment self-updates in firestore.rules) because a 'confirmed'
// registration holds a counted seat in marathons.confirmedCount that must be
// released atomically with the status change — the same reason
// acceptRegistration/confirmPayment run server-side instead of client writes.
const CANCELLABLE_STATUSES = [
  'queued',
  'accepted',
  'terms_accepted',
  'payment_submitted',
  'payment_rejected',
  'confirmed',
]

interface CancelRegistrationInput {
  registrationId: string
}

export const cancelRegistration = onCall<CancelRegistrationInput>(
  { enforceAppCheck },
  withSentry(async (request: CallableRequest<CancelRegistrationInput>) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }
    const { registrationId } = request.data

    await db.runTransaction(async (transaction) => {
      const registrationRef = db.collection('registrations').doc(registrationId)
      const registrationSnap = await transaction.get(registrationRef)
      if (!registrationSnap.exists) {
        throw new HttpsError('not-found', 'Registration not found.')
      }
      const registration = registrationSnap.data()!
      if (registration.userId !== uid) {
        throw new HttpsError('permission-denied', 'You can only cancel your own registration.')
      }
      if (!CANCELLABLE_STATUSES.includes(registration.status)) {
        throw new HttpsError('failed-precondition', 'This registration can no longer be cancelled.')
      }

      transaction.update(registrationRef, {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })

      if (registration.status === 'confirmed') {
        const marathonRef = db.collection('marathons').doc(registration.marathonId)
        transaction.update(marathonRef, { confirmedCount: FieldValue.increment(-1) })
      }
    })

    return { status: 'cancelled' }
  }),
)
