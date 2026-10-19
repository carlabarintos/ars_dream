import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import {
  ACCEPTED_COPY,
  INVOICE_COPY,
  buildAcceptanceEmail,
  buildInvoiceEmail,
  getOfferAcceptanceDeadline,
} from './email-template.js'
import { notifyUser } from './notify-user.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  accepted: ACCEPTED_COPY,
  terms_accepted: INVOICE_COPY,
  rejected: {
    title: 'Registration update',
    body: "We weren't able to offer you a slot on this marathon this time.",
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
  withSentry(async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return

    const copy = NOTIFICATION_COPY[after.status as string]
    if (!copy) return

    const [marathonDoc, settingsDoc, userDoc] = await Promise.all([
      db.collection('marathons').doc(after.marathonId).get(),
      db.collection('settings').doc('notifications').get(),
      after.status === 'accepted' || after.status === 'terms_accepted'
        ? db.collection('users').doc(after.userId).get()
        : undefined,
    ])

    const marathon = marathonDoc.data()
    const marathonTitle: string | undefined = marathon?.title
    const ccEmails: string[] = settingsDoc.data()?.ccEmails ?? []

    if (after.status === 'accepted') {
      const { subject, body, html } = buildAcceptanceEmail({
        marathon: marathon && {
          title: marathon.title,
          eventDate: marathon.eventDate?.toDate(),
          location: marathon.location,
          bannerImageUrl: marathon.bannerImageUrl,
          sharedInclusions: marathon.sharedInclusions,
          packageNotes: marathon.packageNotes,
          hotelDetails: marathon.hotelDetails,
          hotelImageUrl: marathon.hotelImageUrl,
          offerAcceptanceDeadline: getOfferAcceptanceDeadline(
            after.offeredAt?.toDate() ?? new Date(),
            marathon.offerAcceptanceDays,
          ),
          depositDueDays: marathon.depositDueDays,
        },
        pkg: marathon?.packages?.find((p: { id: string }) => p.id === after.packageId),
        registration: {
          packageName: after.packageName,
          packagePriceAmount: after.packagePriceAmount,
          packagePriceCurrency: after.packagePriceCurrency,
          selectedAddOns: after.selectedAddOns,
        },
        offerImageUrl: after.offerImageUrl,
        recipient: userDoc?.data(),
      })
      await notifyUser({
        userId: after.userId,
        pushTitle: copy.title,
        pushBody: copy.body,
        emailSubject: subject,
        emailBody: body,
        emailHtml: html,
        cc: ccEmails,
      })
      return
    }

    if (after.status === 'terms_accepted') {
      const { subject, body, html } = buildInvoiceEmail({
        marathon: marathon && {
          title: marathon.title,
          paymentInstructions: marathon.paymentInstructions,
          depositDeadline:
            after.termsAcceptedAt
              ? new Date(after.termsAcceptedAt.toMillis() + (marathon.depositDueDays ?? 1) * 86_400_000)
              : undefined,
          balanceDeadline: marathon.balanceDeadline?.toDate(),
        },
        depositAmount: marathon?.packages?.find((p: { id: string }) => p.id === after.packageId)?.depositAmount,
        registration: {
          packageName: after.packageName,
          packagePriceAmount: after.packagePriceAmount,
          packagePriceCurrency: after.packagePriceCurrency,
          selectedAddOns: after.selectedAddOns,
        },
        recipient: userDoc?.data(),
      })
      await notifyUser({
        userId: after.userId,
        pushTitle: copy.title,
        pushBody: copy.body,
        emailSubject: subject,
        emailBody: body,
        emailHtml: html,
        cc: ccEmails,
      })
      return
    }

    await notifyUser({
      userId: after.userId,
      pushTitle: copy.title,
      pushBody: copy.body,
      emailSubject: marathonTitle ? `${copy.title} — ${marathonTitle}` : copy.title,
      emailBody: marathonTitle ? `Your registration for the ${marathonTitle} tour: ${copy.body}` : copy.body,
      cc: ccEmails,
    })
  }),
)
