/**
 * Seeds the local emulators for trying internal notes: an admin, a "Runner + Runner"
 * package, and one lead + one linked runner 2, both deposit_paid, with a few
 * internal notes split across the two bookings. Re-run safe (fixed doc ids).
 *
 *   node scripts/seed-runner-notes.mjs
 *
 * Log in as admin@example.com / Admin123! → Admin → queue → open a booking.
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-ars-dream' })

const auth = getAuth()
const db = getFirestore()
const daysAgo = (d) => Timestamp.fromMillis(Date.now() - d * 24 * 3600 * 1000)

const MARATHON_ID = 'demo-ny-2027'
const DUO = { id: 'duo', name: 'Runner + Runner' }

// -- Users ---------------------------------------------------------------

async function ensureUser({ email, password, displayName, role }) {
  let user = await auth.getUserByEmail(email).catch(() => null)
  if (!user) user = await auth.createUser({ email, password, displayName })
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      displayName,
      email,
      photoURL: null,
      role,
      fcmTokens: [],
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  return user.uid
}

const adminUid = await ensureUser({
  email: 'admin@example.com',
  password: 'Admin123!',
  displayName: 'Demo Admin',
  role: 'admin',
})
const leadUid = await ensureUser({
  email: 'lead@example.com',
  password: 'Lead123!',
  displayName: 'Juan Dela Cruz',
  role: 'user',
})
const runnerUid = await ensureUser({
  email: 'runner2@example.com',
  password: 'Runner123!',
  displayName: 'Maria Santos',
  role: 'user',
})

// The same deterministic ids real bookings have, which the Cloud Functions rely on to find a runner's booking.
const LEAD_REG_ID = `${leadUid}_${MARATHON_ID}_1`
const RUNNER_REG_ID = `${runnerUid}_${MARATHON_ID}_1`

// -- Marathon ------------------------------------------------------------

await db
  .collection('marathons')
  .doc(MARATHON_ID)
  .set({
    title: 'New York City Marathon Tour 2027',
    description: 'Five days in New York built around race weekend: bib pickup, hotel, and the city marathon itself.',
    bannerImageUrl: '',
    location: 'New York City, USA',
    eventDate: daysAgo(-380),
    registrationOpensAt: daysAgo(10),
    registrationClosesAt: daysAgo(-90),
    capacity: 20,
    confirmedCount: 2,
    paymentInstructions: 'Wire to BDO USD account — details in the invoice email.',
    sharedInclusions: 'Race bib\nAirport transfers (JFK/EWR)\nHotel for 4 nights',
    offerAcceptanceDays: 2,
    depositDueDays: 3,
    balanceDeadline: daysAgo(-120),
    packages: [
      {
        id: 'single',
        name: 'Single Runner',
        priceAmount: 3500,
        priceCurrency: 'USD',
        depositAmount: 500,
        description: 'Everything in shared inclusions, plus one seat on the tour bus.',
      },
      {
        ...DUO,
        priceAmount: 7000,
        priceCurrency: 'USD',
        depositAmount: 500,
        runnerCount: 2,
        description: 'Two runners share the package price and one hotel room.',
      },
    ],
    status: 'published',
    createdBy: adminUid,
    createdAt: daysAgo(10),
  })

// -- Registrations -------------------------------------------------------
// Each runner pays their share (7000 / 2) and has their own deposit.

const baseRegistration = {
  marathonId: MARATHON_ID,
  cycle: 1,
  packageId: DUO.id,
  packageName: DUO.name,
  packagePriceAmount: 3500,
  packagePriceCurrency: 'USD',
  status: 'deposit_paid',
  queuePosition: null,
  proofOfPaymentUrls: [],
  adminNote: null,
  depositPaidAmount: 500,
  depositProofUrls: [],
  approvedPaymentReferences: [''],
}

await db
  .collection('registrations')
  .doc(LEAD_REG_ID)
  .set({
    ...baseRegistration,
    userId: leadUid,
    offeredAt: daysAgo(7),
    offeredPackageIds: [DUO.id],
    termsAcceptedAt: daysAgo(6),
    companions: [{ name: 'Maria Santos', email: 'runner2@example.com' }],
    seatCount: 1,
    proofSubmittedAt: daysAgo(4),
    depositPaidAt: daysAgo(4),
    depositProofSubmittedAt: daysAgo(4),
    createdAt: daysAgo(7),
    updatedAt: daysAgo(4),
  })

await db
  .collection('registrations')
  .doc(RUNNER_REG_ID)
  .set({
    ...baseRegistration,
    userId: runnerUid,
    partOf: {
      registrationId: LEAD_REG_ID,
      runner: 2,
      leadName: 'Juan Dela Cruz',
      packageName: DUO.name,
      hadOwnPlace: false,
      joinedAt: daysAgo(5),
    },
    transferTermsAcceptedAt: daysAgo(3),
    termsAcceptedAt: null,
    seatCount: 1,
    proofSubmittedAt: daysAgo(3),
    depositPaidAt: daysAgo(3),
    depositProofSubmittedAt: daysAgo(3),
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3),
  })

// Admin-read link doc, so RunnerLinkStatus shows "Linked" instead of "Not linked yet".
await db.collection('runnerBookings').doc(`${LEAD_REG_ID}_2`).set({
  userId: runnerUid,
  email: 'runner2@example.com',
  registrationId: RUNNER_REG_ID,
  marathonId: MARATHON_ID,
  cycle: 1,
  runner: 2,
  leadName: 'Juan Dela Cruz',
  packageId: DUO.id,
  packageName: DUO.name,
  status: 'deposit_paid',
  updatedAt: daysAgo(3),
})

// -- Internal notes (split across both bookings, interleaved in time) ----

const notes = [
  [LEAD_REG_ID, 'demo-note-lead-1', daysAgo(1), 'Holding the finish-line hotel room until Tuesday — it auto-cancels after that.'],
  [LEAD_REG_ID, 'demo-note-lead-2', daysAgo(2), 'Passport check OK, expiry good through 2028. Needs a visa interview before mid-October.'],
  [RUNNER_REG_ID, 'demo-note-runner-1', daysAgo(1.5), 'Vegetarian — flag for the post-race dinner.'],
]
for (const [registrationId, noteId, createdAt, text] of notes) {
  await db.collection('registrations').doc(registrationId).collection('internalNotes').doc(noteId).set({
    authorId: adminUid,
    authorName: 'Demo Admin',
    text,
    createdAt,
  })
}

console.log(`Seeded "${MARATHON_ID}" with ${LEAD_REG_ID} (lead) + ${RUNNER_REG_ID} (runner 2) and ${notes.length} internal notes.`)
console.log('Admin login: admin@example.com / Admin123!')
process.exit(0)
