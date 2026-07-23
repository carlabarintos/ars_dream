import type { Marathon, MarathonQuestion, Registration } from '@/types'

export function getRegistrationStatusMessage(registration: Registration) {
  switch (registration.status) {
    case 'queued':
      return registration.queuePosition != null
        ? `You're #${registration.queuePosition} in the waiting list. We'll notify you once a spot opens up.`
        : "You're in the waiting list. We'll notify you once a spot opens up."
    case 'accepted':
      return "You've been accepted! Review and accept the terms & conditions to continue."
    case 'terms_accepted':
      return 'Send payment using the instructions provided, then upload your proof of payment.'
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
        ? `Your registration wasn't accepted: ${registration.adminNote}`
        : "Unfortunately, your registration wasn't accepted this time."
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

export type PendingActionStep = 'terms' | 'payment'

export const PENDING_ACTION_LABEL: Record<PendingActionStep, string> = {
  terms: 'Accept Terms & Conditions',
  payment: 'Submit Proof of Payment',
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
