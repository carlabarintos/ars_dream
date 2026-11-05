import { FieldValue } from 'firebase-admin/firestore'

import { db, messaging } from './admin.js'
import { APP_URL } from './email-template.js'

// Only these mean the device is gone. Anything else (FCM outage, quota, bad payload) must keep the token.
const DEAD_TOKEN_ERRORS = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']

// ponytail: one multicast caps at 500 tokens, chunk allTokens if an announcement ever targets more devices.
export async function sendAndPruneTokens(
  tokensByOwner: { ref: FirebaseFirestore.DocumentReference; tokens: string[] }[],
  notification: { title: string; body: string },
  link: string,
) {
  const allTokens = tokensByOwner.flatMap((owner) => owner.tokens)
  if (allTokens.length === 0) return

  const response = await messaging.sendEachForMulticast({
    tokens: allTokens,
    notification,
    webpush: {
      notification: { icon: `${APP_URL}/pwa-192.png` },
      // FCM requires an absolute HTTPS link here.
      fcmOptions: { link: new URL(link, APP_URL).href },
    },
  })

  let cursor = 0
  for (const owner of tokensByOwner) {
    const staleTokens = owner.tokens.filter((_, i) =>
      DEAD_TOKEN_ERRORS.includes(response.responses[cursor + i]?.error?.code ?? ''),
    )
    cursor += owner.tokens.length
    if (staleTokens.length > 0) {
      await owner.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
    }
  }
}

export async function notifyAdmins(notification: { title: string; body: string }, link: string) {
  const admins = await db.collection('users').where('role', '==', 'admin').get()
  await sendAndPruneTokens(
    admins.docs.map((admin) => ({ ref: admin.ref, tokens: (admin.data().fcmTokens ?? []) as string[] })),
    notification,
    link,
  )
}
