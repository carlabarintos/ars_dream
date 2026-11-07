/**
 * One-off: strips the old stored `queuePosition` and `queueSortAt` from every registration. Queue
 * numbers are computed from the waitlist time now (getQueueNumbers), so nothing reads them.
 *
 *   node scripts/remove-queue-position.mjs                                  # local emulators
 *   node scripts/remove-queue-position.mjs --prod --project arsdream-1f00f  # needs GOOGLE_APPLICATION_CREDENTIALS
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const prod = args.includes('--prod')
const projectId = args.includes('--project') ? args[args.indexOf('--project') + 1] : 'demo-ars-dream'

if (prod) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path before running with --prod.')
    process.exit(1)
  }
  initializeApp({ credential: applicationDefault(), projectId })
} else {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  initializeApp({ projectId })
}

const db = getFirestore()
const snapshot = await db.collection('registrations').get()
const writer = db.bulkWriter()
let removed = 0
for (const doc of snapshot.docs) {
  const { queuePosition, queueSortAt } = doc.data()
  if (queuePosition === undefined && queueSortAt === undefined) continue
  writer.update(doc.ref, { queuePosition: FieldValue.delete(), queueSortAt: FieldValue.delete() })
  removed++
}
await writer.close()
console.log(`Removed the old queue fields from ${removed} of ${snapshot.size} registrations in ${projectId}.`)
process.exit(0)
