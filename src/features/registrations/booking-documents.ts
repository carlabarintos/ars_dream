import type { FinalInvoice, Marathon, Registration, UserProfile } from '@/types'

import {
  buildFinalInvoiceEmail,
  buildInvoiceEmail,
  buildReceiptEmail,
  escapeHtml,
  packageLineItems,
} from '../../../functions/src/email-template'
import { hasChosenPackage } from './registration-flow'

export interface BookingDocument {
  label: string
  build: () => string
}

/**
 * The invoices/receipts this booking has been sent, rebuilt from the same templates and inputs as
 * onRegistrationStatusChange so the download matches the email.
 */
export function getBookingDocuments(
  registration: Registration,
  marathon: Marathon | undefined,
  profile: UserProfile | null,
): BookingDocument[] {
  if (!hasChosenPackage(registration)) return []
  const chosenPackage = marathon?.packages?.find((p) => p.id === registration.packageId)
  const context = documentContext(registration, marathon, profile)
  const currency = registration.packagePriceCurrency
  const items = packageLineItems(registration)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const { termsAcceptedAt, depositPaidAt, finalInvoice } = registration
  const documents: BookingDocument[] = []

  if (termsAcceptedAt) {
    documents.push({
      label: 'Invoice',
      build: () =>
        buildInvoiceEmail({
          ...context,
          marathon: marathon && {
            ...context.marathon,
            depositDeadline: new Date(termsAcceptedAt.toMillis() + (marathon.depositDueDays ?? 1) * 86_400_000),
            balanceDeadline: marathon.balanceDeadline?.toDate(),
          },
          depositAmount: chosenPackage?.depositAmount,
          registration,
          issuedAt: termsAcceptedAt.toDate(),
        }).html,
    })
  }
  if (depositPaidAt) {
    documents.push({
      label: 'Deposit Receipt',
      build: () =>
        buildReceiptEmail({
          ...context,
          currency,
          kind: 'deposit',
          // When the registrant uploaded the proof; deposits approved before depositProofSubmittedAt existed fall back to approval time.
          receivedAt: (registration.depositProofSubmittedAt ?? depositPaidAt).toDate(),
          items,
          amount: Math.min(chosenPackage?.depositAmount || total, total),
        }).html,
    })
  }
  if (finalInvoice) {
    // While confirmed, proofSubmittedAt is the balance proof's upload.
    const paidAt =
      registration.status === 'confirmed' ? (registration.proofSubmittedAt ?? registration.updatedAt).toDate() : undefined
    documents.push(...getFinalInvoiceDocuments(registration, marathon, profile, finalInvoice, paidAt))
  }
  return documents
}

function documentContext(registration: Registration, marathon: Marathon | undefined, profile: UserProfile | null) {
  const chosenPackage = marathon?.packages?.find((p) => p.id === registration.packageId)
  return {
    marathon: marathon && { title: marathon.title, eventDate: marathon.eventDate?.toDate() },
    registrationId: registration.id,
    inclusions: [marathon?.sharedInclusions, chosenPackage?.description].filter(Boolean).join('\n'),
    recipient: profile ?? undefined,
  }
}

/** One version of the final invoice, plus its receipt once paid (`paidAt` = when the balance proof was uploaded). */
export function getFinalInvoiceDocuments(
  registration: Registration,
  marathon: Marathon | undefined,
  profile: UserProfile | null,
  invoice: FinalInvoice,
  paidAt?: Date,
): BookingDocument[] {
  const context = { ...documentContext(registration, marathon, profile), currency: registration.packagePriceCurrency }
  const documents: BookingDocument[] = [
    {
      label: 'Final Invoice',
      build: () =>
        buildFinalInvoiceEmail({
          ...context,
          items: invoice.items,
          dueDate: invoice.dueDate?.toDate(),
          issuedAt: invoice.issuedAt?.toDate() ?? new Date(),
        }).html,
    },
  ]
  if (paidAt) {
    documents.push({
      label: 'Receipt',
      build: () => buildReceiptEmail({ ...context, kind: 'balance', receivedAt: paidAt, items: invoice.items }).html,
    })
  }
  return documents
}

/** The document as a standalone page; `media: 'all'` also hides the email-only intro/CTA on screen (the in-app preview). */
export function bookingDocumentPage(document: BookingDocument, title: string, media: 'print' | 'all' = 'print') {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><style>@media ${media} { .no-print { display: none !important; } }</style></head><body style="margin: 0;">${document.build()}</body></html>`
}

/** Saves the document as a standalone .html file — opens in any browser looking exactly like the email, minus its email-only intro/CTA. */
export function downloadBookingDocument(document: BookingDocument, marathonTitle: string | undefined) {
  const title = [document.label, marathonTitle].filter(Boolean).join(' - ')
  const link = window.document.createElement('a')
  link.href = URL.createObjectURL(new Blob([bookingDocumentPage(document, title, 'all')], { type: 'text/html' }))
  link.download = `${title.replace(/[\\/:*?"<>|]/g, '')}.html`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href))
}
