import { FieldValue } from 'firebase-admin/firestore'

import { messaging } from './admin.js'

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
    webpush: { fcmOptions: { link } },
  })

  let cursor = 0
  for (const owner of tokensByOwner) {
    const staleTokens = owner.tokens.filter((_, i) => !response.responses[cursor + i]?.success)
    cursor += owner.tokens.length
    if (staleTokens.length > 0) {
      await owner.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
    }
  }
}
