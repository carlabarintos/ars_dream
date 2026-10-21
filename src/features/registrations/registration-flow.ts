import type { InvoiceLineItem, Marathon, MarathonQuestion, Registration, RegistrationStatus } from '@/types'

/** Whether a package has been picked yet — waitlist entries have none until the offer is accepted. */
export function hasChosenPackage(registration: Registration) {
  return registration.packageId !== ''
}

/** The packages the registrant may pick from when accepting their offer. Legacy offers (no `offeredPackageIds`) were made on the package chosen at join time. */
export function getOfferedPackages(registration: Registration, marathon: Marathon | undefined) {
  const ids = registration.offeredPackageIds ?? [registration.packageId]
  return (marathon?.packages ?? []).filter((pkg) => ids.includes(pkg.id))
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
  const total = getRegistrationTotalAmount(registration)
  const depositAmount = marathon?.packages?.find((p) => p.id === registration.packageId)?.depositAmount
  return Math.min(depositAmount ?? total, total)
}

/** Flagged by flagOverdueRegistrations and still sitting in the status it went overdue in. */
export function isOverdue(registration: Registration) {
  return registration.overdueStatus === registration.status
}

export function getRegistrationStatusMessage(registration: Registration, marathon: Marathon | undefined) {
  if (isOverdue(registration)) {
    if (registration.status === 'accepted') {
      return 'Overdue: the window to accept your offer has passed. Accept it now — your slot may be cancelled otherwise.'
    }
    return registration.status === 'final_invoiced'
      ? 'Overdue: your final invoice due date has passed. Pay your balance and upload your proof now — your slot may be cancelled otherwise.'
      : 'Overdue: your deposit due date has passed. Submit your proof of payment now — your slot may be cancelled otherwise.'
  }
  switch (registration.status) {
    case 'queued':
      return "You're on the waitlist. We'll notify you once a spot opens up and we have packages to offer you."
    case 'accepted':
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
      if (!registration.passportPhotoUrl) {
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

/** The first questionnaire still missing a required answer — what the "Answer …" action names. */
export function getNextQuestionnaire(registration: Registration, marathon: Marathon | undefined) {
  const answerValues = Object.fromEntries((registration.answers ?? []).map((a) => [a.questionId, a.value]))
  return getQuestionnaires(marathon).find((q) =>
    q.questions.some((item) => item.required && !isQuestionAnswered(item, answerValues[item.id])),
  )?.name
}

/** Passport bio page uploaded and, if the marathon defines a questionnaire, every required question answered. */
export function hasSubmittedBookingDetails(registration: Registration, marathon: Marathon | undefined) {
  if (!registration.passportPhotoUrl) return false
  const answerValues = Object.fromEntries((registration.answers ?? []).map((a) => [a.questionId, a.value]))
  return areRequiredItemsAnswered(marathon, answerValues)
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

export type PendingActionStep = 'terms' | 'payment' | 'final_payment' | 'passport' | 'questionnaire'

export const PENDING_ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Choose Package & Accept Offer',
  payment: 'View Invoice & Pay',
  final_payment: 'View Final Invoice & Pay',
  passport: 'Upload Passport Bio Page',
  questionnaire: 'Answer Questionnaire',
}

/** What an admin's "Send Reminder" tells the registrant, per pending step. */
export const PENDING_ACTION_REMINDER: Record<PendingActionStep, string> = {
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
  if (registration.status === 'accepted') return 'terms'
  if (registration.status === 'terms_accepted') return 'payment'
  // Passport bio page, then the questionnaire, come first once the deposit is approved — before the balance.
  if (isPastDeposit(registration) && !registration.passportPhotoUrl) return 'passport'
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
