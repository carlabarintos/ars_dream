import { formatTransferParty } from '@/types'
import { bookingDeposit } from '../../../functions/src/email-template'
import type { InvoiceLineItem, Marathon, MarathonQuestion, Registration, RegistrationStatus, RunnerDetails, RunnerPartOf } from '@/types'

/** Whether a package has been picked yet — waitlist entries have none until the offer is accepted. */
export function hasChosenPackage(registration: Registration) {
  return registration.packageId !== ''
}

/** The packages the registrant may pick from when accepting their offer. Legacy offers (no `offeredPackageIds`) were made on the package chosen at join time. */
export function getOfferedPackages(registration: Registration, marathon: Marathon | undefined) {
  const ids = registration.offeredPackageIds ?? [registration.packageId]
  return (marathon?.packages ?? []).filter((pkg) => ids.includes(pkg.id))
}

/** Runners this booking names (e.g. 2 for a "Runner + Runner" lead); 1 until a package is chosen, and 1 on a runner's own booking. */
export function getRunnerCount(registration: Registration, marathon: Marathon | null | undefined) {
  if (registration.partOf) return 1
  return marathon?.packages?.find((p) => p.id === registration.packageId)?.runnerCount ?? 1
}

/** The runners whose passport and answers this booking collects: only its own holder, since each runner has their own booking. */
export function getRunners(registration: Registration, _marathon?: Marathon | null): RunnerDetails[] {
  return [{ passportPhotoUrl: registration.passportPhotoUrl, answers: registration.answers }]
}

/** Runners 2+ a lead's booking names (name and email), filled in or not. */
export function getCompanions(registration: Registration, marathon: Marathon | null | undefined): RunnerDetails[] {
  return Array.from({ length: getRunnerCount(registration, marathon) - 1 }, (_, i) => registration.companions?.[i] ?? {})
}

/** "Changed to Runner + Runner: you're Runner 2 on Maria Santos's booking" */
export const describePartOf = ({ packageName, runner, leadName, hadOwnPlace }: RunnerPartOf) =>
  `${hadOwnPlace ? `Changed to ${packageName}: you're` : "You're"} Runner ${runner} on ${leadName}'s ${hadOwnPlace ? 'booking' : `${packageName} booking`}`

export const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

/** Two runners given the same email: only one person, who'd hold one booking. */
export const hasRepeatedEmail = (runners: { email?: string }[]) => {
  const emails = runners.map((runner) => runner.email?.trim().toLowerCase()).filter(Boolean)
  return new Set(emails).size < emails.length
}

export const isLeadEmail = (email: string | undefined, leadEmail: string | null | undefined) =>
  !!leadEmail && email?.trim().toLowerCase() === leadEmail.toLowerCase()

export const toRunnerRows = (runners: RunnerDetails[] = []) => runners.map((r) => ({ name: r.name ?? '', email: r.email ?? '' }))

/** The rows an admin filled in; they may leave any blank for later. */
export const filledRunnerRows = (rows: { name: string; email: string }[]) =>
  rows.map((row) => ({ name: row.name.trim(), email: row.email.trim() })).filter((row) => row.name || row.email)

export const areRunnerRowsValid = (rows: { name: string; email: string }[], leadEmail: string | null | undefined) =>
  filledRunnerRows(rows).every((row) => row.name && isValidEmail(row.email) && !isLeadEmail(row.email, leadEmail)) && !hasRepeatedEmail(rows)

/** "Runner 2 (Maria Santos) · " on a multi-runner booking, '' otherwise. */
export function runnerPrefix(index: number, runnerCount: number, name?: string) {
  if (runnerCount <= 1) return ''
  return name ? `Runner ${index + 1} (${name}) · ` : `Runner ${index + 1} · `
}

export function hasAllPassports(registration: Registration, marathon: Marathon | null | undefined) {
  return getRunners(registration, marathon).every((runner) => runner.passportPhotoUrl)
}

const answerMap = (runner: RunnerDetails) => Object.fromEntries((runner.answers ?? []).map((a) => [a.questionId, a.value]))

