import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

import { db } from './admin.js'
import { logBookingEvent } from './booking-event.js'
import { OFFER_EXPIRED_COPY, getStepDueDate } from './email-template.js'
import { APP_URL, notifyUser } from './notify-user.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

const OVERDUE_COPY: Record<string, { title: string; body: string }> = {
  terms_accepted: {
    title: 'Your deposit is overdue',
    body: 'Your deposit due date has passed. Submit your proof of payment now to keep your slot — it may be cancelled otherwise.',
  },
  final_invoiced: {
    title: 'Your final payment is overdue',
    body: 'Your final invoice due date has passed. Pay your balance and upload your proof now — your slot may be cancelled otherwise.',
  },
}

/**
 * Auto-cancels offers ('accepted') left past their acceptance window, and flags
 * registrations past their deposit due date ('terms_accepted') or final invoice due date ('final_invoiced'). `overdueStatus` records which status
 * it was overdue in, so the flag goes stale on its own once the registrant
 * moves on — no clearing write needed on the client's next step (which the
 * self-update rules wouldn't allow anyway). Admins then decide whether to
 * cancel overdue payments via cancelRegistration. An expired offer holds no counted
 * seat (confirmedCount moves at deposit approval), so cancelling it needs no capacity update.
 */
export const flagOverdueRegistrations = onSchedule(
  { schedule: 'every 1 hours', timeZone: 'Asia/Manila', secrets: [resendApiKey] },
  withSentry(async () => {
    const snap = await db.collection('registrations').where('status', 'in', ['accepted', 'terms_accepted', 'final_invoiced']).get()
    const marathonIds = [...new Set(snap.docs.map((doc) => doc.data().marathonId as string))]
    const marathonDocs = await Promise.all(marathonIds.map((id) => db.collection('marathons').doc(id).get()))
    const marathons = new Map(marathonDocs.map((doc) => [doc.id, doc.data()]))
    const now = Date.now()

    const overdue = snap.docs.filter((doc) => {
      const registration = doc.data()
      if (registration.status !== 'accepted' && registration.overdueStatus === registration.status) return false
      const marathon = marathons.get(registration.marathonId)
      const deadline = getStepDueDate(registration, marathon, registration.status)?.getTime()
      return deadline && deadline < now
    })

    await Promise.all(
      overdue.map(async (doc) => {
        const registration = doc.data()
        const marathonTitle: string | undefined = marathons.get(registration.marathonId)?.title

        if (registration.status === 'accepted') {
          // Transaction so a registrant accepting the offer at the same moment isn't cancelled.
          const cancelled = await db.runTransaction(async (transaction) => {
            if ((await transaction.get(doc.ref)).data()?.status !== 'accepted') return false
            const now = new Date()
            // cancelledBy 'admin' → the booking history reads "Booking cancelled by ARS Dream" (onRegistrationStatusChange).
            transaction.update(doc.ref, { status: 'cancelled', cancelledAt: now, cancelledBy: 'admin', updatedAt: now })
            return true
          })
          if (!cancelled) return
          await notifyUser({
            userId: registration.userId,
            pushTitle: OFFER_EXPIRED_COPY.title,
            pushBody: OFFER_EXPIRED_COPY.body,
            emailSubject: marathonTitle ? `${OFFER_EXPIRED_COPY.title} — ${marathonTitle}` : OFFER_EXPIRED_COPY.title,
            emailBody: marathonTitle
              ? `Your offer for the ${marathonTitle} tour: ${OFFER_EXPIRED_COPY.body}`
              : OFFER_EXPIRED_COPY.body,
            ctaLabel: 'Rejoin the Waitlist',
            ctaUrl: APP_URL,
          })
          return
        }

        await doc.ref.update({ overdueStatus: registration.status, overdueAt: new Date() })
        const copy = OVERDUE_COPY[registration.status]
        await logBookingEvent(doc.id, registration, `Flagged overdue — ${copy.title.toLowerCase()}`, marathonTitle)
        await notifyUser({
          userId: registration.userId,
          pushTitle: copy.title,
          pushBody: copy.body,
          emailSubject: marathonTitle ? `${copy.title} — ${marathonTitle}` : copy.title,
          emailBody: marathonTitle ? `Your registration for the ${marathonTitle} tour: ${copy.body}` : copy.body,
        })
      }),
    )

    logger.info('Processed overdue registrations', { count: overdue.length })
  }),
)
