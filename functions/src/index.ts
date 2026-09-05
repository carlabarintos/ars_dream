import './global-options.js'

export { acceptRegistration } from './accept-registration.js'
export { confirmPayment } from './confirm-payment.js'
export { cancelRegistration } from './cancel-registration.js'
export { reopenMarathon } from './reopen-marathon.js'
export { clearOperationalData } from './clear-operational-data.js'
export { onRegistrationStatusChange } from './on-registration-status-change.js'
export { onRegistrationQueueChange } from './on-registration-queue-change.js'
export { onNewPersonalMessage } from './on-new-personal-message.js'
export { onAnnouncementCreated } from './on-announcement-created.js'

// Temporarily not deployed: the GitHub Actions deploy service account lacks
// the "cloudscheduler.jobs.update" IAM permission Cloud Functions needs to
// provision this function's underlying Cloud Scheduler job, which fails the
// whole `firebase deploy --only functions` run (see deploy.yml). Grant that
// service account the "Cloud Scheduler Admin" role (roles/cloudscheduler.admin)
// on the arsdream-1f00f project — IAM & Admin > IAM in the Google Cloud
// Console, or `gcloud projects add-iam-policy-binding arsdream-1f00f
// --member=serviceAccount:<the account's email> --role=roles/cloudscheduler.admin`
// — then uncomment this export to re-enable the nightly backup.
// export { scheduledFirestoreBackup } from './scheduled-backup.js'
