import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'

import { db, functions, storage } from '@/firebase/config'
import type {
  InternalNote,
  InvoiceLineItem,
  MarathonPackage,
  MarathonPackageAddOn,
  QuestionAnswer,
  RunnerDetails,
  Registration,
  SelectedAddOn,
} from '@/types'
import type { RegistrationRestorePatch } from '@/features/admin/export-import/serialize'
import { canReRegister, withCurrentPackageLines } from '@/features/registrations/registration-flow'
import { UserFacingError } from '@/lib/user-facing-error'

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

/**
 * Stamped alongside every fresh-join/re-register write in the same batch —
 * firestore.rules' rateLimitOk() reads this to throttle repeated joinQueue
 * calls to at most one every few seconds per user.
 */
function stampRateLimit(batch: ReturnType<typeof writeBatch>, userId: string) {
  batch.set(doc(db, 'rateLimits', userId), { lastActionAt: serverTimestamp() })
}

function toSelectedAddOns(addOns: MarathonPackageAddOn[]): SelectedAddOn[] {
  return addOns.map((addOn) => ({ addOnId: addOn.id, name: addOn.name, priceAmount: addOn.priceAmount }))
}

/** Package fields as they sit on a waitlist entry — nothing chosen until the offer is accepted (see hasChosenPackage). */
const NO_PACKAGE = {
  packageId: '',
  packageName: '',
  packagePriceAmount: 0,
  packagePriceCurrency: '',
  selectedAddOns: [] as SelectedAddOn[],
}

