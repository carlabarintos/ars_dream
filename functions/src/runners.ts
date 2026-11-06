import { db } from './admin.js'

/** Seats a package takes, e.g. 2 for "Runner + Runner" (MarathonPackage.runnerCount, absent means 1). */
export function packageSeats(marathon: FirebaseFirestore.DocumentData | undefined, packageId: string): number {
  return ((marathon?.packages ?? []) as { id: string; runnerCount?: number }[]).find((p) => p.id === packageId)?.runnerCount ?? 1
}

/** The package's other live bookings, read in a transaction so seats can't be counted from a stale view. */
export async function otherRunners(
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  booking: FirebaseFirestore.DocumentData,
) {
  const leadId: string = booking.partOf?.registrationId ?? ref.id
  const registrations = db.collection('registrations')
  const links = await transaction.get(db.collection('runnerBookings').where('registrationId', '==', leadId))
  const refs = [
    registrations.doc(leadId),
    ...links.docs
      .map((doc) => doc.data())
      .filter((link) => link.userId)
      .map((link) => registrations.doc(`${link.userId}_${link.marathonId}_${link.cycle}`)),
  ].filter((other) => other.id !== ref.id)
  const snaps = await Promise.all(refs.map((other) => transaction.get(other)))
  return refs
    .map((other, i) => ({ ref: other, data: snaps[i].data() }))
    .filter(({ ref: other, data }) => data && (other.id === leadId || data.partOf?.registrationId === leadId))
    .map(({ ref: other, data }) => ({ ref: other, data: data! }))
    .filter(({ data }) => !['rejected', 'cancelled'].includes(data.status))
}

/**
 * The seats a deposit takes. The first deposit on a multi-runner package takes every runner's seat, held on that booking
 * (`seatCount`), so the free spots are right from the first payment and no other runner can be left without one. A later
 * runner's deposit takes one over from that hold, so `take` is 0. If the hold has been given up, it takes a fresh seat.
 */
export async function planSeats(
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  booking: FirebaseFirestore.DocumentData,
  marathon: FirebaseFirestore.DocumentData | undefined,
) {
  const seats = packageSeats(marathon, booking.packageId)
  if (seats === 1) return { take: 1, seatCount: 1 }
  const paid = (await otherRunners(transaction, ref, booking)).filter(({ data }) => data.depositPaidAt)
  const holder = paid.find(({ data }) => ((data.seatCount as number | undefined) ?? 1) > 1)
  if (holder) return { take: 0, seatCount: 1, holder }
  return paid.length > 0 ? { take: 1, seatCount: 1 } : { take: seats, seatCount: seats }
}

export interface RunnerContact {
  /** 2-based runner number ("Runner 2"). */
  runner: number
  name: string
  email: string
}

/**
 * Runners 2+ the lead entered (Registration.companions), CC'd on the booking's emails (see notifyUser's `runners`) so
 * they also get the T&C, passport and payment notices. Capped at the package's runner count so extra entries can't be
 * added to the CC.
 */
export function companionContacts(
  registration: FirebaseFirestore.DocumentData,
  marathon: FirebaseFirestore.DocumentData | undefined,
): RunnerContact[] {
  return ((registration.companions ?? []) as { name?: unknown; email?: unknown }[])
    .slice(0, packageSeats(marathon, registration.packageId) - 1)
    .map((c, i) => ({
      runner: i + 2,
      name: typeof c.name === 'string' ? c.name.trim() : '',
      email: typeof c.email === 'string' ? c.email.trim() : '',
    }))
    .filter((c) => /^\S+@\S+\.\S+$/.test(c.email))
}

/**
 * "Runner 2: Maria Santos (maria@x.com) → Maria Cruz (maria.cruz@x.com)" for each companion whose name/email changed,
 * or '' if none did. First-time entries (nothing there before) only count when an admin made them.
 */
export function describeCompanionChanges(before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) {
  type Contact = { name?: string; email?: string }
  const describe = (c: Contact) => [c.name, c.email && `(${c.email})`].filter(Boolean).join(' ')
  const prev = (before.companions ?? []) as Contact[]
  const next = (after.companions ?? []) as Contact[]
  const removed =
    next.length < prev.length
      ? prev.flatMap((c, i) => (next.some((n) => n.email === c.email) ? [] : [`Runner ${i + 2} removed: ${describe(c)}`]))
      : []
  return next
    .map((c, i) => {
      const p = prev[i] ?? {}
      const isFirstEntry = !(p.name || p.email)
      // Someone already on the package who moved up a slot hasn't changed.
      if (prev.some((other, j) => j !== i && other.email === c.email)) return ''
      if ((isFirstEntry && after.companionsEditedBy !== 'admin') || (p.name === c.name && p.email === c.email)) return ''
      return `Runner ${i + 2}: ${isFirstEntry ? 'added' : describe(p)} → ${describe(c)}`
    })
    .concat(removed)
    .filter(Boolean)
    .join('; ')
}
