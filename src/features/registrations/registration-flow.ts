import type { Marathon, MarathonQuestion, Registration, RegistrationStatus } from '@/types'

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

/** Flagged by flagOverdueRegistrations and still sitting in the status it went overdue in. */
export function isOverdue(registration: Registration) {
  return registration.overdueStatus === registration.status
}

export function getRegistrationStatusMessage(registration: Registration) {
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
      return "Deposit received — your slot is locked in. We'll go over add-ons with you in this booking's messages, then send your final invoice."
    case 'final_invoiced':
      return 'Your final invoice is ready. Review it, accept the terms & conditions, and upload your proof of payment for the balance.'
    case 'payment_rejected':
      return registration.adminNote
        ? `Your payment proof was rejected: ${registration.adminNote} Please resubmit.`
        : 'Your payment proof was rejected. Please resubmit.'
    case 'confirmed':
      return "You're all set for this event — see you at the starting line."
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

export function areRequiredItemsAnswered(marathon: Marathon | undefined, answerValues: Record<string, string>) {
  const items = marathon?.questions ?? []
  return items.filter((item) => item.required).every((item) => isQuestionAnswered(item, answerValues[item.id]))
}

/** Whether this registration has payment confirmed and, if the marathon defines a questionnaire, has answered every required question. */
export function isConfirmedAndQuestionnaireComplete(registration: Registration, marathon: Marathon | undefined) {
  if (registration.status !== 'confirmed') return false
  const answerValues = Object.fromEntries((registration.answers ?? []).map((a) => [a.questionId, a.value]))
  return areRequiredItemsAnswered(marathon, answerValues)
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

export type PendingActionStep = 'terms' | 'payment' | 'final_payment'

export const PENDING_ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Choose Package & Accept Offer',
  payment: 'View Invoice & Pay',
  final_payment: 'View Final Invoice & Pay',
}

/** What the registrant still needs to do next, or null if nothing is required of them right now. */
export function getPendingActionStep(
  registration: Registration,
  _marathon: Marathon | undefined,
): PendingActionStep | null {
  if (registration.status === 'accepted') return 'terms'
  if (registration.status === 'final_invoiced') return 'final_payment'
  if (registration.status === 'payment_rejected') return isOnFinalInvoice(registration) ? 'final_payment' : 'payment'
  if (registration.status === 'terms_accepted') return 'payment'
  return null
}

/**
 * Whether the registrant should still be able to open the registration wizard right now.
 * A strict superset of getPendingActionStep: a submitted-but-not-yet-reviewed proof of
 * payment isn't a "pending action" (nothing is required of the user), but they should
 * still be able to view or replace it before an admin acts on it.
 */
export function canReopenWizard(registration: Registration) {
  return getPendingActionStep(registration, undefined) != null || registration.status === 'payment_submitted'
}

/** Button label for reopening the wizard, covering the not-a-pending-action case (already submitted, awaiting review). */
export function getWizardButtonLabel(step: PendingActionStep | null) {
  if (step) return PENDING_ACTION_LABEL[step]
  return 'View / Update Proof of Payment'
}
