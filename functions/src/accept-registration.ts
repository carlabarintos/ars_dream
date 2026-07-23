import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { requireAdmin } from './require-admin.js'

const PIPELINE_STATUSES = ['accepted', 'terms_accepted', 'payment_submitted', 'confirmed']

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

interface AcceptRegistrationInput {
  registrationId: string
  decision: 'accepted' | 'rejected'
}

export const acceptRegistration = onCall<AcceptRegistrationInput>(
  { enforceAppCheck },
  async (request: CallableRequest<AcceptRegistrationInput>) => {
    await requireAdmin(request)
    const { registrationId, decision } = request.data

    const registrationRef = db.collection('registrations').doc(registrationId)
    const registrationSnap = await registrationRef.get()
    if (!registrationSnap.exists) {
      throw new HttpsError('not-found', 'Registration not found.')
    }
    const registration = registrationSnap.data()!
    if (registration.status !== 'queued') {
      throw new HttpsError('failed-precondition', 'Registration is not in the queue.')
    }

    if (decision === 'rejected') {
      await registrationRef.update({ status: 'rejected', updatedAt: new Date() })
      return { status: 'rejected' }
    }

    const marathonRef = db.collection('marathons').doc(registration.marathonId)

    // Wrapped in a transaction so two concurrent accepts near capacity can't
    // both read the same pipeline count and both pass the capacity check.
    await db.runTransaction(async (transaction) => {
      const [marathonSnap, registrationSnap] = await Promise.all([
        transaction.get(marathonRef),
        transaction.get(registrationRef),
      ])
      if (!marathonSnap.exists) {
        throw new HttpsError('not-found', 'Marathon not found.')
      }
      if (registrationSnap.data()?.status !== 'queued') {
        throw new HttpsError('failed-precondition', 'Registration is not in the queue.')
      }
      const capacity = marathonSnap.data()!.capacity as number

      const pipelineCount = await transaction.get(
        db
          .collection('registrations')
          .where('marathonId', '==', registration.marathonId)
          .where('status', 'in', PIPELINE_STATUSES)
          .count(),
      )

      if (pipelineCount.data().count >= capacity) {
        throw new HttpsError('resource-exhausted', 'This marathon has no remaining capacity.')
      }

      transaction.update(registrationRef, { status: 'accepted', updatedAt: new Date() })
    })

    return { status: 'accepted' }
  },
)
