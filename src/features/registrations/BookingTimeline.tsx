import { useState } from 'react'
import { CheckIcon, FileTextIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  type BookingDocument,
  getBookingDocuments,
  getFinalInvoiceDocuments,
} from '@/features/registrations/booking-documents'
import { cn, formatPackagePrice } from '@/lib/utils'
import type { Marathon, Registration, UserProfile } from '@/types'

import { BookingDocumentDialog } from './BookingDocumentDialog'

interface Step {
  label: string
  detail?: string
  at?: Date
  done: boolean
  failed?: boolean
  /** Viewable/downloadable from this step once it's done. */
  document?: BookingDocument
}

/** A booking's journey rebuilt from its timestamps; steps not reached yet stay greyed out. */
function getSteps(registration: Registration, marathon?: Marathon, profile: UserProfile | null = null): Step[] {
  const { status, offeredAt, termsAcceptedAt, depositPaidAt, finalInvoice } = registration
  const documents = getBookingDocuments(registration, marathon, profile)
  const documentFor = (label: string) => documents.find((d) => d.label === label)
  const money = (amount: number) => `${registration.packagePriceCurrency} ${amount.toLocaleString()}`
  // Every version of the final invoice, oldest first: each gets its own step, plus a paid step if it was paid.
  const versions = [...(registration.previousFinalInvoices ?? []), ...(finalInvoice ? [finalInvoice] : [])]
  let paidBefore = false
  const invoiceSteps: Step[] = versions.flatMap((invoice, index) => {
    const isCurrent = index === versions.length - 1
    const paidAt = isCurrent
      ? status === 'confirmed'
        ? (registration.proofSubmittedAt ?? registration.updatedAt)?.toDate()
        : undefined
      : registration.previousFinalInvoices?.[index]?.paidAt?.toDate()
    const [invoiceDocument, receipt] = getFinalInvoiceDocuments(registration, marathon, profile, invoice, paidAt)
    const balance = invoice.items.reduce((sum, item) => sum + item.amount, 0)
    const versionSteps: Step[] = [
      {
        label: index === 0 ? 'Final invoice sent' : 'Final invoice amended',
        detail: `Balance due ${money(balance)}`,
        at: invoice.issuedAt?.toDate(), // null for a moment after issuing, until the server timestamp lands
        done: true,
        document: invoiceDocument,
      },
    ]
    if (paidAt || isCurrent) {
      versionSteps.push({
        label: paidBefore ? 'Additional balance paid — confirmed' : 'Balance paid — confirmed',
        at: paidAt,
        done: !!paidAt,
        document: receipt,
      })
    }
    paidBefore ||= !!paidAt
    return versionSteps
  })
  const addOns = registration.selectedAddOns?.map((addOn) => addOn.name).join(', ')
  const steps: Step[] = [
    { label: 'Waitlisted', at: registration.createdAt?.toDate(), done: true },
    {
      label: 'Offered',
      at: offeredAt?.toDate(),
      done: !!offeredAt || !!termsAcceptedAt || status === 'accepted',
    },
    {
      label: 'Accepted package',
      detail: termsAcceptedAt
        ? [
            `${registration.packageName} · ${formatPackagePrice(registration.packagePriceCurrency, registration.packagePriceAmount)}`,
            addOns && `+ ${addOns}`,
          ]
            .filter(Boolean)
            .join(' ')
        : undefined,
      at: termsAcceptedAt?.toDate(),
      done: !!termsAcceptedAt,
    },
    {
      label: 'Deposit invoice sent',
      at: termsAcceptedAt?.toDate(),
      done: !!termsAcceptedAt,
      document: documentFor('Invoice'),
    },
    {
      label: 'Deposit paid',
      at: (registration.depositProofSubmittedAt ?? depositPaidAt)?.toDate(),
      done: !!depositPaidAt,
      document: documentFor('Deposit Receipt'),
    },
    ...(invoiceSteps.length > 0
      ? invoiceSteps
      : [
          { label: 'Final invoice sent', done: false },
          { label: 'Balance paid — confirmed', done: false },
        ]),
  ]

  const ending =
    status === 'rejected'
      ? { label: 'Not offered', at: registration.updatedAt?.toDate() }
      : status === 'cancelled'
        ? {
            label: `Cancelled${registration.cancelledBy ? ` by ${registration.cancelledBy === 'admin' ? 'ARS Dream' : 'registrant'}` : ''}`,
            at: (registration.cancelledAt ?? registration.updatedAt)?.toDate(),
          }
        : status === 'payment_rejected'
          ? { label: 'Payment rejected — awaiting resubmission', at: registration.updatedAt?.toDate() }
          : null
  if (!ending) return steps
  // Off the happy path: show what was reached, then where it stopped.
  return [...steps.filter((step) => step.done), { ...ending, done: true, failed: true }]
}

export function BookingTimeline({
  registration,
  marathon,
  profile,
}: {
  registration: Registration
  marathon: Marathon | undefined
  profile: UserProfile
}) {
  const [viewing, setViewing] = useState<BookingDocument>()
  return (
    <>
      <ol className="flex flex-col">
        {getSteps(registration, marathon, profile).map((step, index, steps) => {
          const document = step.done && step.document
          return (
            <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
              {index < steps.length - 1 && (
                <span
                  className={cn('absolute top-6 bottom-0 left-[11px] w-px', step.done ? 'bg-primary' : 'bg-border')}
                />
              )}
              <span
                className={cn(
                  'z-10 flex size-6 shrink-0 items-center justify-center rounded-full border',
                  step.failed
                    ? 'border-destructive bg-destructive text-white'
                    : step.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background',
                )}
              >
                {step.failed ? <XIcon className="size-3.5" /> : step.done && <CheckIcon className="size-3.5" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', !step.done && 'text-muted-foreground')}>{step.label}</p>
                  {step.detail && <p className="text-muted-foreground text-xs">{step.detail}</p>}
                  {step.done && step.at && (
                    <p className="text-muted-foreground text-xs">{step.at.toLocaleString()}</p>
                  )}
                </div>
                {document && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => setViewing(document)}
                  >
                    <FileTextIcon />
                    {document.label}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <BookingDocumentDialog document={viewing} marathonTitle={marathon?.title} onClose={() => setViewing(undefined)} />
    </>
  )
}

/** One segment per timeline step, for a table row. */
export function BookingProgress({ registration }: { registration: Registration }) {
  const steps = getSteps(registration)
  return (
    <div className="flex gap-0.5" title={steps.filter((step) => step.done).at(-1)?.label}>
      {steps.map((step, index) => (
        <span
          key={index}
          className={cn('h-1.5 w-3 rounded-full', step.failed ? 'bg-destructive' : step.done ? 'bg-primary' : 'bg-muted')}
        />
      ))}
    </div>
  )
}
