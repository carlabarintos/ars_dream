import { Timestamp } from 'firebase/firestore'

import type {
  Gender,
  Marathon,
  MarathonPackage,
  MarathonQuestion,
  MarathonStatus,
  QuestionAnswer,
  Registration,
  RegistrationStatus,
  SelectedAddOn,
  UserProfile,
  UserRole,
} from '@/types'

export type RowResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isoOf(ts: Timestamp) {
  return ts.toDate().toISOString()
}

function isoOfNullable(ts: Timestamp | null) {
  return ts ? isoOf(ts) : ''
}

function parseIso(value: string, field: string): Timestamp {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Missing required date "${field}"`)
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date "${field}": ${value}`)
  return Timestamp.fromDate(date)
}

function parseIsoNullable(value: string, field: string): Timestamp | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date "${field}": ${value}`)
  return Timestamp.fromDate(date)
}

function parseJsonArray<T>(value: string, field: string): T[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed as T[]
  } catch {
    throw new Error(`Invalid JSON in "${field}"`)
  }
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key]
  }
  return result
}

function tryParse<T>(fn: () => T): RowResult<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown parse error' }
  }
}

// ---------- Marathons ----------

export const MARATHON_COLUMNS = [
  'id',
  'title',
  'description',
  'bannerImageUrl',
  'location',
  'eventDate',
  'registrationOpensAt',
  'registrationClosesAt',
  'capacity',
  'confirmedCount',
  'paymentInstructions',
  'packagesJson',
  'questionsJson',
  'status',
  'cycle',
  'createdBy',
  'createdAt',
] as const

export type MarathonRow = Record<(typeof MARATHON_COLUMNS)[number], string>

export interface MarathonRestoreInput {
  id: string
  title: string
  description: string
  bannerImageUrl: string
  location: string
  eventDate: Timestamp
  registrationOpensAt: Timestamp
  registrationClosesAt: Timestamp
  capacity: number
  paymentInstructions: string
  packages: MarathonPackage[]
  questions: MarathonQuestion[]
  status: MarathonStatus
  cycle: number
  createdBy: string
  createdAt: Timestamp
}

export function marathonToRow(marathon: Marathon): MarathonRow {
  return {
    id: marathon.id,
    title: marathon.title,
    description: marathon.description,
    bannerImageUrl: marathon.bannerImageUrl,
    location: marathon.location,
    eventDate: isoOf(marathon.eventDate),
    registrationOpensAt: isoOf(marathon.registrationOpensAt),
    registrationClosesAt: isoOf(marathon.registrationClosesAt),
    capacity: String(marathon.capacity),
    confirmedCount: String(marathon.confirmedCount),
    paymentInstructions: marathon.paymentInstructions,
    packagesJson: JSON.stringify(marathon.packages ?? []),
    questionsJson: JSON.stringify(marathon.questions ?? []),
    status: marathon.status,
    cycle: String(marathon.cycle ?? 1),
    createdBy: marathon.createdBy,
    createdAt: isoOf(marathon.createdAt),
  }
}

export function rowToMarathonRestoreInput(row: MarathonRow): RowResult<MarathonRestoreInput> {
  return tryParse(() => ({
    id: row.id,
    title: row.title,
    description: row.description,
    bannerImageUrl: row.bannerImageUrl,
    location: row.location,
    eventDate: parseIso(row.eventDate, 'eventDate'),
    registrationOpensAt: parseIso(row.registrationOpensAt, 'registrationOpensAt'),
    registrationClosesAt: parseIso(row.registrationClosesAt, 'registrationClosesAt'),
    capacity: Number(row.capacity),
    paymentInstructions: row.paymentInstructions,
    packages: parseJsonArray<MarathonPackage>(row.packagesJson, 'packagesJson'),
    questions: parseJsonArray<MarathonQuestion>(row.questionsJson, 'questionsJson'),
    status: row.status as MarathonStatus,
    cycle: row.cycle.trim() === '' ? 1 : Number(row.cycle),
    createdBy: row.createdBy,
    createdAt: parseIso(row.createdAt, 'createdAt'),
  }))
}

// ---------- Registrations ----------

export const REGISTRATION_COLUMNS = [
  'id',
  'userId',
  'marathonId',
  'packageId',
  'packageName',
  'packagePriceAmount',
  'packagePriceCurrency',
  'selectedAddOnsJson',
  'status',
  'queuePosition',
  'termsAcceptedAt',
  'answersJson',
  'proofSubmittedAt',
  'adminNote',
  'cancelledAt',
  'cycle',
  'createdAt',
  'updatedAt',
] as const

export type RegistrationRow = Record<(typeof REGISTRATION_COLUMNS)[number], string>

export interface RegistrationRestorePatch {
  userId: string
  marathonId: string
  packageId: string
  packageName: string
  packagePriceAmount: number
  packagePriceCurrency: string
  selectedAddOns: SelectedAddOn[]
  status: RegistrationStatus
  queuePosition: number | null
  termsAcceptedAt: Timestamp | null
  answers: QuestionAnswer[]
  proofSubmittedAt: Timestamp | null
  adminNote: string | null
  cancelledAt: Timestamp | null
  cycle: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export function registrationToRow(registration: Registration): RegistrationRow {
  return {
    id: registration.id,
    userId: registration.userId,
    marathonId: registration.marathonId,
    packageId: registration.packageId,
    packageName: registration.packageName,
    packagePriceAmount: String(registration.packagePriceAmount),
    packagePriceCurrency: registration.packagePriceCurrency,
    selectedAddOnsJson: JSON.stringify(registration.selectedAddOns ?? []),
    status: registration.status,
    queuePosition: registration.queuePosition == null ? '' : String(registration.queuePosition),
    termsAcceptedAt: isoOfNullable(registration.termsAcceptedAt),
    answersJson: JSON.stringify(registration.answers ?? []),
    proofSubmittedAt: isoOfNullable(registration.proofSubmittedAt),
    adminNote: registration.adminNote ?? '',
    cancelledAt: isoOfNullable(registration.cancelledAt ?? null),
    cycle: String(registration.cycle ?? 1),
    createdAt: isoOf(registration.createdAt),
    updatedAt: isoOf(registration.updatedAt),
  }
}

export function rowToRegistrationRestorePatch(row: RegistrationRow): RowResult<RegistrationRestorePatch> {
  return tryParse(() => ({
    userId: row.userId,
    marathonId: row.marathonId,
    packageId: row.packageId,
    packageName: row.packageName,
    packagePriceAmount: Number(row.packagePriceAmount),
    packagePriceCurrency: row.packagePriceCurrency,
    selectedAddOns: parseJsonArray<SelectedAddOn>(row.selectedAddOnsJson, 'selectedAddOnsJson'),
    status: row.status as RegistrationStatus,
    queuePosition: row.queuePosition.trim() === '' ? null : Number(row.queuePosition),
    termsAcceptedAt: parseIsoNullable(row.termsAcceptedAt, 'termsAcceptedAt'),
    answers: parseJsonArray<QuestionAnswer>(row.answersJson, 'answersJson'),
    proofSubmittedAt: parseIsoNullable(row.proofSubmittedAt, 'proofSubmittedAt'),
    adminNote: row.adminNote.trim() === '' ? null : row.adminNote,
    cancelledAt: parseIsoNullable(row.cancelledAt, 'cancelledAt'),
    cycle: row.cycle.trim() === '' ? 1 : Number(row.cycle),
    createdAt: parseIso(row.createdAt, 'createdAt'),
    updatedAt: parseIso(row.updatedAt, 'updatedAt'),
  }))
}

// ---------- Users ----------

export const USER_COLUMNS = [
  'uid',
  'displayName',
  'email',
  'photoURL',
  'role',
  'firstName',
  'middleName',
  'lastName',
  'contactNumber',
  'dateOfBirth',
  'gender',
  'createdAt',
] as const

export type UserRow = Record<(typeof USER_COLUMNS)[number], string>

export interface UserRestorePatch {
  displayName: string | null
  email: string | null
  photoURL: string | null
  role: UserRole
  createdAt: Timestamp
  firstName?: string
  middleName?: string | null
  lastName?: string
  contactNumber?: string
  dateOfBirth?: string
  gender?: Gender
}

export function userToRow(profile: UserProfile): UserRow {
  return {
    uid: profile.uid,
    displayName: profile.displayName ?? '',
    email: profile.email ?? '',
    photoURL: profile.photoURL ?? '',
    role: profile.role,
    firstName: profile.firstName ?? '',
    middleName: profile.middleName ?? '',
    lastName: profile.lastName ?? '',
    contactNumber: profile.contactNumber ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    gender: profile.gender ?? '',
    createdAt: isoOf(profile.createdAt),
  }
}

export function rowToUserRestorePatch(row: UserRow): RowResult<UserRestorePatch> {
  return tryParse(() => {
    const hasProfileFields = row.firstName.trim() !== '' || row.lastName.trim() !== ''
    return {
      displayName: row.displayName.trim() === '' ? null : row.displayName,
      email: row.email.trim() === '' ? null : row.email,
      photoURL: row.photoURL.trim() === '' ? null : row.photoURL,
      role: row.role as UserRole,
      createdAt: parseIso(row.createdAt, 'createdAt'),
      firstName: emptyToUndefined(row.firstName),
      middleName: hasProfileFields ? (row.middleName.trim() === '' ? null : row.middleName) : undefined,
      lastName: emptyToUndefined(row.lastName),
      contactNumber: emptyToUndefined(row.contactNumber),
      dateOfBirth: emptyToUndefined(row.dateOfBirth),
      gender: emptyToUndefined(row.gender) as Gender | undefined,
    }
  })
}

export function userRestorePatchToUpdateDoc(patch: UserRestorePatch): Record<string, unknown> {
  return stripUndefined(patch as unknown as Record<string, unknown>)
}

// ---------- Queue export (registrations joined with registrant profile, read-only) ----------

export const QUEUE_JOIN_COLUMNS = [
  'userDisplayName',
  'userEmail',
  'userFirstName',
  'userMiddleName',
  'userLastName',
  'userContactNumber',
] as const

export const QUEUE_ROW_COLUMNS = [...REGISTRATION_COLUMNS, ...QUEUE_JOIN_COLUMNS] as const

export type QueueRow = RegistrationRow & Record<(typeof QUEUE_JOIN_COLUMNS)[number], string>

export function queueRowFromJoin(registration: Registration, profile: UserProfile | undefined): QueueRow {
  return {
    ...registrationToRow(registration),
    userDisplayName: profile?.displayName ?? '',
    userEmail: profile?.email ?? '',
    userFirstName: profile?.firstName ?? '',
    userMiddleName: profile?.middleName ?? '',
    userLastName: profile?.lastName ?? '',
    userContactNumber: profile?.contactNumber ?? '',
  }
}
