import { setGlobalOptions } from 'firebase-functions/v2/options'

setGlobalOptions({ region: 'asia-southeast1' })

export { acceptRegistration } from './accept-registration.js'
export { confirmPayment } from './confirm-payment.js'
export { onRegistrationStatusChange } from './on-registration-status-change.js'
export { onRegistrationQueueChange } from './on-registration-queue-change.js'
export { onNewPersonalMessage } from './on-new-personal-message.js'
export { onAnnouncementCreated } from './on-announcement-created.js'
