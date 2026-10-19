import type { Marathon, MarathonQuestion, Registration, RegistrationStatus } from '@/types'

/** Whether the registrant's previously-selected package no longer exists for this round and they need to pick a new one to keep their queue spot (see reopenMarathon). */
export function needsPackageUpdate(registration: Registration) {
  return registration.packageUpdateRequired === true
}

/** Package base price plus any selected add-ons — the actual amount the registrant owes. */
export function getRegistrationTotalAmount(registration: Registration) {
  const addOnsTotal = (registration.selectedAddOns ?? []).reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  return registration.packagePriceAmount + addOnsTotal
}

export function getRegistrationStatusMessage(registration: Registration) {
  switch (registration.status) {
    case 'queued':
      if (needsPackageUpdate(registration)) {
        return 'The package you previously selected is no longer offered for this round. Choose a new package below to keep your spot in the queue.'
      }
      return "You're in the waiting list. We'll notify you once a spot opens up."
    case 'accepted':
      return "You've received an offer! Review and accept it to receive your invoice."
    case 'terms_accepted':
      return 'Your invoice is ready. Pay your deposit using the instructions provided, then upload your proof of payment.'
    case 'payment_submitted':
      return "Your payment is under review. We'll notify you once it's confirmed."
    case 'payment_rejected':
      return registration.adminNote
        ? `Your payment proof was rejected: ${registration.adminNote} Please resubmit.`
        : 'Your payment proof was rejected. Please resubmit.'
    case 'confirmed':
      return "You're all set for this event — see you at the starting line."
    case 'rejected':
      return registration.adminNote
        ? `Your registration wasn't accepted: ${registration.adminNote} You can register again below.`
        : "Unfortunately, your registration wasn't accepted this time. You can register again below."
    case 'cancelled':
      return "You've cancelled this registration. You can register again below if you've changed your mind."
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

// Mirrors the package-swap update rule in firestore.rules: a registrant may
// still change their selected package on their existing queue entry up
// through a rejected payment, but not once a payment is submitted/confirmed
// — from there, changing packages goes through an admin instead.
const PACKAGE_EDITABLE_STATUSES: RegistrationStatus[] = ['queued', 'accepted', 'terms_accepted', 'payment_rejected']

export function canChangePackage(registration: Registration) {
  return PACKAGE_EDITABLE_STATUSES.includes(registration.status)
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

export type PendingActionStep = 'terms' | 'payment'

export const PENDING_ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Accept Offer',
  payment: 'View Invoice & Pay',
}

/** What the registrant still needs to do next, or null if nothing is required of them right now. */
export function getPendingActionStep(
  registration: Registration,
  _marathon: Marathon | undefined,
): PendingActionStep | null {
  if (registration.status === 'accepted') return 'terms'
  if (registration.status === 'terms_accepted' || registration.status === 'payment_rejected') return 'payment'
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
