import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

import { db } from './admin.js'
import { describePackage, describeStatusEvent, logBookingEvent } from './booking-event.js'
import {
  ACCEPTED_COPY,
  BALANCE_RECEIPT_COPY,
  DEPOSIT_RECEIPT_COPY,
  FINAL_INVOICE_COPY,
  INVOICE_COPY,
  buildAcceptanceEmail,
  buildFinalInvoiceEmail,
  buildInvoiceEmail,
  buildReceiptEmail,
  formatDate,
  getOfferAcceptanceDeadline,
  packageLineItems,
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
  deposit_paid: DEPOSIT_RECEIPT_COPY,
  final_invoiced: FINAL_INVOICE_COPY,
  confirmed: BALANCE_RECEIPT_COPY,
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

    // An admin extending the current step's due date (ExtendDueDateDialog) also leaves the status as is.
    const dueExtended =
      before.status === after.status &&
      after.dueExtension != null &&
      before.dueExtension?.dueDate?.toMillis() !== after.dueExtension.dueDate.toMillis()
    if (dueExtended) {
      const marathonTitle: string | undefined = (await db.collection('marathons').doc(after.marathonId).get()).data()?.title
      const due = formatDate(after.dueExtension.dueDate.toDate())
      await logBookingEvent(event.params.registrationId, after, `Due date extended by ARS Dream to ${due}`, marathonTitle)
      const body = `Your due date has been extended to ${due}.`
      await notifyUser({
        userId: after.userId,
        pushTitle: 'Due date extended',
        pushBody: body,
        emailSubject: marathonTitle ? `Due date extended — ${marathonTitle}` : 'Due date extended',
        emailBody: marathonTitle ? `Your registration for the ${marathonTitle} tour: ${body}` : body,
      })
      return
    }

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
      db.collection('users').doc(after.userId).get(),
    ])

    const marathon = marathonDoc.data()
    const marathonTitle: string | undefined = marathon?.title
    const ccEmails: string[] = settingsDoc.data()?.ccEmails ?? []
    const chosenPackage = marathon?.packages?.find((p: { id: string }) => p.id === after.packageId)
    // Everything the invoice/receipt emails share (the office's SPORTS SITE INVOICING template).
    const documentContext = {
      marathon: marathon && { title: marathon.title, eventDate: marathon.eventDate?.toDate() },
      registrationId: event.params.registrationId,
      inclusions: [marathon?.sharedInclusions, chosenPackage?.description].filter(Boolean).join('\n'),
      recipient: userDoc.data(),
    }

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
        recipient: userDoc.data(),
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
        ...documentContext,
        marathon: marathon && {
          ...documentContext.marathon,
          depositDeadline:
            after.termsAcceptedAt
              ? new Date(after.termsAcceptedAt.toMillis() + (marathon.depositDueDays ?? 1) * 86_400_000)
              : undefined,
          balanceDeadline: marathon.balanceDeadline?.toDate(),
        },
        depositAmount: chosenPackage?.depositAmount,
        registration: {
          packageName: after.packageName,
          packagePriceAmount: after.packagePriceAmount,
          packagePriceCurrency: after.packagePriceCurrency,
          selectedAddOns: after.selectedAddOns,
        },
        issuedAt: after.termsAcceptedAt?.toDate() ?? new Date(),
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
        ...documentContext,
        currency: after.packagePriceCurrency,
        items: after.finalInvoice?.items ?? [],
        dueDate: after.finalInvoice?.dueDate?.toDate(),
        issuedAt: after.finalInvoice?.issuedAt?.toDate() ?? new Date(),
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

    // Every approved payment gets an acknowledgement receipt.
    if (after.status === 'deposit_paid' || after.status === 'confirmed') {
      const total = packageLineItems(after as Parameters<typeof packageLineItems>[0]).reduce((sum, item) => sum + item.amount, 0)
      const { subject, body, html } = buildReceiptEmail({
        ...documentContext,
        currency: after.packagePriceCurrency,
        ...(after.status === 'deposit_paid'
          ? {
              kind: 'deposit' as const,
              // When the registrant uploaded the proof, not when it was approved.
              receivedAt: (after.proofSubmittedAt ?? after.depositPaidAt)?.toDate() ?? new Date(),
              items: packageLineItems(after as Parameters<typeof packageLineItems>[0]),
              // Same deposit the invoice billed; no deposit set means the full amount was paid up front.
              amount: Math.min(chosenPackage?.depositAmount || total, total),
            }
          : {
              kind: 'balance' as const,
              receivedAt: (after.proofSubmittedAt ?? after.updatedAt)?.toDate() ?? new Date(),
              items: after.finalInvoice?.items ?? [],
            }),
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
