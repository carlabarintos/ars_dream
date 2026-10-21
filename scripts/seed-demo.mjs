// Seeds the local emulators with a demo marathon and one customer at every booking stage.
// Usage (emulators running): node scripts/seed-demo.mjs   — re-running replaces the demo data.
// Every demo customer's password is "password123".
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-ars-dream' })
const auth = getAuth()
const db = getFirestore()

const DAY = 86_400_000
const ago = (days) => Timestamp.fromMillis(Date.now() - days * DAY)
const on = (iso) => Timestamp.fromDate(new Date(iso))
const PROOF = 'https://placehold.co/600x900/png?text=Deposit+Slip'
const BALANCE_PROOF = 'https://placehold.co/600x900/png?text=Balance+Slip'

const MARATHON_ID = 'demo-tokyo-2027'
const standard = {
  id: 'standard',
  name: 'Standard',
  priceAmount: 2450,
  priceCurrency: 'USD',
  depositAmount: 500,
  description: '5 nights twin-sharing hotel in Shinjuku\nDaily breakfast\nExpo assistance',
  addOns: [
    { id: 'companion', name: 'Non-running companion', priceAmount: 1200 },
    { id: 'single', name: 'Single room upgrade', priceAmount: 450 },
  ],
}
const premium = {
  id: 'premium',
  name: 'Premium',
  priceAmount: 3600,
  priceCurrency: 'USD',
  depositAmount: 800,
  description: '6 nights at Keio Plaza\nDaily breakfast + welcome dinner\nPrivate finish-line pickup',
  addOns: [{ id: 'companion', name: 'Non-running companion', priceAmount: 1500 }],
}
const questions = [
  { id: 'q-shirt', label: 'Shirt size', type: 'dropdown', required: true, options: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'q-emergency', label: 'Emergency contact (name & number)', type: 'text', required: true },
  { id: 'q-diet', label: 'Dietary restrictions', type: 'text', required: false },
  { id: 'q-pb', label: 'Marathon personal best (minutes)', type: 'int', required: false },
  { id: 'q-waiver', label: 'I agree to the event waiver', type: 'bool', required: true },
]

const adminUser = await auth.getUserByEmail('admin@arsdream.test').catch(() => null)

await db.doc(`marathons/${MARATHON_ID}`).set({
  title: 'Tokyo Marathon 2027',
  description: 'Run one of the six World Marathon Majors with ARS Dream — guaranteed entry, hotel and transfers.',
  bannerImageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600',
  location: 'Tokyo, Japan',
  code: 'TOKYO-2027',
  eventDate: on('2027-03-07T00:00:00+09:00'),
  registrationOpensAt: ago(30),
  registrationClosesAt: on('2026-12-31T23:59:00+08:00'),
  capacity: 20,
  confirmedCount: 3,
  paymentInstructions: 'BDO USD account — see invoice.',
  sharedInclusions: 'Guaranteed race entry\nAirport transfers\nARS Dream race-day support',
  packageNotes: 'Airfare not included.\nJapan visa required for Philippine passport holders.',
  offerAcceptanceDays: 2,
  depositDueDays: 3,
  balanceDeadline: on('2026-12-15T23:59:00+08:00'),
  packages: [standard, premium],
  questions,
  cycle: 1,
  status: 'published',
  createdBy: adminUser?.uid ?? 'seed',
  createdAt: ago(30),
})

// Remove registrations from a previous seed run so positions/stages stay clean.
const old = await db.collection('registrations').where('marathonId', '==', MARATHON_ID).get()
await Promise.all(old.docs.map((doc) => doc.ref.delete()))

async function customer(email, firstName, lastName, contactNumber) {
  const user =
    (await auth.getUserByEmail(email).catch(() => null)) ??
    (await auth.createUser({ email, password: 'password123', displayName: `${firstName} ${lastName}` }))
  await db.doc(`users/${user.uid}`).set({
    uid: user.uid,
    displayName: `${firstName} ${lastName}`,
    email,
    photoURL: null,
    role: 'user',
    fcmTokens: [],
    createdAt: ago(40),
    firstName,
    lastName,
    contactNumber,
    dateOfBirth: '1990-05-12',
    gender: 'prefer_not_to_say',
  })
  return user.uid
}

