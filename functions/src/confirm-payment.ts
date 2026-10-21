import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { requireAdmin } from './require-admin.js'
import { withSentry } from './sentry.js'

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

interface ConfirmPaymentInput {
  registrationId: string
  decision: 'confirmed' | 'rejected'
  adminNote?: string
}

export const confirmPayment = onCall<ConfirmPaymentInput>(
  { enforceAppCheck },
  withSentry(async (request: CallableRequest<ConfirmPaymentInput>) => {
    const uid = await requireAdmin(request)
    const { registrationId, decision, adminNote } = request.data
    let loggedTarget: { marathonId: string; userId: string } | undefined
    let approvedStatus = 'confirmed'

    await db.runTransaction(async (transaction) => {
      const registrationRef = db.collection('registrations').doc(registrationId)
      const registrationSnap = await transaction.get(registrationRef)
      if (!registrationSnap.exists) {
        throw new HttpsError('not-found', 'Registration not found.')
      }
      const registration = registrationSnap.data()!
      if (registration.status !== 'payment_submitted') {
        throw new HttpsError('failed-precondition', 'No payment proof awaiting review.')
      }
      loggedTarget = { marathonId: registration.marathonId as string, userId: registration.userId as string }
      // Balance proof against the final invoice — the seat was already counted when the deposit was approved.
      const isBalance = registration.finalInvoice != null

      if (decision === 'rejected') {
        transaction.update(registrationRef, {
          status: 'payment_rejected',
          adminNote: adminNote ?? null,
          updatedAt: new Date(),
        })
        return
      }

      if (isBalance) {
        transaction.update(registrationRef, { status: 'confirmed', adminNote: null, updatedAt: new Date() })
        return
      }
      approvedStatus = 'deposit_paid'

      const marathonRef = db.collection('marathons').doc(registration.marathonId)
      const marathonSnap = await transaction.get(marathonRef)
      if (!marathonSnap.exists) {
        throw new HttpsError('not-found', 'Marathon not found.')
      }
      const marathon = marathonSnap.data()!
      if (marathon.capacity == null) {
        throw new HttpsError('failed-precondition', "Set this marathon's capacity before approving deposits.")
      }
      if (marathon.confirmedCount >= marathon.capacity) {
        throw new HttpsError('resource-exhausted', 'This marathon has no remaining capacity.')
      }

      transaction.update(registrationRef, {
        status: 'deposit_paid',
        depositPaidAt: new Date(),
        depositProofUrls: registration.proofOfPaymentUrls ?? [],
        adminNote: null,
        updatedAt: new Date(),
      })
      transaction.update(marathonRef, { confirmedCount: FieldValue.increment(1) })
    })

    if (loggedTarget) {
      await logAuditEntry({
        actorId: uid,
        action: decision === 'confirmed' ? 'payment_confirmed' : 'payment_rejected',
        targetType: 'registration',
        targetId: registrationId,
        metadata: decision === 'rejected' && adminNote ? { ...loggedTarget, adminNote } : loggedTarget,
      })
    }

    return { status: decision === 'confirmed' ? approvedStatus : 'payment_rejected' }
  }),
)
