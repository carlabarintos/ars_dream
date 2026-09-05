import { v1 } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

import { withSentry } from './sentry.js'

// One-time manual setup required before this can succeed in a real project
// (not something this function can provision for itself):
//   1. Create a GCS bucket dedicated to backups, e.g.
//        gsutil mb -l asia-southeast1 gs://<project-id>-firestore-backups
//   2. Grant the Cloud Functions runtime service account
//      (<project-id>@appspot.gserviceaccount.com) both:
//        - roles/datastore.importExportAdmin on the project
//        - roles/storage.objectAdmin on that bucket
//   3. (Recommended) add an Object Lifecycle rule on the bucket to auto-delete
//      exports older than N days, since exports otherwise accumulate forever.
const BACKUP_BUCKET_ENV = 'FIRESTORE_BACKUP_BUCKET'

const client = new v1.FirestoreAdminClient()

/**
 * Nightly full-database export as a disaster-recovery backstop beyond
 * Firestore's own point-in-time recovery — PITR only covers the trailing 7
 * days and is lost entirely if it isn't enabled on the database. Exports land
 * under gs://<bucket>/firestore-backups/<date>/ as Firestore's native export
 * format, restorable via `gcloud firestore import`.
 */
export const scheduledFirestoreBackup = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Asia/Manila', retryCount: 2 },
  withSentry(async () => {
    const bucket = process.env[BACKUP_BUCKET_ENV]
    if (!bucket) {
      logger.error(`${BACKUP_BUCKET_ENV} is not configured — skipping scheduled Firestore backup.`)
      return
    }

    const projectId = process.env.GCLOUD_PROJECT ?? (await client.getProjectId())
    const databaseName = client.databasePath(projectId, '(default)')
    const dateStamp = new Date().toISOString().slice(0, 10)

    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: `gs://${bucket}/firestore-backups/${dateStamp}`,
    })

    logger.info('Firestore export started', { operation: operation.name, bucket, dateStamp })
  }),
)