const withPackage = (pkg, addOnIds = []) => ({
  packageId: pkg.id,
  packageName: pkg.name,
  packagePriceAmount: pkg.priceAmount,
  packagePriceCurrency: pkg.priceCurrency,
  selectedAddOns: pkg.addOns
    .filter((addOn) => addOnIds.includes(addOn.id))
    .map((addOn) => ({ addOnId: addOn.id, name: addOn.name, priceAmount: addOn.priceAmount })),
})
const noPackage = { packageId: '', packageName: '', packagePriceAmount: 0, packagePriceCurrency: '' }
const offer = (daysAgo) => ({ offeredPackageIds: ['standard', 'premium'], offeredAt: ago(daysAgo) })
const finalInvoice = (pkg, addOnIds, daysAgo) => ({
  items: [
    { label: `${pkg.name} package`, amount: pkg.priceAmount },
    ...pkg.addOns
      .filter((addOn) => addOnIds.includes(addOn.id))
      .map((addOn) => ({ label: `Add-on: ${addOn.name}`, amount: addOn.priceAmount })),
    { label: 'Deposit paid', amount: -pkg.depositAmount, isDeposit: true },
  ],
  dueDate: on('2026-12-15T23:59:00+08:00'),
  issuedAt: ago(daysAgo),
})
const answers = [
  { questionId: 'q-shirt', label: 'Shirt size', value: 'M' },
  { questionId: 'q-emergency', label: 'Emergency contact (name & number)', value: 'Rosa Cruz — 0917 555 0142' },
  { questionId: 'q-diet', label: 'Dietary restrictions', value: 'No shellfish' },
  { questionId: 'q-pb', label: 'Marathon personal best (minutes)', value: '245' },
  { questionId: 'q-waiver', label: 'I agree to the event waiver', value: 'Yes' },
]

// [email, first, last, joined days ago, registration fields]
const people = [
  ['maria.santos@demo.test', 'Maria', 'Santos', 20, { status: 'queued', ...noPackage, queuePosition: 1 }],
  ['juan.delacruz@demo.test', 'Juan', 'Dela Cruz', 18, { status: 'queued', ...noPackage, queuePosition: 2 }],
  ['ana.reyes@demo.test', 'Ana', 'Reyes', 25, { status: 'accepted', ...noPackage, ...offer(1) }],
  [
    'paolo.garcia@demo.test',
    'Paolo',
    'Garcia',
    26,
    { status: 'accepted', ...noPackage, ...offer(5), overdueStatus: 'accepted', overdueAt: ago(3) },
  ],
  [
    'liza.mendoza@demo.test',
    'Liza',
    'Mendoza',
    27,
    { status: 'terms_accepted', ...withPackage(standard, ['single']), ...offer(6), termsAcceptedAt: ago(4) },
  ],
  [
    'carlo.bautista@demo.test',
    'Carlo',
    'Bautista',
    28,
    {
      status: 'payment_submitted',
      ...withPackage(premium),
      ...offer(8),
      termsAcceptedAt: ago(7),
      proofOfPaymentUrls: [PROOF],
      proofSubmittedAt: ago(1),
    },
  ],
  [
    'bea.villanueva@demo.test',
    'Bea',
    'Villanueva',
    29,
    {
      status: 'deposit_paid',
      ...withPackage(standard, ['companion']),
      ...offer(14),
      termsAcceptedAt: ago(13),
      depositProofSubmittedAt: ago(11),
      depositPaidAt: ago(10),
      depositProofUrls: [PROOF],
      proofOfPaymentUrls: [PROOF],
    },
  ],
  [
    'miguel.torres@demo.test',
    'Miguel',
    'Torres',
    29,
    {
      status: 'final_invoiced',
      ...withPackage(premium, ['companion']),
      ...offer(15),
      termsAcceptedAt: ago(14),
      depositProofSubmittedAt: ago(12),
      depositPaidAt: ago(11),
      depositProofUrls: [PROOF],
      proofOfPaymentUrls: [PROOF],
      finalInvoice: finalInvoice(premium, ['companion'], 3),
    },
  ],
  [
    'isabel.cruz@demo.test',
    'Isabel',
    'Cruz',
    30,
    {
      status: 'confirmed',
      ...withPackage(standard),
      ...offer(20),
      termsAcceptedAt: ago(19),
      depositProofSubmittedAt: ago(18),
      depositPaidAt: ago(17),
      depositProofUrls: [PROOF],
      finalInvoice: finalInvoice(standard, [], 9),
      finalTermsAcceptedAt: ago(7),
      proofOfPaymentUrls: [BALANCE_PROOF],
      proofSubmittedAt: ago(7),
      answers,
    },
  ],
  [
    'ramon.aquino@demo.test',
    'Ramon',
    'Aquino',
    24,
    { status: 'cancelled', ...noPackage, ...offer(9), cancelledAt: ago(6), cancelledBy: 'user' },
  ],
  ['tess.lim@demo.test', 'Tess', 'Lim', 22, { status: 'rejected', ...noPackage }],
]

for (const [email, firstName, lastName, joinedDaysAgo, fields] of people) {
  const userId = await customer(email, firstName, lastName, '0917 555 0100')
  await db.collection('registrations').add({
    userId,
    marathonId: MARATHON_ID,
    queuePosition: null,
    termsAcceptedAt: null,
    proofOfPaymentUrls: [],
    proofSubmittedAt: null,
    adminNote: null,
    cycle: 1,
    createdAt: ago(joinedDaysAgo),
    updatedAt: ago(1),
    ...fields,
  })
  console.log(`${fields.status.padEnd(18)} ${email}`)
}
console.log(`\nSeeded "Tokyo Marathon 2027" — admin queue: /admin/marathons/${MARATHON_ID}/queue`)
process.exit(0)
