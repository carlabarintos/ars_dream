import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { requireAdmin } from './require-admin.js'
import { withSentry } from './sentry.js'

const PIPELINE_STATUSES = ['accepted', 'terms_accepted', 'payment_submitted', 'deposit_paid', 'final_invoiced', 'confirmed']

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

interface AcceptRegistrationInput {
  registrationId: string
  decision: 'accepted' | 'rejected'
  /** The offer image the admin previewed/attached in OfferChatDialog, if any — snapshotted onto the registration so onRegistrationStatusChange can include it in the acceptance email. */
  offerImageUrl?: string
  /** Required when accepting: the marathon packages the registrant may choose from when they accept the offer. */
  offeredPackageIds?: string[]
}

export const acceptRegistration = onCall<AcceptRegistrationInput>(
  { enforceAppCheck },
  withSentry(async (request: CallableRequest<AcceptRegistrationInput>) => {
    const uid = await requireAdmin(request)
    const { registrationId, decision, offerImageUrl, offeredPackageIds } = request.data

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
      await logAuditEntry({
        actorId: uid,
        action: 'registration_rejected',
        targetType: 'registration',
        targetId: registrationId,
        metadata: { marathonId: registration.marathonId as string, userId: registration.userId as string },
      })
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
      const marathonPackageIds = new Set(
        ((marathonSnap.data()!.packages as { id: string }[] | undefined) ?? []).map((p) => p.id),
      )
      if (!offeredPackageIds?.length || !offeredPackageIds.every((id) => marathonPackageIds.has(id))) {
        throw new HttpsError('invalid-argument', "Offer at least one of this marathon's packages.")
      }
      const capacity = marathonSnap.data()!.capacity as number | null
      // null = capacity not set yet: the waitlist can fill, but no offers until it's set.
      if (!capacity) {
        throw new HttpsError('failed-precondition', "Set this marathon's capacity before sending offers.")
      }
      const cycle = (registration.cycle as number | undefined) ?? 1

      // Fetched and filtered in-app rather than a .count() aggregation so a
      // registration from a previous cycle (never resolved before the
      // marathon was reopened) can't inflate the current round's count —
      // Firestore can't express "cycle == 1 or missing" as a single filter.
      const pipelineSnap = await transaction.get(
        db
          .collection('registrations')
          .where('marathonId', '==', registration.marathonId)
          .where('status', 'in', PIPELINE_STATUSES),
      )
      const pipelineCount = pipelineSnap.docs.filter(
        (doc) => ((doc.data().cycle as number | undefined) ?? 1) === cycle,
      ).length

      if (pipelineCount >= capacity) {
        throw new HttpsError('resource-exhausted', 'This marathon has no remaining capacity.')
      }

      transaction.update(registrationRef, {
        status: 'accepted',
        offeredPackageIds,
        offeredAt: new Date(),
        updatedAt: new Date(),
        // A re-registered doc may still carry a flag from an earlier overdue offer.
        overdueStatus: FieldValue.delete(),
        overdueAt: FieldValue.delete(),
        dueExtension: FieldValue.delete(),
        ...(offerImageUrl ? { offerImageUrl } : {}),
      })
    })

    await logAuditEntry({
      actorId: uid,
      action: 'registration_accepted',
      targetType: 'registration',
      targetId: registrationId,
      metadata: { marathonId: registration.marathonId as string, userId: registration.userId as string },
    })

    return { status: 'accepted' }
  }),
)