/** On a multi-runner package, as lead or runner. */
export function isOnSharedPackage(registration: Registration) {
  return !!registration.partOf || !!registration.companions?.some((runner) => runner.email)
}

/** What an admin is told after applying one runner's deposit to the others. */
export function sharedDepositMessage({ covered, waiting }: { covered: number; waiting: number }) {
  const done =
    covered > 0
      ? `Deposit marked paid for ${covered === 1 ? 'the other runner' : `${covered} other runners`}.`
      : 'No other runner was ready for this deposit.'
  return waiting > 0
    ? `${done} ${waiting === 1 ? 'One runner has' : `${waiting} runners have`}n't accepted their T&C yet, so it's settled automatically when they do, with no invoice to pay. If a runner has their own proof under review, review it as usual.`
    : done
}

/** Whether this registration is paying its balance against the final invoice rather than its deposit. */
export function isOnFinalInvoice(registration: Registration) {
  return registration.finalInvoice != null
}

/** The invoice lines for the registration's current package and add-ons. */
export function getPackageInvoiceLines(registration: Pick<Registration, 'packageName' | 'packagePriceAmount' | 'selectedAddOns'>): InvoiceLineItem[] {
  return [
    { label: `${registration.packageName} package`, amount: registration.packagePriceAmount },
    ...(registration.selectedAddOns ?? []).map((addOn) => ({ label: `Add-on: ${addOn.name}`, amount: addOn.priceAmount })),
  ]
}

/**
 * Swaps an invoice's package/add-on lines for the current ones after a package change, keeping custom lines and credits.
 * ponytail: package lines are recognised by the labels getPackageInvoiceLines generates, so a hand-renamed one is kept as custom.
 */
export function withCurrentPackageLines(
  items: InvoiceLineItem[],
  registration: Pick<Registration, 'packageName' | 'packagePriceAmount' | 'selectedAddOns'>,
): InvoiceLineItem[] {
  const isPackageLine = (item: InvoiceLineItem) =>
    !item.isDeposit && (item.label.endsWith(' package') || item.label.startsWith('Add-on: '))
  return [...getPackageInvoiceLines(registration), ...items.filter((item) => !isPackageLine(item))]
}

/** Earlier approved proofs (depositProofUrls) and the latest submission, minus anything already archived. */
export function getPaymentProofs(registration: Registration) {
  const approved = registration.depositProofUrls ?? []
  return { approved, latest: registration.proofOfPaymentUrls.filter((url) => !approved.includes(url)) }
}

/** Every proof uploaded on this booking, labelled with what it paid and where it stands, oldest first. */
export function getLabelledPaymentProofs(registration: Registration) {
  const { approved, latest } = getPaymentProofs(registration)
  const latestLabel =
    registration.status === 'payment_submitted'
      ? 'Awaiting review'
      : registration.status === 'payment_rejected'
        ? 'Rejected'
        : 'Approved'
  const paidBalanceProofs = new Set(registration.previousFinalInvoices?.flatMap((v) => v.paidProofUrls ?? []))
  return [
    ...approved.map((url) => ({ url, label: `${paidBalanceProofs.has(url) ? 'Balance' : 'Deposit'} · Approved` })),
    ...latest.map((url) => ({ url, label: `${isOnFinalInvoice(registration) ? 'Balance' : 'Deposit'} · ${latestLabel}` })),
  ]
}

/** Sum of the final invoice's lines — what's still owed after the deposit credit. */
export function getFinalInvoiceBalance(registration: Registration) {
  return (registration.finalInvoice?.items ?? []).reduce((sum, item) => sum + item.amount, 0)
}

/** Package base price plus any selected add-ons — the actual amount the registrant owes. Once a final invoice exists, its lines (minus the deposit credit) replace that. */
export function getRegistrationTotalAmount(registration: Registration) {
  if (registration.finalInvoice) {
    return registration.finalInvoice.items.filter((item) => !item.isDeposit).reduce((sum, item) => sum + item.amount, 0)
  }
  const addOnsTotal = (registration.selectedAddOns ?? []).reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  return registration.packagePriceAmount + addOnsTotal
}

