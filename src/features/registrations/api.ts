import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'

import { db, functions, storage } from '@/firebase/config'
import type { MarathonPackage, MarathonPackageAddOn, QuestionAnswer, Registration, SelectedAddOn } from '@/types'
import type { RegistrationRestorePatch } from '@/features/admin/export-import/serialize'
import { canChangePackage, canReRegister } from '@/features/registrations/registration-flow'

const registrationsRef = collection(db, 'registrations')

export function subscribeToUserRegistrations(userId: string, onData: (regs: Registration[]) => void) {
  const q = query(registrationsRef, where('userId', '==', userId))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration))
  })
}

export function subscribeToMarathonRegistrations(
  marathonId: string,
  status: Registration['status'] | Registration['status'][],
  onData: (regs: Registration[]) => void,
) {
  const statuses = Array.isArray(status) ? status : [status]
  const q = query(
    registrationsRef,
    where('marathonId', '==', marathonId),
    where('status', 'in', statuses),
  )
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration))
  })
}

/**
 * Every confirmed registration across every marathon, for the revenue report. Safe as
 * an unfiltered query for 'finance' role too — firestore.rules grants that role read
 * access to registrations exactly when status == 'confirmed', matching this query's
 * own filter (see subscribeToAllMarathons for the same admin-query pattern).
 */
export function subscribeToConfirmedRegistrations(onData: (regs: Registration[]) => void) {
  const q = query(registrationsRef, where('status', '==', 'confirmed'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration))
  })
}

/** One-shot read of every registration across every marathon, for admin data export — no equivalent live-query exists elsewhere since every other read here is scoped by marathonId or userId. Safe as an unfiltered admin query for the same reason subscribeToAllMarathons is (see that function's comment). */
export async function getAllRegistrationsOnce(): Promise<Registration[]> {
  const snapshot = await getDocs(registrationsRef)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration)
}

/**
 * A registration's id is deterministic — `${userId}_${marathonId}_${cycle}` — so a
 * repeat join against the same marathon/cycle always resolves to the same doc
 * (see firestore.rules) instead of ever being able to create a duplicate one.
 */
function registrationId(userId: string, marathonId: string, cycle: number) {
  return `${userId}_${marathonId}_${cycle}`
}

function toSelectedAddOns(addOns: MarathonPackageAddOn[]): SelectedAddOn[] {
  return addOns.map((addOn) => ({ addOnId: addOn.id, name: addOn.name, priceAmount: addOn.priceAmount }))
}

