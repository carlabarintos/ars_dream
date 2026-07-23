import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'

import { db, messaging } from './admin.js'

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
  'registrations/{registrationId}',
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const copy = NOTIFICATION_COPY[after.status as string]
    if (!copy) return

    const userDoc = await db.collection('users').doc(after.userId).get()
    const tokens: string[] = userDoc.data()?.fcmTokens ?? []
    if (tokens.length === 0) return

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
  },
)
