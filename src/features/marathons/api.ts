import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'

import { db, functions, storage } from '@/firebase/config'
import type { Marathon, MarathonPackage, MarathonQuestion, MarathonStatus } from '@/types'
import type { MarathonRestoreInput } from '@/features/admin/export-import/serialize'

/** A package's description, falling back to its legacy label/value `details` for packages saved before descriptions existed. */
export function getPackageDescription(pkg: MarathonPackage): string {
  return pkg.description ?? (pkg.details ?? []).map((detail) => `${detail.label}: ${detail.value}`).join('\n')
}

/** Splits free text into non-empty, trimmed lines — one bullet each. */
export function toBulletLines(text: string | undefined): string[] {
  return (text ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
}

const marathonsRef = collection(db, 'marathons')

export function subscribeToPublishedMarathons(onData: (marathons: Marathon[]) => void) {
  const q = query(marathonsRef, where('status', '==', 'published'), orderBy('eventDate', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Marathon))
  })
}

export function subscribeToAllMarathons(onData: (marathons: Marathon[]) => void) {
  const q = query(marathonsRef, orderBy('eventDate', 'asc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Marathon))
  })
}

/** One-shot read of every marathon, for admin data export — see subscribeToAllMarathons for why an unfiltered admin query is safe under firestore.rules. */
export async function getAllMarathonsOnce(): Promise<Marathon[]> {
  const snapshot = await getDocs(query(marathonsRef, orderBy('eventDate', 'asc')))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Marathon)
}

export function subscribeToMarathon(marathonId: string, onData: (marathon: Marathon | null) => void) {
  return onSnapshot(doc(db, 'marathons', marathonId), (snapshot) => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Marathon) : null)
  })
}

/** Uploads an admin-selected banner image and returns its public download URL, for use as `MarathonInput.bannerImageUrl`. */
export async function uploadMarathonBanner(file: File): Promise<string> {
  const storageRef = ref(storage, `marathon-banners/${crypto.randomUUID()}-${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/** Uploads an admin-selected package photo and returns its public download URL, for use in `MarathonPackage.photoUrls`. */
export async function uploadMarathonPackagePhoto(file: File): Promise<string> {
  const storageRef = ref(storage, `marathon-packages/${crypto.randomUUID()}-${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/** Uploads an admin-selected standard offer image and returns its public download URL, for use as `MarathonPackage.offerImageUrl`. */
export async function uploadMarathonPackageOffer(file: File): Promise<string> {
  const storageRef = ref(storage, `marathon-package-offers/${crypto.randomUUID()}-${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export interface MarathonInput {
  title: string
  description: string
  bannerImageUrl: string
  location: string
  eventDate: Date
  registrationOpensAt: Date
  registrationClosesAt: Date
  capacity: number
  paymentInstructions: string
  sharedInclusions: string
  packageNotes: string
  hotelDetails: string
  /** Empty string means no hotel image. */
  hotelImageUrl: string
  packages: MarathonPackage[]
  questions: MarathonQuestion[]
  /** null clears an existing deadline; undefined/omitted leaves it unset (create) or untouched (update is not possible this way — pass null to clear). */
  feedDeadline?: Date | null
  /** Same null-clears semantics as feedDeadline. */
  offerAcceptanceDeadline?: Date | null
  /** null clears it. */
  depositDueDays?: number | null
  balanceDeadline?: Date | null
}

export async function createMarathon(input: MarathonInput, createdBy: string) {
  const { feedDeadline, offerAcceptanceDeadline, depositDueDays, balanceDeadline, ...rest } = input
  await addDoc(marathonsRef, {
    ...rest,
    ...(feedDeadline ? { feedDeadline } : {}),
    ...(offerAcceptanceDeadline ? { offerAcceptanceDeadline } : {}),
    ...(depositDueDays ? { depositDueDays } : {}),
    ...(balanceDeadline ? { balanceDeadline } : {}),
    confirmedCount: 0,
    cycle: 1,
    status: 'draft' satisfies MarathonStatus,
    createdBy,
    createdAt: serverTimestamp(),
  })
}

export async function updateMarathon(marathonId: string, input: MarathonInput) {
  const { feedDeadline, offerAcceptanceDeadline, depositDueDays, balanceDeadline, ...rest } = input
  await updateDoc(doc(db, 'marathons', marathonId), {
    ...rest,
    feedDeadline: feedDeadline ?? deleteField(),
    offerAcceptanceDeadline: offerAcceptanceDeadline ?? deleteField(),
    depositDueDays: depositDueDays || deleteField(),
    balanceDeadline: balanceDeadline ?? deleteField(),
  })
}

export async function setMarathonStatus(marathonId: string, status: MarathonStatus) {
  await updateDoc(doc(db, 'marathons', marathonId), { status })
}

const reopenMarathonCallable = httpsCallable<{ marathonId: string }, { newCycle: number; carriedForward: number }>(
  functions,
  'reopenMarathon',
)

/**
 * Starts a fresh registration round on a closed marathon: everyone still queued or
 * mid-pipeline (accepted/terms_accepted/payment_submitted) gets a new queue-scoped
 * registration for the new cycle, in their original order; confirmed/rejected/
 * payment_rejected registrations are left untouched as history. confirmedCount resets
 * to 0 since the new round gets the marathon's full capacity again.
 */
export async function reopenMarathon(marathonId: string) {
  const result = await reopenMarathonCallable({ marathonId })
  return result.data
}

/**
 * Restore-from-backup only: writes the full doc at its original id via setDoc
 * (never addDoc) so existing registrations' marathonId references stay valid.
 * confirmedCount is deliberately not part of this write — it's a server-derived
 * counter (see confirmPayment's transaction) and is always recomputed live by
 * the restore plan after registrations are restored, never trusted from a CSV.
 */
export async function restoreMarathon(input: MarathonRestoreInput) {
  const { id, ...data } = input
  await setDoc(doc(db, 'marathons', id), { ...data, confirmedCount: 0 })
}

/** Restore-from-backup only: overwrites confirmedCount with a freshly recomputed value (see countConfirmedRegistrations) — never with a value taken from a CSV. */
export async function setConfirmedCount(marathonId: string, confirmedCount: number) {
  await updateDoc(doc(db, 'marathons', marathonId), { confirmedCount })
}
