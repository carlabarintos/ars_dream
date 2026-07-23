import { onDocumentWritten } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'

// Keeps `queuePosition` on every queued registration in sync with its place
// in line (1 = next up), recomputed whenever a registration joins or leaves
// the 'queued' state for a marathon (new signup, admin accept/reject, or a
// queued registration being deleted).
export const onRegistrationQueueChange = onDocumentWritten(
  'registrations/{registrationId}',
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()

    const wasQueued = before?.status === 'queued'
    const isQueued = after?.status === 'queued'
    if (wasQueued === isQueued) return

    const marathonId = (after?.marathonId ?? before?.marathonId) as string | undefined
    if (!marathonId) return

    const queueSnap = await db
      .collection('registrations')
      .where('marathonId', '==', marathonId)
      .where('status', '==', 'queued')
      .orderBy('createdAt', 'asc')
      .get()

    const batch = db.batch()
    let pendingWrites = 0
    queueSnap.docs.forEach((doc, index) => {
      const position = index + 1
      if (doc.data().queuePosition !== position) {
        batch.update(doc.ref, { queuePosition: position })
        pendingWrites++
      }
    })

    if (pendingWrites > 0) {
      await batch.commit()
    }
  },
)
