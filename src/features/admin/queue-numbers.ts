import type { Registration } from '@/types'

/** createdAt is when they last joined the waitlist: rejoining resets it. A write still in flight has no time yet. */
function waitlistMillis(registration: Registration) {
  return registration.createdAt?.toMillis() ?? Date.now()
}

/**
 * Queue number per registration id: one marathon round's bookings ranked by last waitlist time, 1 = earliest.
 * Runner 2 and slot-transfer bookings never joined the waitlist themselves, so they get none.
 */
export function getQueueNumbers(registrations: Registration[]) {
  const waitlisted = registrations
    .filter((r) => !r.transferredFrom && (!r.partOf || r.partOf.hadOwnPlace))
    .sort((a, b) => waitlistMillis(a) - waitlistMillis(b) || a.id.localeCompare(b.id))
  return new Map(waitlisted.map((r, index) => [r.id, index + 1]))
}