export async function joinQueue(
  userId: string,
  marathonId: string,
  selectedPackage: MarathonPackage,
  selectedAddOns: MarathonPackageAddOn[],
  cycle: number,
) {
  const registrationRef = doc(db, 'registrations', registrationId(userId, marathonId, cycle))
  const existingSnap = await getDoc(registrationRef)

  if (existingSnap.exists()) {
    const existing = existingSnap.data() as Registration

    if (canReRegister(existing)) {
      // Re-registering after a rejection/cancellation resets this same doc
      // back to a fresh queue entry — see the re-registration rule in
      // firestore.rules. createdAt is reset to now so onRegistrationQueueChange
      // (which orders the queue by createdAt asc) places them at the BACK of
      // the queue, not wherever their original, already-resolved join time
      // would have put them.
      await updateDoc(registrationRef, {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        packagePriceAmount: selectedPackage.priceAmount,
        packagePriceCurrency: selectedPackage.priceCurrency,
        selectedAddOns: toSelectedAddOns(selectedAddOns),
        status: 'queued' satisfies Registration['status'],
        queuePosition: null,
        termsAcceptedAt: null,
        answers: deleteField(),
        proofOfPaymentUrls: [],
        proofSubmittedAt: null,
        adminNote: null,
        cancelledAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return
    }

    if (!canChangePackage(existing)) {
      throw new Error(
        'Your registration has already moved on to payment — contact an admin to change your package.',
      )
    }
    await updateDoc(registrationRef, {
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      packagePriceAmount: selectedPackage.priceAmount,
      packagePriceCurrency: selectedPackage.priceCurrency,
      selectedAddOns: toSelectedAddOns(selectedAddOns),
      packageUpdateRequired: false,
      updatedAt: serverTimestamp(),
    })
    return
  }

  await setDoc(registrationRef, {
    userId,
    marathonId,
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    packagePriceAmount: selectedPackage.priceAmount,
    packagePriceCurrency: selectedPackage.priceCurrency,
    selectedAddOns: toSelectedAddOns(selectedAddOns),
    status: 'queued' satisfies Registration['status'],
    queuePosition: null,
    termsAcceptedAt: null,
    proofOfPaymentUrls: [],
    proofSubmittedAt: null,
    adminNote: null,
    cancelledAt: null,
    cycle,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function submitTermsAndConditions(registrationId: string, answers: QuestionAnswer[]) {
  await updateDoc(doc(db, 'registrations', registrationId), {
    status: 'terms_accepted' satisfies Registration['status'],
    termsAcceptedAt: serverTimestamp(),
    answers,
    updatedAt: serverTimestamp(),
  })
}

export async function submitProofOfPayment(registrationId: string, files: File[]) {
  const urls = await Promise.all(
    files.map(async (file, index) => {
      const storageRef = ref(storage, `proof-of-payment/${registrationId}/${Date.now()}-${index}-${file.name}`)
      await uploadBytes(storageRef, file)
      return getDownloadURL(storageRef)
    }),
  )

  await updateDoc(doc(db, 'registrations', registrationId), {
    status: 'payment_submitted' satisfies Registration['status'],
    proofOfPaymentUrls: urls,
    proofSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Admin decisions run through Cloud Functions callables so capacity checks
// (queue acceptance vs. marathon capacity, payment confirmation vs. remaining
// slots) are enforced server-side rather than trusted from the client.

const acceptRegistrationCallable = httpsCallable<
  { registrationId: string; decision: 'accepted' | 'rejected'; offerImageUrl?: string },
  { status: string }
>(functions, 'acceptRegistration')

const confirmPaymentCallable = httpsCallable<
  { registrationId: string; decision: 'confirmed' | 'rejected'; adminNote?: string },
  { status: string }
>(functions, 'confirmPayment')

export async function decideQueueRegistration(
  registrationId: string,
  decision: 'accepted' | 'rejected',
  offerImageUrl?: string,
) {
  await acceptRegistrationCallable({ registrationId, decision, ...(offerImageUrl ? { offerImageUrl } : {}) })
}

export async function confirmPayment(registrationId: string) {
  await confirmPaymentCallable({ registrationId, decision: 'confirmed' })
}

export async function rejectPayment(registrationId: string, adminNote: string) {
  await confirmPaymentCallable({ registrationId, decision: 'rejected', adminNote })
}

// Also runs through a callable rather than a client-side rule: cancelling a
// 'confirmed' registration must release its counted seat in
// marathons.confirmedCount atomically with the status change (see
// functions/src/cancel-registration.ts), same reasoning as the callables above.
const cancelRegistrationCallable = httpsCallable<{ registrationId: string }, { status: string }>(
  functions,
  'cancelRegistration',
)

export async function cancelRegistration(registrationId: string) {
  await cancelRegistrationCallable({ registrationId })
}

/** Recomputes a marathon's confirmedCount from its actual confirmed registrations — used after a restore, since the counter must never be trusted verbatim from a CSV snapshot (see restore-plan.ts). */
export async function countConfirmedRegistrations(marathonId: string): Promise<number> {
  const q = query(registrationsRef, where('marathonId', '==', marathonId), where('status', '==', 'confirmed'))
  const snapshot = await getDocs(q)
  return snapshot.size
}

/**
 * Restore-from-backup only: a raw admin update of an *existing* registration doc,
 * bypassing the acceptRegistration/confirmPayment callables' capacity checks
 * (this reconstructs a prior state rather than processing a new decision).
 * Deliberately never touches proofOfPaymentUrls — proof-of-payment references are
 * excluded from export entirely, so a restore must never null out a live one.
 */
export async function restoreRegistrationFields(registrationId: string, patch: RegistrationRestorePatch) {
  await updateDoc(doc(db, 'registrations', registrationId), { ...patch })
}