export async function joinQueue(userId: string, marathonId: string, cycle: number) {
  const registrationRef = doc(db, 'registrations', registrationId(userId, marathonId, cycle))
  const existingSnap = await getDoc(registrationRef)

  if (existingSnap.exists()) {
    const existing = existingSnap.data() as Registration

    if (!canReRegister(existing)) {
      throw new UserFacingError("You're already on the waitlist for this event.")
    }
    // Re-registering after a rejection/cancellation resets this same doc
    // back to a fresh waitlist entry — see the re-registration rule in
    // firestore.rules. createdAt is reset to now so onRegistrationQueueChange
    // (which orders the queue by createdAt asc) places them at the BACK of
    // the queue, not wherever their original, already-resolved join time
    // would have put them.
    const batch = writeBatch(db)
    batch.update(registrationRef, {
      ...NO_PACKAGE,
      offeredPackageIds: deleteField(),
      offeredAt: deleteField(),
      cancelledBy: deleteField(),
      status: 'queued' satisfies Registration['status'],
      queuePosition: null,
      queueSortAt: deleteField(),
      termsAcceptedAt: null,
      answers: deleteField(),
      companions: deleteField(),
      companionsEditedBy: deleteField(),
      seatCount: deleteField(),
      proofOfPaymentUrls: [],
      proofSubmittedAt: null,
      adminNote: null,
      cancelledAt: null,
      depositPaidAt: deleteField(),
      depositProofUrls: deleteField(),
      depositProofSubmittedAt: deleteField(),
      paymentReference: deleteField(),
      approvedPaymentReferences: deleteField(),
      finalInvoice: deleteField(),
      previousFinalInvoices: deleteField(),
      finalTermsAcceptedAt: deleteField(),
      transferredFrom: deleteField(),
      transferredTo: deleteField(),
      transferTermsAcceptedAt: deleteField(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    stampRateLimit(batch, userId)
    await batch.commit()
    return
  }

  const batch = writeBatch(db)
  batch.set(registrationRef, {
    userId,
    marathonId,
    ...NO_PACKAGE,
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
  stampRateLimit(batch, userId)
  await batch.commit()
}

/** Accepting the offer: snapshots the chosen package (one of `offeredPackageIds`) and add-ons. */
export async function submitTermsAndConditions(
  registrationId: string,
  selectedPackage: MarathonPackage,
  selectedAddOns: MarathonPackageAddOn[],
  /** Runners 2+ on a multi-runner package (name + email). */
  companions: RunnerDetails[] = [],
) {
  await updateDoc(doc(db, 'registrations', registrationId), {
    ...(companions.length ? { companions } : {}),
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    packagePriceAmount: selectedPackage.priceAmount,
    packagePriceCurrency: selectedPackage.priceCurrency,
    selectedAddOns: toSelectedAddOns(selectedAddOns),
    status: 'terms_accepted' satisfies Registration['status'],
    termsAcceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** The new holder of a transferred slot accepting the T&C (see transferRegistration). */
export async function acceptTransferTerms(registrationId: string) {
  await updateDoc(doc(db, 'registrations', registrationId), {
    transferTermsAcceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Runner 0 is the lead (the registration's own fields); runners 1+ are written into `companions`. */
function runnerUpdate(registration: Registration, runner: number, details: RunnerDetails) {
  if (runner === 0) return details
  const companions = [...(registration.companions ?? [])]
  for (let i = 0; i < runner - 1; i++) companions[i] ??= {}
  companions[runner - 1] = { ...companions[runner - 1], ...details }
  return { companions }
}

/** Runners 2+'s name/email changed by an admin or the lead (EditRunnersDialog); their passports and answers are kept. */
export async function updateCompanionContacts(
  registration: Registration,
  contacts: Pick<RunnerDetails, 'name' | 'email'>[],
  editedBy: 'user' | 'admin',
) {
  const companions = contacts.map((contact, i) => ({ ...registration.companions?.[i], ...contact }))
  await updateDoc(doc(db, 'registrations', registration.id), {
    companions,
    // Read by onRegistrationStatusChange to say who changed them in the booking's history.
    companionsEditedBy: editedBy,
    updatedAt: serverTimestamp(),
  })
}

/** The questionnaire, answered right after the passport once the deposit is approved — once per runner. */
export async function submitQuestionnaireAnswers(registration: Registration, runner: number, answers: QuestionAnswer[]) {
  await updateDoc(doc(db, 'registrations', registration.id), {
    ...runnerUpdate(registration, runner, { answers }),
    updatedAt: serverTimestamp(),
  })
}

/** A runner's passport bio page photo, required once the deposit is approved. Re-uploading replaces it. */
export async function submitPassportPhoto(
  registration: Registration,
  runner: number,
  file: File,
  /** Runner 2+'s name/email, when missing (see RunnerDetails). */
  contact: Pick<RunnerDetails, 'name' | 'email'> = {},
) {
  const storageRef = ref(storage, `passports/${registration.id}/${Date.now()}-${file.name}`)
  await uploadBytes(storageRef, file)
  await updateDoc(doc(db, 'registrations', registration.id), {
    ...runnerUpdate(registration, runner, { ...contact, passportPhotoUrl: await getDownloadURL(storageRef) }),
    updatedAt: serverTimestamp(),
  })
}

export async function submitProofOfPayment(registrationId: string, files: File[], paymentReference: string) {
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
    paymentReference,
    updatedAt: serverTimestamp(),
  })
}

/** Balance proof against the final invoice. From 'final_invoiced' this also records T&C acceptance; a resubmit after rejection doesn't re-ask. */
export async function submitFinalPayment(registration: Registration, files: File[], paymentReference: string) {
  const urls = await Promise.all(
    files.map(async (file, index) => {
      const storageRef = ref(storage, `proof-of-payment/${registration.id}/${Date.now()}-balance-${index}-${file.name}`)
      await uploadBytes(storageRef, file)
      return getDownloadURL(storageRef)
    }),
  )

  await updateDoc(doc(db, 'registrations', registration.id), {
    status: 'payment_submitted' satisfies Registration['status'],
    proofOfPaymentUrls: urls,
    proofSubmittedAt: serverTimestamp(),
    paymentReference,
    ...(registration.status === 'final_invoiced' ? { finalTermsAcceptedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Admin-only (plain update, allowed by the admin rule): swap the package/add-ons at any stage. onRegistrationStatusChange logs it to the booking's history.
 * An unpaid final invoice is amended and re-issued to match; a confirmed booking's paid invoice is left alone (bill the difference via an Additional Invoice).
 */
export async function changeRegistrationPackage(
  registration: Registration,
  selectedPackage: MarathonPackage,
  selectedAddOns: MarathonPackageAddOn[],
) {
  const packageFields = {
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    packagePriceAmount: selectedPackage.priceAmount,
    packagePriceCurrency: selectedPackage.priceCurrency,
    selectedAddOns: toSelectedAddOns(selectedAddOns),
  }
  const { finalInvoice } = registration
  await updateDoc(doc(db, 'registrations', registration.id), {
    ...packageFields,
    ...(finalInvoice && registration.status !== 'confirmed'
      ? {
          finalInvoice: {
            ...finalInvoice,
            items: withCurrentPackageLines(finalInvoice.items, packageFields),
            issuedAt: serverTimestamp(),
          },
        }
      : {}),
    updatedAt: serverTimestamp(),
  })
}

/** Admin-only: change which packages an open offer (`accepted`) lets the registrant pick from. */
export async function changeOfferedPackages(registrationId: string, offeredPackageIds: string[]) {
  await updateDoc(doc(db, 'registrations', registrationId), { offeredPackageIds, updatedAt: serverTimestamp() })
}

/** Admin-only (plain update, allowed by the admin rule): issue or re-issue the final invoice. No capacity check needed — the seat was already counted at deposit. */
/** Approved proofs (deposit, or the paid balance on an Additional Invoice) are archived to depositProofUrls so the next balance upload doesn't overwrite them. */
export async function issueFinalInvoice(registration: Registration, items: InvoiceLineItem[], dueDate: Date) {
  const isPaid = registration.status === 'deposit_paid' || registration.status === 'confirmed'
  const { finalInvoice } = registration
  await updateDoc(doc(db, 'registrations', registration.id), {
    status: 'final_invoiced' satisfies Registration['status'],
    // Keep the version being replaced for the booking's history (with its payment, on an Additional Invoice).
    ...(finalInvoice
      ? {
          previousFinalInvoices: arrayUnion({
            items: finalInvoice.items,
            dueDate: finalInvoice.dueDate,
            issuedAt: finalInvoice.issuedAt,
            ...(registration.status === 'confirmed'
              ? { paidAt: registration.proofSubmittedAt, paidProofUrls: registration.proofOfPaymentUrls }
              : {}),
          }),
        }
      : {}),
    ...(isPaid && registration.proofOfPaymentUrls.length > 0
      ? {
          depositProofUrls: arrayUnion(...registration.proofOfPaymentUrls),
          // Only a paid balance is new here; the deposit's reference was archived by confirmPayment.
          ...(registration.status === 'confirmed'
            ? {
                approvedPaymentReferences: [
                  ...(registration.approvedPaymentReferences ?? []),
                  registration.paymentReference ?? '',
                ],
              }
            : {}),
        }
      : {}),
    finalInvoice: { items, dueDate: Timestamp.fromDate(dueDate), issuedAt: serverTimestamp() },
    dueExtension: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

/** Admin-only (plain update): extend the pending step's due date and clear its overdue flag. onRegistrationStatusChange logs and notifies. */
export async function extendDueDate(registration: Registration, dueDate: Date) {
  await updateDoc(doc(db, 'registrations', registration.id), {
    dueExtension: { status: registration.status, dueDate: Timestamp.fromDate(dueDate) },
    overdueStatus: deleteField(),
    overdueAt: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

// Admin decisions run through Cloud Functions callables so capacity checks
// (queue acceptance vs. marathon capacity, payment confirmation vs. remaining
// slots) are enforced server-side rather than trusted from the client.

const acceptRegistrationCallable = httpsCallable<
  { registrationId: string; decision: 'accepted' | 'rejected'; offerImageUrl?: string; offeredPackageIds?: string[] },
  { status: string }
>(functions, 'acceptRegistration')

const confirmPaymentCallable = httpsCallable<
  { registrationId: string; decision: 'confirmed' | 'rejected'; adminNote?: string },
  { status: string }
>(functions, 'confirmPayment')

/** Admin-only: swaps two adjacent queued registrations' places in line. */
export async function swapQueuePositions(a: Registration, b: Registration) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'registrations', a.id), {
    queuePosition: b.queuePosition,
    queueSortAt: b.queueSortAt ?? b.createdAt,
  })
  batch.update(doc(db, 'registrations', b.id), {
    queuePosition: a.queuePosition,
    queueSortAt: a.queueSortAt ?? a.createdAt,
  })
  await batch.commit()
}

export async function decideQueueRegistration(
  registrationId: string,
  decision: 'accepted' | 'rejected',
  offeredPackageIds?: string[],
  offerImageUrl?: string,
) {
  await acceptRegistrationCallable({
    registrationId,
    decision,
    ...(offeredPackageIds ? { offeredPackageIds } : {}),
    ...(offerImageUrl ? { offerImageUrl } : {}),
  })
}

export async function confirmPayment(registrationId: string) {
  await confirmPaymentCallable({ registrationId, decision: 'confirmed' })
}

export async function rejectPayment(registrationId: string, adminNote: string) {
  await confirmPaymentCallable({ registrationId, decision: 'rejected', adminNote })
}

export interface WaitlistImportRow {
  email: string
  marathonIds: string[]
  profile?: Partial<Record<'firstName' | 'middleName' | 'lastName' | 'contactNumber' | 'dateOfBirth' | 'gender', string>>
}

const bulkWaitlistCallable = httpsCallable<
  { rows: WaitlistImportRow[] },
  { added: number; invited: number; alreadyListed: number }
>(functions, 'bulkWaitlist')

/** Admin import of an existing waitlist, in order — accounts are waitlisted now, the rest on sign-up (functions/src/bulk-waitlist.ts). */
export async function bulkWaitlist(rows: WaitlistImportRow[]) {
  const result = await bulkWaitlistCallable({ rows })
  return result.data
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

const sendReminderCallable = httpsCallable<{ registrationId: string; text: string }, { sent: boolean }>(
  functions,
  'sendReminder',
)

/** Admin-only: emails + pushes the registrant about their pending step (functions/src/send-reminder.ts). */
export async function sendReminder(registrationId: string, text: string) {
  await sendReminderCallable({ registrationId, text })
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

const createUserCallable = httpsCallable<{ email: string }, { uid: string }>(functions, 'createUser')

/** Admin creates an account from an email and sends a set-your-password invite (functions/src/create-user.ts). */
export async function createUser(email: string) {
  const result = await createUserCallable({ email })
  return result.data
}

const transferRegistrationCallable = httpsCallable<
  { registrationId: string; toEmail: string },
  { registrationId: string; invited: boolean }
>(functions, 'transferRegistration')

/** Admin moves a booking's slot, with its payments and invoices, to another person (functions/src/transfer-registration.ts). */
export async function transferRegistration(registrationId: string, toEmail: string) {
  const result = await transferRegistrationCallable({ registrationId, toEmail })
  return result.data
}

function internalNotesRef(registrationId: string) {
  return collection(db, 'registrations', registrationId, 'internalNotes')
}

/** Newest first. Admin-only (see firestore.rules). */
export function subscribeToInternalNotes(registrationId: string, onData: (notes: InternalNote[]) => void) {
  const q = query(internalNotesRef(registrationId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as InternalNote))
  })
}

export async function addInternalNote(registrationId: string, authorId: string, authorName: string, text: string) {
  await addDoc(internalNotesRef(registrationId), { authorId, authorName, text, createdAt: serverTimestamp() })
}

export async function deleteInternalNote(registrationId: string, noteId: string) {
  await deleteDoc(doc(internalNotesRef(registrationId), noteId))
}
