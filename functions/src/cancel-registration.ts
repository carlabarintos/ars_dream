import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { notifyUser } from './notify-user.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey } from './send-email.js'
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
  'deposit_paid',
  'final_invoiced',
  'confirmed',
]

interface CancelRegistrationInput {
  registrationId: string
}

export const cancelRegistration = onCall<CancelRegistrationInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<CancelRegistrationInput>) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }
    const { registrationId } = request.data
    let cancelledByAdmin = false
    let registration: FirebaseFirestore.DocumentData = {}

    await db.runTransaction(async (transaction) => {
      const registrationRef = db.collection('registrations').doc(registrationId)
      const registrationSnap = await transaction.get(registrationRef)
      if (!registrationSnap.exists) {
        throw new HttpsError('not-found', 'Registration not found.')
      }
      registration = registrationSnap.data()!
      // Admins may cancel anyone's registration, e.g. one flagged overdue by
      // flagOverdueRegistrations.
      if (registration.userId !== uid) {
        await requireAdmin(request)
        cancelledByAdmin = true
      }
      if (!CANCELLABLE_STATUSES.includes(registration.status)) {
        throw new HttpsError('failed-precondition', 'This registration can no longer be cancelled.')
      }

      transaction.update(registrationRef, {
        status: 'cancelled',
        cancelledAt: new Date(),
        // Read by the booking history entry (booking-event.ts) to say who cancelled.
        cancelledBy: registration.userId === uid ? 'user' : 'admin',
        updatedAt: new Date(),
      })

      // depositPaidAt marks a seat counted at deposit approval; plain 'confirmed' covers bookings confirmed before that step existed.
      if (registration.status === 'confirmed' || registration.depositPaidAt) {
        const marathonRef = db.collection('marathons').doc(registration.marathonId)
        transaction.update(marathonRef, { confirmedCount: FieldValue.increment(-1) })
      }
    })

    if (cancelledByAdmin) {
      await logAuditEntry({
        actorId: uid,
        action: 'registration_cancelled',
        targetType: 'registration',
        targetId: registrationId,
        metadata: { marathonId: registration.marathonId as string, userId: registration.userId as string },
      })
      const body = 'Your registration was cancelled by ARS Dream. Message us if you think this is a mistake.'
      await notifyUser({
        userId: registration.userId,
        pushTitle: 'Registration cancelled',
        pushBody: body,
        emailSubject: 'Registration cancelled',
        emailBody: body,
      })
    }

    return { status: 'cancelled' }
  }),
)
