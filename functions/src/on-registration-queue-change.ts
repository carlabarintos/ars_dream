import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { notifyAdmins } from './notify.js'
import { withSentry } from './sentry.js'

const REGISTRANT_STATUSES = ['queued', 'terms_accepted', 'payment_submitted', 'cancelled']

const ADMIN_PUSH_TITLES: Record<string, string> = {
  terms_accepted: 'Offer accepted',
  payment_submitted: 'Payment proof to review',
}

/** A slot transfer lands on these statuses too, but that's an admin's own action. */
async function pushAdmins(before: DocumentData | undefined, after: DocumentData) {
  const justTransferred = after.transferredFrom && !before?.transferredFrom
  const title = ADMIN_PUSH_TITLES[after.status]
  if (!title || justTransferred) return

  const [marathon, user] = await Promise.all([
    db.doc(`marathons/${after.marathonId}`).get(),
    db.doc(`users/${after.userId}`).get(),
  ])
  const profile = user.data()
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.displayName || profile?.email
  const page = after.status === 'payment_submitted' ? 'payments' : 'queue'
  await notifyAdmins(
    { title, body: [name, marathon.data()?.title].filter(Boolean).join(' · ') },
    `/admin/marathons/${after.marathonId}/${page}`,
  )
}

// Flags the marathon and pushes admins when a registrant moves their own booking.
export const onRegistrationQueueChange = onDocumentWritten(
  { document: 'registrations/{registrationId}' },
  withSentry(async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()

    // Flags the marathon on the admin dashboard. Only statuses the registrant
    // moves to themselves, so an admin's own actions don't flag it.
    if (after && before?.status !== after.status && REGISTRANT_STATUSES.includes(after.status) && !after.transferredTo) {
      // Best-effort: a missing marathon (deleted) must not block the admin push below.
      await db
        .doc(`marathons/${after.marathonId}`)
        .update({ lastActivityAt: FieldValue.serverTimestamp() })
        .catch(() => {})
      await pushAdmins(before, after).catch((error) => console.error('Admin push failed', error))
    }
  }),
)