/** The deposit this proof should cover — the full total when the package has no deposit split (same rule as FinalInvoiceDialog). */
export function getDepositDue(registration: Registration, marathon: Marathon | null | undefined) {
  return bookingDeposit(registration, marathon?.packages?.find((p) => p.id === registration.packageId))
}

/** Flagged by flagOverdueRegistrations and still sitting in the status it went overdue in. */
export function isOverdue(registration: Registration) {
  return registration.overdueStatus === registration.status
}

export function getRegistrationStatusMessage(registration: Registration, marathon: Marathon | undefined) {
  if (getPendingActionStep(registration, marathon) === 'transfer_terms') {
    return registration.partOf
      ? `${describePartOf(registration.partOf)}. Accept the terms & conditions to pay your deposit.`
      : 'A slot has been transferred to you. Accept the terms & conditions to take it over.'
  }
  if (isOverdue(registration)) {
    return registration.status === 'final_invoiced'
      ? 'Overdue: your final invoice due date has passed. Pay your balance and upload your proof now — your slot may be cancelled otherwise.'
      : 'Overdue: your deposit due date has passed. Submit your proof of payment now — your slot may be cancelled otherwise.'
  }
  switch (registration.status) {
    case 'queued':
      return "You're on the waitlist. We'll notify you once a spot opens up and we have packages to offer you."
    case 'accepted':
      if (registration.partOf) return `${describePartOf(registration.partOf)}. Accept your offer to receive your own invoice.`
      return "You've received an offer! Choose your package and accept it to receive your invoice."
    case 'terms_accepted':
      return 'Your invoice is ready. Pay your deposit using the instructions provided, then upload your proof of payment.'
    case 'payment_submitted':
      return "Your payment is under review. We'll notify you once it's confirmed."
    case 'deposit_paid':
      if (!hasSubmittedBookingDetails(registration, marathon)) {
        return 'Deposit received — your slot is locked in! Upload a photo of your passport bio page, then answer the event questionnaire (if any).'
      }
      return "Deposit received — your slot is locked in. We'll go over add-ons with you in this booking's messages, then send your final invoice."
    case 'final_invoiced':
      return 'Your final invoice is ready. Review it, accept the terms & conditions, and upload your proof of payment for the balance.'
    case 'payment_rejected':
      return registration.adminNote
        ? `Your payment proof was rejected: ${registration.adminNote} Please resubmit.`
        : 'Your payment proof was rejected. Please resubmit.'
    case 'confirmed':
      if (!hasAllPassports(registration, marathon)) {
        return 'Payment received! Upload a photo of your passport bio page, then answer the event questionnaire (if any), to complete your booking.'
      }
      return isBookingComplete(registration, marathon)
        ? "You're all set for this event — see you at the starting line."
        : 'Passport received! Answer the event questionnaire to complete your booking.'
    case 'rejected':
      return registration.adminNote
        ? `Your registration wasn't accepted: ${registration.adminNote} You can join the waitlist again.`
        : "Unfortunately, your registration wasn't accepted this time. You can join the waitlist again."
    case 'cancelled':
      if (registration.transferredTo) return `Your slot was transferred to ${formatTransferParty(registration.transferredTo)}.`
      return "This registration was cancelled. You can join the waitlist again if you've changed your mind."
  }
}

/** Whether the registrant has provided a valid answer. A 'bool' question is always answered — unchecked is a valid "No", not a missing answer. */
export function isQuestionAnswered(question: MarathonQuestion, value: string | undefined) {
  if (question.type === 'bool') return true
  if (question.type === 'int') return (value ?? '').trim() !== '' && !Number.isNaN(Number(value))
  return (value ?? '').trim() !== ''
}

export const DEFAULT_QUESTIONNAIRE_NAME = 'Questionnaire'

export interface Questionnaire {
  name: string
  questions: MarathonQuestion[]
}

/** The marathon's questions grouped into named questionnaires, in authoring order. */
export function getQuestionnaires(marathon: Marathon | undefined): Questionnaire[] {
  const groups = new Map<string, MarathonQuestion[]>()
  for (const question of marathon?.questions ?? []) {
    const name = question.questionnaire?.trim() || DEFAULT_QUESTIONNAIRE_NAME
    groups.set(name, [...(groups.get(name) ?? []), question])
  }
  return [...groups].map(([name, questions]) => ({ name, questions }))
}

