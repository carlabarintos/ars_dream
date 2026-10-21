import type { Marathon, Registration, UserProfile } from '@/types'

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
  const context = {
    marathon: marathon && { title: marathon.title, eventDate: marathon.eventDate?.toDate() },
    registrationId: registration.id,
    inclusions: [marathon?.sharedInclusions, chosenPackage?.description].filter(Boolean).join('\n'),
    recipient: profile ?? undefined,
  }
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
    documents.push({
      label: 'Final Invoice',
      build: () =>
        buildFinalInvoiceEmail({
          ...context,
          currency,
          items: finalInvoice.items,
          dueDate: finalInvoice.dueDate?.toDate(),
          issuedAt: finalInvoice.issuedAt.toDate(),
        }).html,
    })
    if (registration.status === 'confirmed') {
      documents.push({
        label: 'Receipt',
        build: () =>
          buildReceiptEmail({
            ...context,
            currency,
            kind: 'balance',
            // While confirmed, proofSubmittedAt is the balance proof's upload.
            receivedAt: (registration.proofSubmittedAt ?? registration.updatedAt).toDate(),
            items: finalInvoice.items,
          }).html,
      })
    }
  }
  return documents
}

/** The document as a standalone page; `media: 'all'` also hides the email-only intro/CTA on screen (the in-app preview). */
export function bookingDocumentPage(document: BookingDocument, title: string, media: 'print' | 'all' = 'print') {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><style>@media ${media} { .no-print { display: none !important; } }</style></head><body style="margin: 0;">${document.build()}</body></html>`
}

/** Opens the document in a new tab and brings up the print dialog, where "Save as PDF" downloads it. */
export function printBookingDocument(document: BookingDocument, marathonTitle: string | undefined) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(bookingDocumentPage(document, [document.label, marathonTitle].filter(Boolean).join(' — ')))
  win.document.close()
  // Waits for the logo to load so it makes it into the PDF.
  win.addEventListener('load', () => win.print())
}
