import { useState } from 'react'
import { CheckIcon, FileTextIcon, MailIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  type BookingDocument,
  getBookingDocuments,
  getFinalInvoiceDocuments,
} from '@/features/registrations/booking-documents'
import { describePartOf, getQuestionnaires, getRunners, isQuestionAnswered, runnerPrefix } from '@/features/registrations/registration-flow'
import { cn, formatPackagePrice } from '@/lib/utils'
import { type BookingEmail, formatTransferParty, type Marathon, type Registration, type UserProfile } from '@/types'

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
  const runners = getRunners(registration, marathon)
  const addOns = registration.selectedAddOns?.map((addOn) => addOn.name).join(', ')
  const steps: Step[] = [
    // A slot transferred in was waitlisted by its original holder — its transfer step is spliced in below instead.
    ...(registration.transferredFrom || (registration.partOf && !registration.partOf.hadOwnPlace)
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
      label: registration.partOf ? 'Package' : 'Accepted package',
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
    ...runners.flatMap((runner, i) => {
      const prefix = runnerPrefix(i, runners.length, runner.name)
      const answerValues = Object.fromEntries((runner.answers ?? []).map((a) => [a.questionId, a.value]))
      return [
        {
          label: `${prefix}Passport bio page uploaded`,
          done: !!runner.passportPhotoUrl,
          upload: runner.passportPhotoUrl ? { url: runner.passportPhotoUrl, label: `${prefix}Passport bio page` } : undefined,
        },
        ...getQuestionnaires(marathon).map((questionnaire) => ({
          label: `${prefix}${questionnaire.name} answered`,
          done: questionnaire.questions
            .filter((question) => question.required)
            .every((question) => isQuestionAnswered(question, answerValues[question.id])),
        })),
      ]
    }),
    ...(invoiceSteps.length > 0
      ? invoiceSteps
      : [
          { label: 'Final invoice sent', done: false },
          { label: 'Terms & conditions accepted', done: false },
          { label: 'Balance paid — confirmed', done: false },
        ]),
  ]

  const { partOf } = registration
  if (partOf) {
    // In place of "Offered": this is what the offer was. A booking already under way joined where it had got to.
    const firstToDo = steps.findIndex((step) => !step.done)
    const at = partOf.joinedAt ? (firstToDo === -1 ? steps.length : firstToDo) : steps.findIndex((step) => step.label === 'Offered')
    steps.splice(at, partOf.joinedAt ? 0 : 1, {
      label: describePartOf(partOf),
      at: (partOf.joinedAt ?? offeredAt)?.toDate(),
      done: true,
    })
  }

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

/** Each email goes under the latest step that happened before it was sent: the step that sent it, or a reminder about it. */
function emailsByStep(steps: Step[], emails: BookingEmail[]) {
  const byStep = steps.map((): BookingEmail[] => [])
  for (const email of emails) {
    const sentAt = email.sentAt?.toMillis() ?? Date.now()
    let best = -1
    steps.forEach((step, index) => {
      const at = step.done ? step.at?.getTime() : undefined
      if (at !== undefined && at <= sentAt && (best === -1 || at >= steps[best].at!.getTime())) best = index
    })
    // Sent before any dated step (a clock skew of a second or two): show it on the first one.
    byStep[best === -1 ? 0 : best]?.push(email)
  }
  return byStep
}

export function BookingTimeline({
  registration,
  marathon,
  profile,
  emails = [],
}: {
  registration: Registration
  marathon: Marathon | undefined
  profile: UserProfile
  /** Admin-only: emails sent about this booking, each viewable from its step. */
  emails?: BookingEmail[]
}) {
  const [viewing, setViewing] = useState<BookingDocument>()
  const [viewingEmail, setViewingEmail] = useState<BookingEmail>()
  const allSteps = [...getPreviousRoundSteps(registration), ...getSteps(registration, marathon, profile)]
  const stepEmails = emailsByStep(allSteps, emails)
  return (
    <>
      <ol className="flex flex-col">
        {allSteps.map((step, index, steps) => {
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
                <div className="flex flex-wrap gap-1.5">
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
                  {stepEmails[index].map((email) => (
                    <Button
                      key={email.id}
                      variant="outline"
                      size="sm"
                      className={cn('h-7', email.failed && 'text-destructive')}
                      title={email.subject}
                      onClick={() => setViewingEmail(email)}
                    >
                      <MailIcon />
                      {email.failed ? 'Email failed' : 'Email'}
                    </Button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <BookingDocumentDialog document={viewing} marathonTitle={marathon?.title} onClose={() => setViewing(undefined)} />
      <Dialog open={!!viewingEmail} onOpenChange={(open) => !open && setViewingEmail(undefined)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-3xl">
          {viewingEmail && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingEmail.subject}</DialogTitle>
                <DialogDescription>
                  To {viewingEmail.to}
                  {viewingEmail.cc.length > 0 && ` · Cc ${viewingEmail.cc.join(', ')}`}
                  {viewingEmail.sentAt && ` · ${viewingEmail.sentAt.toDate().toLocaleString()}`}
                  {viewingEmail.failed && ' · Sending failed, so it likely never arrived'}
                </DialogDescription>
              </DialogHeader>
              {/* No allow-scripts: same-origin only so the frame can be sized to its content. */}
              <iframe
                title={viewingEmail.subject}
                srcDoc={viewingEmail.html}
                sandbox="allow-same-origin"
                onLoad={(e) => {
                  const frame = e.currentTarget
                  frame.style.height = `${frame.contentDocument?.documentElement.scrollHeight ?? 0}px`
                }}
                className="h-[60vh] w-full rounded-md border border-border bg-white"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
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
