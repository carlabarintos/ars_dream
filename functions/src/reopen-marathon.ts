import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { requireAdmin } from './require-admin.js'

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// A registration only ever reaches these statuses by joining the queue and
// never reaching a final outcome (confirmed, rejected, payment_rejected) —
// these are the ones that "didn't make it in time" and get a fresh queue
// spot in the new round. Confirmed/rejected/payment_rejected registrations
// are left exactly as they are, as history of the closed round.
const CARRY_FORWARD_STATUSES = ['queued', 'accepted', 'terms_accepted', 'payment_submitted']

const BATCH_LIMIT = 400

interface ReopenMarathonInput {
  marathonId: string
}

export const reopenMarathon = onCall<ReopenMarathonInput>(
  { enforceAppCheck },
  async (request: CallableRequest<ReopenMarathonInput>) => {
    await requireAdmin(request)
    const { marathonId } = request.data

    const marathonRef = db.collection('marathons').doc(marathonId)
    const marathonSnap = await marathonRef.get()
    if (!marathonSnap.exists) {
      throw new HttpsError('not-found', 'Marathon not found.')
    }
    const marathon = marathonSnap.data()!
    if (marathon.status !== 'closed') {
      throw new HttpsError('failed-precondition', 'Only a closed marathon can be reopened.')
    }

    const currentCycle = (marathon.cycle as number | undefined) ?? 1
    const newCycle = currentCycle + 1

    const candidatesSnap = await db
      .collection('registrations')
      .where('marathonId', '==', marathonId)
      .where('status', 'in', CARRY_FORWARD_STATUSES)
      .orderBy('createdAt', 'asc')
      .get()

    const carryForward = candidatesSnap.docs.filter(
      (doc) => ((doc.data().cycle as number | undefined) ?? 1) === currentCycle,
    )

    const now = Date.now()
    let batch = db.batch()
    let opsInBatch = 0
    const pendingCommits: Promise<unknown>[] = []

    async function flush() {
      if (opsInBatch === 0) return
      pendingCommits.push(batch.commit())
      batch = db.batch()
      opsInBatch = 0
    }

    for (const [index, doc] of carryForward.entries()) {
      const data = doc.data()
      // Deterministic id — see firestore.rules and features/registrations/api.ts
      // — so a subsequent joinQueue call for this user/marathon/cycle updates
      // this same carried-forward entry instead of creating a duplicate.
      const newRef = db.collection('registrations').doc(`${data.userId}_${marathonId}_${newCycle}`)
      batch.set(newRef, {
        userId: data.userId,
        marathonId,
        packageId: data.packageId,
        packageName: data.packageName,
        packagePriceAmount: data.packagePriceAmount,
        packagePriceCurrency: data.packagePriceCurrency,
        status: 'queued',
        queuePosition: index + 1,
        cycle: newCycle,
        termsAcceptedAt: null,
        proofOfPaymentUrls: [],
        proofSubmittedAt: null,
        adminNote: null,
        createdAt: new Date(now + index),
        updatedAt: new Date(now + index),
      })
      opsInBatch++
      if (opsInBatch >= BATCH_LIMIT) {
        await flush()
      }
    }
    await flush()
    await Promise.all(pendingCommits)

    await marathonRef.update({ cycle: newCycle, status: 'published', confirmedCount: 0 })

    return { newCycle, carriedForward: carryForward.length }
  },
)
