import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'

import { db, messaging } from './admin.js'
import { renderEmailHtml, resendApiKey, sendEmail } from './send-email.js'

const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  accepted: {
    title: "You're accepted!",
    body: 'Open ARS Dream to accept the terms and submit your proof of payment.',
  },
  rejected: {
    title: 'Registration update',
    body: "You weren't accepted into this marathon's queue this time.",
  },
  confirmed: {
    title: "You're confirmed!",
    body: 'Your payment was verified — your spot is locked in.',
  },
  payment_rejected: {
    title: 'Proof of payment rejected',
    body: 'Please review the note and resubmit your proof of payment.',
  },
}

const APP_URL = 'https://arsdreamph.com'

export const onRegistrationStatusChange = onDocumentUpdated(
  { document: 'registrations/{registrationId}', secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const copy = NOTIFICATION_COPY[after.status as string]
    if (!copy) return

    const [userDoc, marathonDoc, settingsDoc] = await Promise.all([
      db.collection('users').doc(after.userId).get(),
      db.collection('marathons').doc(after.marathonId).get(),
      db.collection('settings').doc('notifications').get(),
    ])

    const tokens: string[] = userDoc.data()?.fcmTokens ?? []
    if (tokens.length > 0) {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: copy,
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
      const marathonTitle: string | undefined = marathonDoc.data()?.title
      const ccEmails: string[] = settingsDoc.data()?.ccEmails ?? []
      const subject = marathonTitle ? `${copy.title} — ${marathonTitle}` : copy.title
      const body = marathonTitle
        ? `Your registration for the ${marathonTitle} tour: ${copy.body}`
        : copy.body

      const imageUrl: string | undefined = after.status === 'accepted' ? after.offerImageUrl : undefined

      await sendEmail({
        to: email,
        cc: ccEmails,
        subject,
        html: renderEmailHtml({ title: copy.title, body, ctaLabel: 'Open ARS Dream', ctaUrl: APP_URL, imageUrl }),
      })
    }
  },
)
