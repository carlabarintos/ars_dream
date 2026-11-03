import { useState } from 'react'
import { CheckIcon, FileTextIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  type BookingDocument,
  getBookingDocuments,
  getFinalInvoiceDocuments,
} from '@/features/registrations/booking-documents'
import { getQuestionnaires, isQuestionAnswered } from '@/features/registrations/registration-flow'
import { cn, formatPackagePrice } from '@/lib/utils'
import { formatTransferParty, type Marathon, type Registration, type UserProfile } from '@/types'

import { BookingDocumentDialog, UploadedFileThumb } from './BookingDocumentDialog'

interface Step {
  label: string
  detail?: string
  at?: Date
  done: boolean
  failed?: boolean
  /** Viewable/downloadable from this step once it's done. */
  document?: BookingDocument
  /** Uploaded file shown as a thumbnail under the step. */
  upload?: { url: string; label: string }
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
    if (isCurrent) {
      versionSteps.push({
        label: 'Terms & conditions accepted',
        at: registration.finalTermsAcceptedAt?.toDate(),
        done: !!registration.finalTermsAcceptedAt || !!paidAt,
      })
    }
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
  const answerValues = Object.fromEntries((registration.answers ?? []).map((a) => [a.questionId, a.value]))
  const addOns = registration.selectedAddOns?.map((addOn) => addOn.name).join(', ')
  const steps: Step[] = [
    // A slot transferred in was waitlisted by its original holder — its transfer step is spliced in below instead.
    ...(registration.transferredFrom
      ? []
      : [
          {
            label: registration.previousRounds?.length ? 'Waitlisted again' : 'Waitlisted',
            at: registration.createdAt?.toDate(),
            done: true,
          },
        ]),
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
    {
      label: 'Passport bio page uploaded',
      done: !!registration.passportPhotoUrl,
      upload: registration.passportPhotoUrl ? { url: registration.passportPhotoUrl, label: 'Passport bio page' } : undefined,
    },
    ...getQuestionnaires(marathon).map((questionnaire) => ({
      label: `${questionnaire.name} answered`,
      done: questionnaire.questions
        .filter((question) => question.required)
        .every((question) => isQuestionAnswered(question, answerValues[question.id])),
    })),
    ...(invoiceSteps.length > 0
      ? invoiceSteps
      : [
          { label: 'Final invoice sent', done: false },
          { label: 'Terms & conditions accepted', done: false },
          { label: 'Balance paid — confirmed', done: false },
        ]),
  ]

  const { transferredFrom } = registration
  if (transferredFrom) {
    // After the steps the slot had already reached when it changed hands.
    const at = steps.findIndex((step) => !step.done)
    steps.splice(at === -1 ? steps.length : at, 0, {
      label: `Slot transferred from ${formatTransferParty(transferredFrom)}`,
      at: transferredFrom.at?.toDate(),
      done: true,
    }, ...(registration.transferTermsAcceptedAt !== undefined
      ? [{ label: 'Terms & conditions accepted', at: registration.transferTermsAcceptedAt?.toDate(), done: !!registration.transferTermsAcceptedAt }]
      : []))
  }

  const ending =
    status === 'rejected' || status === 'cancelled'
      ? { label: endingLabel(status, registration.cancelledBy, registration.transferredTo && formatTransferParty(registration.transferredTo)), at: (registration.cancelledAt ?? registration.updatedAt)?.toDate() }
      : status === 'payment_rejected'
        ? { label: 'Payment rejected — awaiting resubmission', at: registration.updatedAt?.toDate() }
        : null
  if (!ending) return steps
  // Off the happy path: show what was reached, then where it stopped.
  return [...steps.filter((step) => step.done), { ...ending, done: true, failed: true }]
}

function endingLabel(status: 'rejected' | 'cancelled', cancelledBy?: 'user' | 'admin' | null, transferredToName?: string | null) {
  if (status === 'rejected') return 'Not offered'
  if (transferredToName) return `Slot transferred to ${transferredToName}`
  return `Cancelled${cancelledBy ? ` by ${cancelledBy === 'admin' ? 'ARS Dream' : 'registrant'}` : ''}`
}

/** Earlier rounds that ended in a rejection/cancellation before the registrant rejoined, oldest first. */
function getPreviousRoundSteps(registration: Registration): Step[] {
  return (registration.previousRounds ?? []).flatMap((round, index) => {
    const steps: Step[] = [
      { label: index === 0 ? 'Waitlisted' : 'Waitlisted again', at: round.waitlistedAt?.toDate(), done: true },
    ]
    if (round.offeredAt) steps.push({ label: 'Offered', at: round.offeredAt.toDate(), done: true })
    if (round.termsAcceptedAt) {
      steps.push({ label: 'Accepted package', detail: round.packageName || undefined, at: round.termsAcceptedAt.toDate(), done: true })
    }
    if (round.depositPaidAt) steps.push({ label: 'Deposit paid', at: round.depositPaidAt.toDate(), done: true })
    steps.push({ label: endingLabel(round.status, round.cancelledBy, round.transferredToName && formatTransferParty({ name: round.transferredToName, email: round.transferredToEmail ?? '' })), at: round.endedAt?.toDate(), done: true, failed: true })
    return steps
  })
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
        {[...getPreviousRoundSteps(registration), ...getSteps(registration, marathon, profile)].map((step, index, steps) => {
          const document = step.done && step.document
          const isNext = index === steps.findIndex((s) => !s.done)
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
                      : isNext
                        ? 'border-primary bg-background'
                        : 'bg-background',
                )}
              >
                {step.failed ? <XIcon className="size-3.5" /> : step.done && <CheckIcon className="size-3.5" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', !step.done && !isNext && 'text-muted-foreground')}>
                    {isNext ? `Waiting: ${step.label}` : step.label}
                  </p>
                  {step.detail && <p className="text-muted-foreground text-xs">{step.detail}</p>}
                  {step.done && step.at && (
                    <p className="text-muted-foreground text-xs">{step.at.toLocaleString()}</p>
                  )}
                  {step.upload && <UploadedFileThumb {...step.upload} className="mt-1.5 h-20" />}
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
