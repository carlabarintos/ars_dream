import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

import { db } from './admin.js'
import { logBookingEvent } from './booking-event.js'
import { getOfferAcceptanceDeadline } from './email-template.js'
import { notifyUser } from './notify-user.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

const DAY_MS = 86_400_000

const OVERDUE_COPY: Record<string, { title: string; body: string }> = {
  accepted: {
    title: 'Your offer is overdue',
    body: 'The window to accept your offer has passed. Accept it now to keep your slot — it may be cancelled otherwise.',
  },
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
 * Flags registrations that sat past their offer-acceptance window ('accepted')
 * deposit due date ('terms_accepted') or final invoice due date ('final_invoiced'). `overdueStatus` records which status
 * it was overdue in, so the flag goes stale on its own once the registrant
 * moves on — no clearing write needed on the client's next step (which the
 * self-update rules wouldn't allow anyway). Admins then decide whether to
 * cancel via cancelRegistration; nothing is auto-cancelled here.
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
      if (registration.overdueStatus === registration.status) return false
      const marathon = marathons.get(registration.marathonId)
      const deadline =
        registration.status === 'final_invoiced'
          ? registration.finalInvoice?.dueDate?.toMillis()
          : registration.status === 'accepted'
          ? registration.offeredAt &&
            getOfferAcceptanceDeadline(registration.offeredAt.toDate(), marathon?.offerAcceptanceDays).getTime()
          : registration.termsAcceptedAt &&
            registration.termsAcceptedAt.toMillis() + (marathon?.depositDueDays ?? 1) * DAY_MS
      return deadline && deadline < now
    })

    await Promise.all(
      overdue.map(async (doc) => {
        const registration = doc.data()
        await doc.ref.update({ overdueStatus: registration.status, overdueAt: new Date() })
        const copy = OVERDUE_COPY[registration.status]
        const marathonTitle: string | undefined = marathons.get(registration.marathonId)?.title
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

    logger.info('Flagged overdue registrations', { count: overdue.length })
  }),
)
