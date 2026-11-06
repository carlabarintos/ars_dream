import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'

import { db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { logBookingEvent } from './booking-event.js'
import { bookingDeposit } from './email-template.js'
import { requireAdmin } from './require-admin.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// Owing a deposit, with their T&C accepted (that step is always their own) and no proof of their own under review.
const READY_STATUSES = ['terms_accepted', 'payment_rejected']
const ENDED_STATUSES = ['rejected', 'cancelled']

/**
 * One payment covering every runner on a package: the deposit already approved on one booking also settles the others'.
 * Works from any booking on the package, so it doesn't matter which runner paid. Each covered booking gets the same
 * proof and goes to deposit_paid, so onRegistrationStatusChange sends its receipt as usual. Runners who can't take it
 * yet come back as `waiting`, and the payment is marked `depositCoversPackage` so accepting their T&C settles them too
 * (`automatic`: that call, which only acts on such a payment and never refuses, so the invoice can go out instead).
 */
export async function applyDepositToPackage(registrationId: string, { automatic = false } = {}) {
  const registrations = db.collection('registrations')
  const booking = (await registrations.doc(registrationId).get()).data()
  if (!booking) throw new HttpsError('not-found', 'Registration not found.')
  const leadId: string = booking.partOf?.registrationId ?? registrationId
  const lead = leadId === registrationId ? booking : (await registrations.doc(leadId).get()).data()
  if (!lead) throw new HttpsError('not-found', 'Registration not found.')

  const runners = (await db.collection('runnerBookings').where('registrationId', '==', leadId).get()).docs.map((doc) => doc.data())
  const refs = [
    registrations.doc(leadId),
    ...runners.filter((r) => r.userId).map((r) => registrations.doc(`${r.userId}_${lead.marathonId}_${lead.cycle ?? 1}`)),
  ]
  const marathonRef = db.collection('marathons').doc(lead.marathonId)

  const { source, covered, waiting, marathon } = await db.runTransaction(async (transaction) => {
    const [marathonSnap, ...snaps] = await Promise.all([transaction.get(marathonRef), ...refs.map((ref) => transaction.get(ref))])
    const marathon = marathonSnap.data()
    const group = refs
      .map((ref, i) => ({ ref, data: snaps[i].data() }))
      .filter(({ ref, data }) => data && (ref.id === leadId || data.partOf?.registrationId === leadId))
      .map(({ ref, data }) => ({ ref, data: data! }))
      .filter(({ data }) => !ENDED_STATUSES.includes(data.status))

    const source = group.find(({ data }) => (automatic ? data.depositCoversPackage : data.depositPaidAt))
    if (!source) {
      if (automatic) return { covered: [], waiting: 0 }
      throw new HttpsError('failed-precondition', "Approve one runner's deposit first, then apply it to the others.")
    }
    const covered = group.filter(
      ({ data }) =>
        READY_STATUSES.includes(data.status) && data.transferTermsAcceptedAt !== null && !data.finalInvoice && !data.depositPaidAt,
    )
    const waiting = group.filter(({ data }) => !data.depositPaidAt).length - covered.length + runners.filter((r) => !r.userId).length

    // Usually a runner holds spare seats already, so these are taken over from that hold, not newly counted. With three or
    // more runners it needn't be the one who paid.
    let newSeats = covered.length
    const holds: { ref: FirebaseFirestore.DocumentReference; seatCount: number }[] = []
    for (const { ref, data } of group.filter(({ data }) => data.depositPaidAt)) {
      const held = (data.seatCount as number | undefined) ?? 1
      const given = Math.min(held - 1, newSeats)
      if (given > 0) holds.push({ ref, seatCount: held - given })
      newSeats -= given
    }
    if (marathon?.capacity && marathon.confirmedCount + newSeats > marathon.capacity) {
      if (automatic) return { covered: [], waiting: 0 }
      throw new HttpsError('resource-exhausted', 'This marathon has no remaining capacity.')
    }

    const { depositProofUrls, depositProofSubmittedAt, approvedPaymentReferences } = source.data
    for (const { ref, data } of covered) {
      const now = new Date()
      transaction.update(ref, {
        status: 'deposit_paid',
        depositPaidAt: now,
        depositPaidAmount: bookingDeposit(
          data as Parameters<typeof bookingDeposit>[0],
          (marathon?.packages as { id: string; depositAmount?: number }[] | undefined)?.find((p) => p.id === data.packageId),
        ),
        depositCoveredBy: source.ref.id,
        proofOfPaymentUrls: depositProofUrls ?? [],
        depositProofUrls: depositProofUrls ?? [],
        proofSubmittedAt: depositProofSubmittedAt ?? null,
        depositProofSubmittedAt: depositProofSubmittedAt ?? null,
        paymentReference: approvedPaymentReferences?.[0] ?? '',
        approvedPaymentReferences: [approvedPaymentReferences?.[0] ?? ''],
        adminNote: null,
        seatCount: 1,
        updatedAt: now,
      })
    }
    if (newSeats > 0) transaction.update(marathonRef, { confirmedCount: FieldValue.increment(newSeats) })
    for (const { ref, seatCount } of holds) transaction.update(ref, { seatCount })
    if (waiting > 0 && !automatic) transaction.update(source.ref, { depositCoversPackage: true })
    return { source, covered, waiting, marathon }
  })

  if (!source) return { covered: [], waiting, sourceId: '' }
  const payer = source.ref.id === leadId ? 'Runner 1' : `Runner ${source.data.partOf.runner}`
  await Promise.all(
    covered.map(({ ref, data }) => logBookingEvent(ref.id, data, `Deposit covered by ${payer}'s payment`, marathon?.title)),
  )
  return { covered: covered.map(({ ref }) => ref.id), waiting, sourceId: source.ref.id }
}

export const applySharedDeposit = onCall<{ registrationId: string }>(
  { enforceAppCheck },
  withSentry(async (request: CallableRequest<{ registrationId: string }>) => {
    const actorId = await requireAdmin(request)
    const { covered, waiting, sourceId } = await applyDepositToPackage(String(request.data.registrationId))
    await Promise.all(
      covered.map((targetId) =>
        logAuditEntry({
          actorId,
          action: 'payment_confirmed',
          targetType: 'registration',
          targetId,
          metadata: { coveredBy: sourceId },
        }),
      ),
    )
    return { covered: covered.length, waiting }
  }),
)
