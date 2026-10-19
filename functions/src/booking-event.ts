import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { withSentry } from './sentry.js'

const money = (registration: FirebaseFirestore.DocumentData, amount: number) =>
  `${registration.packagePriceCurrency} ${amount.toLocaleString()}`

/** One-line history entry for a status the registration just moved into; `reissued` = the final invoice was edited without a status change. */
export function describeStatusEvent(registration: FirebaseFirestore.DocumentData, reissued = false): string {
  const onFinalInvoice = registration.finalInvoice != null
  switch (registration.status) {
    case 'queued':
      return `Joined the queue — ${registration.packageName} package`
    case 'accepted':
      return 'Offer sent'
    case 'rejected':
      return 'Registration not offered'
    case 'terms_accepted':
      return 'Offer accepted — deposit invoice sent'
    case 'payment_submitted':
      return onFinalInvoice ? 'Balance proof of payment submitted' : 'Deposit proof of payment submitted'
    case 'payment_rejected':
      return `${onFinalInvoice ? 'Balance' : 'Deposit'} proof rejected${registration.adminNote ? `: ${registration.adminNote}` : ''}`
    case 'deposit_paid':
      return 'Deposit approved — slot locked'
    case 'final_invoiced': {
      const balance = (registration.finalInvoice?.items ?? []).reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
        0,
      )
      const due = registration.finalInvoice?.dueDate?.toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      })
      return `Final invoice ${reissued ? 'updated' : 'issued'} — balance ${money(registration, balance)}${due ? `, due ${due}` : ''}`
    }
    case 'confirmed':
      return 'Balance approved — booking confirmed'
    case 'cancelled':
      return registration.cancelledBy === 'admin' ? 'Booking cancelled by ARS Dream' : 'Booking cancelled by registrant'
    default:
      return `Status changed to ${registration.status}`
  }
}

/**
 * Appends a system entry to the registrant's support thread, tagged to the booking, so its chat
 * reads as a full history (and audit trail) alongside the messages. Written via the Admin SDK —
 * the rules only let clients create 'user'/'admin' messages, so these can't be forged. Leaves the
 * thread's unread/lastMessage fields alone: the status email/push already notified them.
 */
export async function logBookingEvent(registrationId: string, registration: FirebaseFirestore.DocumentData, text: string, marathonTitle?: string, attachmentUrls?: string[]) {
  await db
    .collection('personalThreads')
    .doc(registration.userId)
    .collection('messages')
    .add({
      senderId: 'system',
      senderRole: 'system',
      text,
      registrationId,
      ...(marathonTitle ? { registrationLabel: marathonTitle } : {}),
      ...(attachmentUrls?.length ? { attachmentUrls } : {}),
      createdAt: FieldValue.serverTimestamp(),
    })
}

/** A first join creates the doc rather than updating it, so onRegistrationStatusChange never sees it — log it here. */
export const onRegistrationCreated = onDocumentCreated(
  { document: 'registrations/{registrationId}' },
  withSentry(async (event) => {
    const registration = event.data?.data()
    if (!registration) return
    const marathon = await db.collection('marathons').doc(registration.marathonId).get()
    await logBookingEvent(event.params.registrationId, registration, describeStatusEvent(registration), marathon.data()?.title)
  }),
)
