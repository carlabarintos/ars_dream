import type { Marathon } from '@/types'

export type MarathonAvailability = 'open' | 'filling' | 'closed'

/** Shared badge copy for a marathon's availability — used by MarathonCard and PackageSelectionPage so both render the exact same pill. */
export const AVAILABILITY_PILL: Record<
  MarathonAvailability,
  { label: string; variant: 'success' | 'warning' | 'secondary' }
> = {
  open: { label: 'Open', variant: 'success' },
  filling: { label: 'Filling Up', variant: 'warning' },
  closed: { label: 'Closed', variant: 'secondary' },
}

/** Shared with the Home/Timeline availability filter so its pills classify marathons identically to the card badges. */
export function getMarathonAvailability(marathon: Marathon): MarathonAvailability {
  const spotsLeft = Math.max(marathon.capacity - marathon.confirmedCount, 0)
  const percentFull = marathon.capacity > 0 ? (marathon.confirmedCount / marathon.capacity) * 100 : 0
  const isClosed = !!marathon.registrationClosesAt && new Date() > marathon.registrationClosesAt.toDate()

  if (spotsLeft <= 0 || isClosed) return 'closed'
  if (percentFull >= 75) return 'filling'
  return 'open'
}