export function areRequiredItemsAnswered(marathon: Marathon | undefined, answerValues: Record<string, string>) {
  const items = marathon?.questions ?? []
  return items.filter((item) => item.required).every((item) => isQuestionAnswered(item, answerValues[item.id]))
}

function missingQuestionnaire(runner: RunnerDetails, marathon: Marathon | undefined) {
  const answerValues = answerMap(runner)
  return getQuestionnaires(marathon).find((q) =>
    q.questions.some((item) => item.required && !isQuestionAnswered(item, answerValues[item.id])),
  )?.name
}

/** The first runner still missing a passport (step 'passport') or a required answer (step 'questionnaire', optionally in one named questionnaire). 0 if none. */
export function getNextRunner(
  registration: Registration,
  marathon: Marathon | undefined,
  step: 'passport' | 'questionnaire',
  questionnaireName?: string,
) {
  const index = getRunners(registration, marathon).findIndex((runner) =>
    step === 'passport'
      ? !runner.passportPhotoUrl
      : questionnaireName
        ? getQuestionnaires(marathon)
            .find((q) => q.name === questionnaireName)
            ?.questions.some((item) => item.required && !isQuestionAnswered(item, answerMap(runner)[item.id]))
        : missingQuestionnaire(runner, marathon) != null,
  )
  return Math.max(index, 0)
}

/** The first questionnaire still missing a required answer (for any runner) — what the "Answer …" action names. */
export function getNextQuestionnaire(registration: Registration, marathon: Marathon | undefined) {
  for (const runner of getRunners(registration, marathon)) {
    const name = missingQuestionnaire(runner, marathon)
    if (name) return name
  }
}

/** Every runner's passport bio page uploaded and, if the marathon defines a questionnaire, every required question answered. */
export function hasSubmittedBookingDetails(registration: Registration, marathon: Marathon | undefined) {
  return getRunners(registration, marathon).every(
    (runner) => runner.passportPhotoUrl && areRequiredItemsAnswered(marathon, answerMap(runner)),
  )
}

/** Whether this registration has payment confirmed and its passport/questionnaire submitted. */
export function isBookingComplete(registration: Registration, marathon: Marathon | undefined) {
  return registration.status === 'confirmed' && hasSubmittedBookingDetails(registration, marathon)
}

// The passport/questionnaire update rule in firestore.rules also allows payment_submitted;
// it's left out here so a balance proof under review can still be viewed/replaced in the wizard.
const BOOKING_DETAILS_STATUSES: RegistrationStatus[] = ['deposit_paid', 'final_invoiced', 'payment_rejected', 'confirmed']

/** Deposit approved and the booking still active — passport & questionnaire are due from then on. */
export function isPastDeposit(registration: Registration) {
  return registration.depositPaidAt != null && BOOKING_DETAILS_STATUSES.includes(registration.status)
}

// Mirrors CANCELLABLE_STATUSES in functions/src/cancel-registration.ts — every
// non-terminal status a registrant can still back out of. 'rejected' and
// 'cancelled' are themselves terminal (nothing left to cancel).
const CANCELLABLE_STATUSES: RegistrationStatus[] = [
  'queued',
  'accepted',
  'terms_accepted',
  'payment_submitted',
  'payment_rejected',
  'deposit_paid',
  'final_invoiced',
  'confirmed',
]

export function canCancelRegistration(registration: Registration) {
  return CANCELLABLE_STATUSES.includes(registration.status)
}

// Mirrors the re-registration update rule in firestore.rules: only a
// rejected or self-cancelled registration can be turned back into a fresh
// queue entry via joinQueue() (see features/registrations/api.ts).
const REREGISTERABLE_STATUSES: RegistrationStatus[] = ['rejected', 'cancelled']

export function canReRegister(registration: Registration) {
  return REREGISTERABLE_STATUSES.includes(registration.status)
}

