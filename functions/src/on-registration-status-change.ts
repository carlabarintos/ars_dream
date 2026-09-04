import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { notifyUser } from './notify-user.js'
import { resendApiKey } from './send-email.js'

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

export const onRegistrationStatusChange = onDocumentUpdated(
  { document: 'registrations/{registrationId}', secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const copy = NOTIFICATION_COPY[after.status as string]
    if (!copy) return

    const [marathonDoc, settingsDoc] = await Promise.all([
      db.collection('marathons').doc(after.marathonId).get(),
      db.collection('settings').doc('notifications').get(),
    ])

    const marathonTitle: string | undefined = marathonDoc.data()?.title
    const ccEmails: string[] = settingsDoc.data()?.ccEmails ?? []
    const emailSubject = marathonTitle ? `${copy.title} — ${marathonTitle}` : copy.title
    const emailBody = marathonTitle
      ? `Your registration for the ${marathonTitle} tour: ${copy.body}`
      : copy.body
    const imageUrl: string | undefined = after.status === 'accepted' ? after.offerImageUrl : undefined

    await notifyUser({
      userId: after.userId,
      pushTitle: copy.title,
      pushBody: copy.body,
      emailSubject,
      emailBody,
      imageUrl,
      cc: ccEmails,
    })
  },
)
