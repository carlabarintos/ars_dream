import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { describePackage, describeStatusEvent, logBookingEvent } from './booking-event.js'
import {
  ACCEPTED_COPY,
  FINAL_INVOICE_COPY,
  INVOICE_COPY,
  buildAcceptanceEmail,
  buildFinalInvoiceEmail,
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
  deposit_paid: {
    title: 'Deposit received',
    body: "Your deposit was verified and your slot is locked in. We'll go over add-ons with you in your booking's messages, then send your final invoice.",
  },
  final_invoiced: FINAL_INVOICE_COPY,
  confirmed: {
    title: "You're confirmed!",
    body: "Your final payment was verified — you're all set for race day.",
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
    if (!before || !after) return
    // An edited final invoice is re-issued without a status change — resend it too.
    const finalInvoiceReissued =
      after.status === 'final_invoiced' &&
      before.finalInvoice?.issuedAt?.toMillis() !== after.finalInvoice?.issuedAt?.toMillis()

    // An admin changing the package/add-ons (ChangePackageDialog) leaves the status as is. The
    // registrant's own pick happens on accepting the offer, which is a status change logged below.
    const packageChanged =
      before.status === after.status &&
      before.packageId !== '' &&
      after.packageId !== '' &&
      (before.packageId !== after.packageId ||
        JSON.stringify(before.selectedAddOns ?? []) !== JSON.stringify(after.selectedAddOns ?? []))

    if (before.status === after.status && !finalInvoiceReissued && !packageChanged) return

    // Before the deposit is approved the invoice is derived from the package, so a package change amends it — resend it.
    const depositInvoiceAmended =
      packageChanged && ['terms_accepted', 'payment_rejected'].includes(after.status) && after.finalInvoice == null

    const marathonDoc = await db.collection('marathons').doc(after.marathonId).get()
    if (packageChanged) {
      await logBookingEvent(
        event.params.registrationId,
        after,
        `Package changed by ARS Dream: ${describePackage(before)} → ${describePackage(after)}` +
          (depositInvoiceAmended ? ' — amended invoice sent' : ''),
        marathonDoc.data()?.title,
      )
      if (!finalInvoiceReissued && !depositInvoiceAmended) return
    }
    if (!packageChanged || finalInvoiceReissued) {
      await logBookingEvent(
        event.params.registrationId,
        after,
        // An invoice re-issued on a paid booking (confirmed → final_invoiced) is an update too.
        describeStatusEvent(after, before.status === after.status || before.finalInvoice != null),
        marathonDoc.data()?.title,
        // Link the submitted proof so both sides can reopen it from the booking's history.
        after.status === 'payment_submitted' ? after.proofOfPaymentUrls : undefined,
      )
    }

    const copy = depositInvoiceAmended ? INVOICE_COPY : NOTIFICATION_COPY[after.status as string]
    if (!copy) return

    const [settingsDoc, userDoc] = await Promise.all([
      db.collection('settings').doc('notifications').get(),
      after.status === 'accepted' || after.status === 'terms_accepted' || after.status === 'final_invoiced' || depositInvoiceAmended
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
        packages: (marathon?.packages ?? []).filter((p: { id: string }) =>
          ((after.offeredPackageIds as string[] | undefined) ?? [after.packageId]).includes(p.id),
        ),
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

    if (after.status === 'terms_accepted' || depositInvoiceAmended) {
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

    if (after.status === 'final_invoiced') {
      const { subject, body, html } = buildFinalInvoiceEmail({
        marathon: marathon && { title: marathon.title, paymentInstructions: marathon.paymentInstructions },
        currency: after.packagePriceCurrency,
        items: after.finalInvoice?.items ?? [],
        dueDate: after.finalInvoice?.dueDate?.toDate(),
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