export type PendingActionStep = 'transfer_terms' | 'terms' | 'payment' | 'final_payment' | 'passport' | 'questionnaire'

export const PENDING_ACTION_LABEL: Record<PendingActionStep, string> = {
  transfer_terms: 'Accept Terms & Conditions',
  terms: 'Choose Package & Accept Offer',
  payment: 'View Invoice & Pay',
  final_payment: 'View Final Invoice & Pay',
  passport: 'Upload Passport Bio Page',
  questionnaire: 'Answer Questionnaire',
}

/** What an admin's "Send Reminder" tells the registrant, per pending step. */
export const PENDING_ACTION_REMINDER: Record<PendingActionStep, string> = {
  transfer_terms: 'Please accept the terms & conditions for your booking to continue.',
  terms: "You have an offer waiting — choose your package and accept it before it expires.",
  payment: 'Your deposit is still due — please pay using your invoice and upload your proof of payment.',
  final_payment: 'Your final balance is still due — please pay using your final invoice and upload your proof of payment.',
  passport: 'Please upload a photo of your passport bio page to complete your booking.',
  questionnaire: 'Please answer the event questionnaires to complete your booking.',
}

/** What the registrant still needs to do next, or null if nothing is required of them right now. */
export function getPendingActionStep(
  registration: Registration,
  marathon: Marathon | undefined,
): PendingActionStep | null {
  // A slot transferred in: the new holder accepts the T&C before anything else.
  if (registration.transferTermsAcceptedAt === null && !['rejected', 'cancelled'].includes(registration.status)) {
    return 'transfer_terms'
  }
  if (registration.status === 'accepted') return 'terms'
  if (registration.status === 'terms_accepted') return 'payment'
  // Passport bio page, then the questionnaire, come first once the deposit is approved — before the balance.
  if (isPastDeposit(registration) && !hasAllPassports(registration, marathon)) return 'passport'
  if (isPastDeposit(registration) && !hasSubmittedBookingDetails(registration, marathon)) return 'questionnaire'
  if (registration.status === 'final_invoiced') return 'final_payment'
  if (registration.status === 'payment_rejected') return isOnFinalInvoice(registration) ? 'final_payment' : 'payment'
  return null
}

/**
 * Whether the registrant should still be able to open the registration wizard right now.
 * A strict superset of getPendingActionStep: a submitted-but-not-yet-reviewed proof of
 * payment isn't a "pending action" (nothing is required of the user), but they should
 * still be able to view or replace it before an admin acts on it.
 */
export function canReopenWizard(registration: Registration, marathon: Marathon | undefined) {
  return getPendingActionStep(registration, marathon) != null || registration.status === 'payment_submitted'
}

/** PENDING_ACTION_LABEL, naming the questionnaire due next (e.g. "Answer Health Declaration"). */
export function getPendingActionLabel(
  step: PendingActionStep,
  registration: Registration,
  marathon: Marathon | undefined,
) {
  const questionnaire = step === 'questionnaire' ? getNextQuestionnaire(registration, marathon) : undefined
  return questionnaire ? `Answer ${questionnaire}` : PENDING_ACTION_LABEL[step]
}

/** PENDING_ACTION_REMINDER, naming the questionnaire due next. */
export function getPendingActionReminder(
  step: PendingActionStep,
  registration: Registration,
  marathon: Marathon | undefined,
) {
  if (step === 'terms' && registration.partOf) return 'Your place on this package is waiting — accept your offer to receive your invoice.'
  const questionnaire = step === 'questionnaire' ? getNextQuestionnaire(registration, marathon) : undefined
  return questionnaire
    ? `Please answer the "${questionnaire}" questionnaire to complete your booking.`
    : PENDING_ACTION_REMINDER[step]
}

/** Button label for reopening the wizard, covering the not-a-pending-action case (already submitted, awaiting review). */
export function getWizardButtonLabel(
  step: PendingActionStep | null,
  registration: Registration,
  marathon: Marathon | undefined,
) {
  if (step) return getPendingActionLabel(step, registration, marathon)
  return 'View / Update Proof of Payment'
}
