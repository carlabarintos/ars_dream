import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { logBookingEvent } from './booking-event.js'
import { CANCELLABLE_STATUSES } from './cancel-registration.js'
import { runnerShare } from './email-template.js'
import { APP_URL, notifyUser } from './notify-user.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const BEFORE_DEPOSIT = ['queued', 'accepted', 'terms_accepted']
const NEEDS_DEPOSIT = ['deposit_paid', 'final_invoiced', 'confirmed']

interface RestoreRegistrationInput {
  registrationId: string
  /** Only needed for bookings cancelled before `statusBeforeCancel` was recorded. */
  status?: string
  /** Restoring a booking with no package to 'terms_accepted': the package to invoice, skipping the offer. */
  packageId?: string
}

/**
 * Undoes a cancellation: puts the booking back on the step it was cancelled at, with the seat it gave back.
 * Everything else (package, payments, invoices) was never cleared by cancelRegistration, so it's still there.
 */
export const restoreRegistration = onCall<RestoreRegistrationInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<RestoreRegistrationInput>) => {
    const uid = await requireAdmin(request)
    const { registrationId } = request.data
    const registrationRef = db.collection('registrations').doc(registrationId)
    let registration: FirebaseFirestore.DocumentData = {}
    let status = ''
    let skipsOffer = false

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(registrationRef)
      if (!snap.exists) throw new HttpsError('not-found', 'Registration not found.')
      registration = snap.data()!
      if (registration.status !== 'cancelled') throw new HttpsError('failed-precondition', 'This booking is not cancelled.')
      if (registration.transferredTo) throw new HttpsError('failed-precondition', 'This slot was transferred to someone else.')
      // Runners' bookings were cancelled and unlinked along with this one; putting a package back together is staff's call.
      if (registration.partOf || registration.companions?.some((c: { email?: string }) => c.email)) {
        throw new HttpsError('failed-precondition', 'Multi-runner bookings cannot be restored automatically.')
      }

      status = request.data.status ?? registration.statusBeforeCancel ?? ''
      if (!CANCELLABLE_STATUSES.includes(status)) throw new HttpsError('invalid-argument', 'Choose the status to restore to.')
      skipsOffer = status === 'terms_accepted' && !registration.packageId
      let offer = {}
      if (skipsOffer) {
        const marathon = (await transaction.get(db.collection('marathons').doc(registration.marathonId))).data()
        const pkg = (marathon?.packages ?? []).find((p: { id: string }) => p.id === request.data.packageId)
        if (!pkg) throw new HttpsError('invalid-argument', 'Choose the package to invoice.')
        if ((pkg.runnerCount ?? 1) > 1) {
          throw new HttpsError('failed-precondition', 'Restore it on a single-runner package, then use Change Package.')
        }
        // Like attachRunner: the package is set on an offer first, then moved to terms_accepted below so the invoice goes out.
        offer = {
          packageId: pkg.id,
          packageName: pkg.name,
          packagePriceAmount: runnerShare(pkg),
          packagePriceCurrency: pkg.priceCurrency,
          selectedAddOns: (pkg.addOns ?? [])
            .filter((addOn: { mandatory?: boolean }) => addOn.mandatory)
            .map((addOn: { id: string; name: string; priceAmount: number }) => ({ addOnId: addOn.id, name: addOn.name, priceAmount: addOn.priceAmount })),
          offeredPackageIds: [pkg.id],
        }
      } else if (!BEFORE_DEPOSIT.slice(0, 2).includes(status) && !registration.packageId) {
        throw new HttpsError('failed-precondition', 'This booking has no package, so it can only go back to the waitlist or offer.')
      }
      if (NEEDS_DEPOSIT.includes(status) && !registration.depositPaidAt) {
        throw new HttpsError('failed-precondition', 'This booking never had its deposit approved.')
      }
      if (['final_invoiced', 'confirmed'].includes(status) && !registration.finalInvoice) {
        throw new HttpsError('failed-precondition', 'This booking never had a final invoice.')
      }
      if (BEFORE_DEPOSIT.includes(status) && registration.depositPaidAt) {
        throw new HttpsError('failed-precondition', 'This booking had its deposit approved, so it was past that step.')
      }

      const now = new Date()
      transaction.update(registrationRef, {
        ...offer,
        status: skipsOffer ? 'accepted' : status,
        cancelledAt: FieldValue.delete(),
        cancelledBy: FieldValue.delete(),
        statusBeforeCancel: FieldValue.delete(),
        restoredAt: now,
        updatedAt: now,
        // A fresh acceptance window, or flagOverdueRegistrations would cancel the old offer again within the hour.
        ...(status === 'accepted' || skipsOffer ? { offeredAt: now, overdueStatus: FieldValue.delete(), dueExtension: FieldValue.delete() } : {}),
      })
      // Mirrors cancelRegistration: the seat it gave back is taken again. Admin's call, so it may go over capacity.
      if (status === 'confirmed' || registration.depositPaidAt) {
        transaction.update(db.collection('marathons').doc(registration.marathonId), {
          confirmedCount: FieldValue.increment((registration.seatCount as number | undefined) ?? 1),
        })
      }
    })

    await logAuditEntry({
      actorId: uid,
      action: 'registration_restored',
      targetType: 'registration',
      targetId: registrationId,
      metadata: { marathonId: registration.marathonId as string, userId: registration.userId as string, status },
    })
    // A status write of its own, so onRegistrationStatusChange sends the deposit invoice, which is their notice.
    // transferTermsAcceptedAt null → they accept the T&C before paying, as they never accepted an offer.
    if (skipsOffer) {
      const now = new Date()
      await registrationRef.update({ status, termsAcceptedAt: now, transferTermsAcceptedAt: null, updatedAt: now })
    }
    const marathonTitle: string | undefined = (await db.collection('marathons').doc(registration.marathonId).get()).data()?.title
    await logBookingEvent(registrationId, registration, 'Booking restored by ARS Dream', marathonTitle)
    if (skipsOffer) return { status }
    const body = 'ARS Dream has restored your cancelled booking, so it continues from where it left off.'
    await notifyUser({
      userId: registration.userId,
      registrationId,
      pushTitle: 'Booking restored',
      pushBody: body,
      emailSubject: marathonTitle ? `Booking restored — ${marathonTitle}` : 'Booking restored',
      emailBody: marathonTitle ? `Your ${marathonTitle} tour booking: ${body}` : body,
      ctaLabel: 'View my booking',
      ctaUrl: `${APP_URL}/my-registrations`,
    })
    return { status }
  }),
)
