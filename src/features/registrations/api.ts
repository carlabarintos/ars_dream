import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'

import { db, functions, storage } from '@/firebase/config'
import type { MarathonPackage, QuestionAnswer, Registration } from '@/types'
import type { RegistrationRestorePatch } from '@/features/admin/export-import/serialize'

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

/** One-shot read of every registration across every marathon, for admin data export — no equivalent live-query exists elsewhere since every other read here is scoped by marathonId or userId. Safe as an unfiltered admin query for the same reason subscribeToAllMarathons is (see that function's comment). */
export async function getAllRegistrationsOnce(): Promise<Registration[]> {
  const snapshot = await getDocs(registrationsRef)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Registration)
}

export async function joinQueue(userId: string, marathonId: string, selectedPackage: MarathonPackage) {
  await addDoc(registrationsRef, {
    userId,
    marathonId,
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    packagePriceAmount: selectedPackage.priceAmount,
    packagePriceCurrency: selectedPackage.priceCurrency,
    status: 'queued' satisfies Registration['status'],
    queuePosition: null,
    termsAcceptedAt: null,
    proofOfPaymentUrls: [],
    proofSubmittedAt: null,
    adminNote: null,
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
  { registrationId: string; decision: 'accepted' | 'rejected' },
  { status: string }
>(functions, 'acceptRegistration')

const confirmPaymentCallable = httpsCallable<
  { registrationId: string; decision: 'confirmed' | 'rejected'; adminNote?: string },
  { status: string }
>(functions, 'confirmPayment')

export async function decideQueueRegistration(registrationId: string, decision: 'accepted' | 'rejected') {
  await acceptRegistrationCallable({ registrationId, decision })
}

export async function confirmPayment(registrationId: string) {
  await confirmPaymentCallable({ registrationId, decision: 'confirmed' })
}

export async function rejectPayment(registrationId: string, adminNote: string) {
  await confirmPaymentCallable({ registrationId, decision: 'rejected', adminNote })
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
