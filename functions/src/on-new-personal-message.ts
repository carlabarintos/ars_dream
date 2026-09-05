import { onDocumentCreated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { sendAndPruneTokens } from './notify.js'
import { withSentry } from './sentry.js'

export const onNewPersonalMessage = onDocumentCreated(
  { document: 'personalThreads/{userId}/messages/{messageId}' },
  withSentry(async (event) => {
    const message = event.data?.data()
    const userId = event.params.userId
    if (!message) return

    if (message.senderRole === 'user') {
      const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get()
      const tokensByOwner = adminsSnapshot.docs.map((adminDoc) => ({
        ref: adminDoc.ref,
        tokens: (adminDoc.data().fcmTokens ?? []) as string[],
      }))
      await sendAndPruneTokens(
        tokensByOwner,
        { title: 'New support message', body: message.text },
        '/admin/messages',
      )
    } else {
      const userDoc = await db.collection('users').doc(userId).get()
      const tokens: string[] = userDoc.data()?.fcmTokens ?? []
      await sendAndPruneTokens(
        [{ ref: userDoc.ref, tokens }],
        { title: 'New message from our team', body: message.text },
        '/messages',
      )
    }
  }),
)
