import { countConfirmedRegistrations, restoreRegistrationFields } from '@/features/registrations/api'
import { restoreMarathon, setConfirmedCount } from '@/features/marathons/api'
import { restoreUserProfileFields } from '@/features/auth/api'
import type {
  MarathonRestoreInput,
  MarathonRow,
  RegistrationRestorePatch,
  RegistrationRow,
  UserRestorePatch,
  UserRow,
} from './serialize'
import { rowToMarathonRestoreInput, rowToRegistrationRestorePatch, rowToUserRestorePatch } from './serialize'

export interface RestorePlan {
  marathons: {
    toCreate: MarathonRestoreInput[]
    toUpdate: MarathonRestoreInput[]
  }
  registrations: {
    toUpdate: { id: string; patch: RegistrationRestorePatch }[]
    skippedMissing: string[]
  }
  users: {
    toUpdate: { uid: string; patch: UserRestorePatch }[]
    skippedMissing: string[]
  }
  parseErrors: string[]
}

function emptyPlan(): RestorePlan {
  return {
    marathons: { toCreate: [], toUpdate: [] },
    registrations: { toUpdate: [], skippedMissing: [] },
    users: { toUpdate: [], skippedMissing: [] },
    parseErrors: [],
  }
}

export function buildFullRestorePlan(
  data: { marathonRows: MarathonRow[]; registrationRows: RegistrationRow[]; userRows: UserRow[] },
  existingMarathonIds: Set<string>,
  existingRegistrationIds: Set<string>,
  existingUserIds: Set<string>,
): RestorePlan {
  const plan = emptyPlan()

  for (const row of data.marathonRows) {
    const result = rowToMarathonRestoreInput(row)
    if (!result.ok) {
      plan.parseErrors.push(`marathons.csv row ${row.id || '(no id)'}: ${result.error}`)
      continue
    }
    if (existingMarathonIds.has(result.value.id)) {
      plan.marathons.toUpdate.push(result.value)
    } else {
      plan.marathons.toCreate.push(result.value)
    }
  }

  addRegistrationRows(plan, data.registrationRows, existingRegistrationIds)
  addUserRows(plan, data.userRows, existingUserIds)

  return plan
}

export function buildQueueRestorePlan(
  registrationRows: RegistrationRow[],
  existingRegistrationIds: Set<string>,
): RestorePlan {
  const plan = emptyPlan()
  addRegistrationRows(plan, registrationRows, existingRegistrationIds)
  return plan
}

function addRegistrationRows(plan: RestorePlan, rows: RegistrationRow[], existingIds: Set<string>) {
  for (const row of rows) {
    const result = rowToRegistrationRestorePatch(row)
    if (!result.ok) {
      plan.parseErrors.push(`registrations.csv row ${row.id || '(no id)'}: ${result.error}`)
      continue
    }
    if (existingIds.has(row.id)) {
      plan.registrations.toUpdate.push({ id: row.id, patch: result.value })
    } else {
      plan.registrations.skippedMissing.push(row.id)
    }
  }
}

function addUserRows(plan: RestorePlan, rows: UserRow[], existingIds: Set<string>) {
  for (const row of rows) {
    const result = rowToUserRestorePatch(row)
    if (!result.ok) {
      plan.parseErrors.push(`users.csv row ${row.uid || '(no uid)'}: ${result.error}`)
      continue
    }
    if (existingIds.has(row.uid)) {
      plan.users.toUpdate.push({ uid: row.uid, patch: result.value })
    } else {
      plan.users.skippedMissing.push(row.uid)
    }
  }
}

export interface RestoreResult {
  marathonsWritten: number
  registrationsWritten: number
  usersWritten: number
  marathonsRecounted: number
}

/**
 * Applies a previously-previewed restore plan. Writes marathons and users first,
 * then registrations, then recomputes confirmedCount for every marathon touched
 * either directly (restored marathon rows) or indirectly (restored registrations
 * referencing it) — confirmedCount is never trusted verbatim from a CSV, only
 * ever derived live from actual confirmed registrations (see countConfirmedRegistrations).
 */
export async function applyRestorePlan(plan: RestorePlan): Promise<RestoreResult> {
  const touchedMarathonIds = new Set<string>()

  for (const input of [...plan.marathons.toCreate, ...plan.marathons.toUpdate]) {
    await restoreMarathon(input)
    touchedMarathonIds.add(input.id)
  }

  for (const { uid, patch } of plan.users.toUpdate) {
    await restoreUserProfileFields(uid, patch)
  }

  for (const { id, patch } of plan.registrations.toUpdate) {
    await restoreRegistrationFields(id, patch)
    touchedMarathonIds.add(patch.marathonId)
  }

  for (const marathonId of touchedMarathonIds) {
    const confirmedCount = await countConfirmedRegistrations(marathonId)
    await setConfirmedCount(marathonId, confirmedCount)
  }

  return {
    marathonsWritten: plan.marathons.toCreate.length + plan.marathons.toUpdate.length,
    registrationsWritten: plan.registrations.toUpdate.length,
    usersWritten: plan.users.toUpdate.length,
    marathonsRecounted: touchedMarathonIds.size,
  }
}
