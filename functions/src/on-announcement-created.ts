import { onDocumentCreated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { sendAndPruneTokens } from './notify.js'

export const onAnnouncementCreated = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const announcement = event.data?.data()
  if (!announcement) return

  const usersSnapshot = await db.collection('users').get()
  const tokensByOwner = usersSnapshot.docs.map((userDoc) => ({
    ref: userDoc.ref,
    tokens: (userDoc.data().fcmTokens ?? []) as string[],
  }))

  await sendAndPruneTokens(
    tokensByOwner,
    { title: announcement.title, body: announcement.body },
    '/messages',
  )
})
