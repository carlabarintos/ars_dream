import { FieldValue } from 'firebase-admin/firestore'

import { db, messaging } from './admin.js'
import { renderEmailHtml, sendEmail } from './send-email.js'

export const APP_URL = 'https://arsdreamsports.com'

/**
 * Best-effort push + email notification to one user, extracted from
 * onRegistrationStatusChange so reopenMarathon can reuse the same
 * fetch-tokens/send/prune-stale-tokens/send-email pattern.
 */
export async function notifyUser({
  userId,
  pushTitle,
  pushBody,
  emailSubject,
  emailBody,
  ctaLabel = 'Open ARS Dream',
  ctaUrl = APP_URL,
  imageUrl,
  cc,
}: {
  userId: string
  pushTitle: string
  pushBody: string
  emailSubject: string
  emailBody: string
  ctaLabel?: string
  ctaUrl?: string
  imageUrl?: string
  cc?: string[]
}): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get()

  const tokens: string[] = userDoc.data()?.fcmTokens ?? []
  if (tokens.length > 0) {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: pushTitle, body: pushBody },
      webpush: { fcmOptions: { link: '/' } },
    })

    const staleTokens = response.responses
      .map((result, index) => (result.success ? null : tokens[index]))
      .filter((token): token is string => token !== null)

    if (staleTokens.length > 0) {
      await userDoc.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
    }
  }

  const email: string | undefined = userDoc.data()?.email
  if (email) {
    await sendEmail({
      to: email,
      cc,
      subject: emailSubject,
      html: renderEmailHtml({ title: pushTitle, body: emailBody, ctaLabel, ctaUrl, imageUrl }),
    })
  }
}
