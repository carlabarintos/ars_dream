import type { MarathonPackage, MarathonPackageAddOn, Registration } from '@/types'

type Row = Pick<Registration, 'id' | 'partOf'>

const packageId = (row: Row) => row.partOf?.registrationId ?? row.id

export const samePackage = (a: Row | undefined, b: Row | undefined) => !!a && !!b && packageId(a) === packageId(b)

/** Rows sharing a multi-runner package gathered together, Runner 1 first, in the order each package first appears. A booking on its own is a group of one. */
export function groupByPackage<T extends Row>(rows: T[]): T[][] {
  const packages = new Map<string, T[]>()
  for (const row of rows) packages.set(packageId(row), [...(packages.get(packageId(row)) ?? []), row])
  return [...packages.values()].map((group) => group.sort((a, b) => (a.partOf?.runner ?? 1) - (b.partOf?.runner ?? 1)))
}

/** What taking this runner off a package does on its own, or 'choose' when they've started paying and an admin must pick a package for them. */
export function runnerRemovalOutcome(booking: Pick<Registration, 'status' | 'partOf' | 'finalInvoice'> | null) {
  if (!booking) return 'invite'
  if (booking.partOf?.previousPackage && !booking.finalInvoice) return 'restored'
  if (!['accepted', 'terms_accepted'].includes(booking.status) || booking.partOf?.previousPackage) return 'choose'
  return booking.partOf?.hadOwnPlace ? 'waitlist' : 'cancelled'
}

/** The add-ons a booking keeps on moving to `pkg`: those it already has that exist there, plus any mandatory ones. */
export function addOnsOnPackage(registration: Pick<Registration, 'selectedAddOns'>, pkg: Pick<MarathonPackage, 'addOns'>): MarathonPackageAddOn[] {
  const current = (registration.selectedAddOns ?? []).map((addOn) => addOn.addOnId)
  return (pkg.addOns ?? []).filter((addOn) => addOn.mandatory || current.includes(addOn.id))
}
