import type { Marathon } from '@/types'

export type MarathonAvailability = 'open' | 'filling' | 'closed'

/** Shared with the Home/Timeline availability filter so its pills classify marathons identically to the card badges. */
export function getMarathonAvailability(marathon: Marathon): MarathonAvailability {
  const spotsLeft = Math.max(marathon.capacity - marathon.confirmedCount, 0)
  const percentFull = marathon.capacity > 0 ? (marathon.confirmedCount / marathon.capacity) * 100 : 0
  const isClosed = new Date() > marathon.registrationClosesAt.toDate()

  if (spotsLeft <= 0 || isClosed) return 'closed'
  if (percentFull >= 75) return 'filling'
  return 'open'
}
