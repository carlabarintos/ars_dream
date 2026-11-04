/** Seats a package takes, e.g. 2 for "Runner + Runner" (MarathonPackage.runnerCount, absent means 1). */
export function packageSeats(marathon: FirebaseFirestore.DocumentData | undefined, packageId: string): number {
  return ((marathon?.packages ?? []) as { id: string; runnerCount?: number }[]).find((p) => p.id === packageId)?.runnerCount ?? 1
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
 * or '' if none did. First-time entries (nothing there before) aren't changes.
 */
export function describeCompanionChanges(before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData) {
  type Contact = { name?: string; email?: string }
  const describe = (c: Contact) => [c.name, c.email && `(${c.email})`].filter(Boolean).join(' ')
  const prev = (before.companions ?? []) as Contact[]
  return ((after.companions ?? []) as Contact[])
    .map((c, i) => {
      const p = prev[i] ?? {}
      if (!(p.name || p.email) || (p.name === c.name && p.email === c.email)) return ''
      return `Runner ${i + 2}: ${describe(p)} → ${describe(c)}`
    })
    .filter(Boolean)
    .join('; ')
}
