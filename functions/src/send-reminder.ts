import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { logBookingEvent } from './booking-event.js'
import { APP_URL } from './email-template.js'
import { notifyUser } from './notify-user.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

interface SendReminderInput {
  registrationId: string
  /** What's still pending, worded by the admin client from getPendingActionStep (src/features/registrations/registration-flow.ts). */
  text: string
}

/** Admin-only: emails + pushes the registrant a nudge about their pending step, and logs it to the booking's chat. */
export const sendReminder = onCall<SendReminderInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<SendReminderInput>) => {
    await requireAdmin(request)
    const { registrationId } = request.data
    const text = request.data.text?.trim()
    if (!text || text.length > 500) {
      throw new HttpsError('invalid-argument', 'Reminder text is required (max 500 characters).')
    }

    const registrationSnap = await db.collection('registrations').doc(registrationId).get()
    if (!registrationSnap.exists) {
      throw new HttpsError('not-found', 'Registration not found.')
    }
    const registration = registrationSnap.data()!
    const marathonTitle: string | undefined = (await db.collection('marathons').doc(registration.marathonId).get()).data()?.title

    const title = 'Reminder: action needed on your booking'
    await notifyUser({
      userId: registration.userId,
      pushTitle: title,
      pushBody: text,
      emailSubject: marathonTitle ? `${title} — ${marathonTitle}` : title,
      emailBody: marathonTitle ? `Your ${marathonTitle} tour booking: ${text}` : text,
      ctaLabel: 'Complete my booking',
      ctaUrl: `${APP_URL}/my-registrations`,
    })
    await logBookingEvent(registrationId, registration, `Reminder sent: ${text}`, marathonTitle)
    return { sent: true }
  }),
)
