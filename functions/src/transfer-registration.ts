import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { endedRound, logBookingEvent } from './booking-event.js'
import { EMAIL_PATTERN, createInvitedUser } from './create-user.js'
import { notifyUser } from './notify-user.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

// Offered onwards. Not 'payment_submitted': a proof under review is approved/rejected first, so this can't race confirmPayment.
const TRANSFERABLE_STATUSES = ['accepted', 'terms_accepted', 'payment_rejected', 'deposit_paid', 'final_invoiced', 'confirmed']

// The new holder's own entry for this marathon/cycle may be replaced by the slot; anything further along is a booking of their own.
const REPLACEABLE_STATUSES = ['queued', 'rejected', 'cancelled']

// What follows the slot: the package, offer, payments and invoices. The passport, questionnaire
// answers (and any companions' details) and T&C acceptance stay with the original registrant — the new holder gives their own.
const SLOT_FIELDS = [
  'marathonId',
  'cycle',
  'packageId',
  'packageName',
  'packagePriceAmount',
  'packagePriceCurrency',
  'selectedAddOns',
  'seatCount',
  'status',
  'offeredPackageIds',
  'offeredAt',
  'offerImageUrl',
  'termsAcceptedAt',
  'proofOfPaymentUrls',
  'proofSubmittedAt',
  'paymentReference',
  'adminNote',
  'depositPaidAt',
  'depositPaidAmount',
  'depositCoveredBy',
  'depositCoversPackage',
  'depositProofUrls',
  'depositProofSubmittedAt',
  'approvedPaymentReferences',
  'finalInvoice',
  'previousFinalInvoices',
  'dueExtension',
  'overdueStatus',
  'overdueAt',
]

export function profileName(profile: FirebaseFirestore.DocumentData | undefined, fallback: string) {
  const parts = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : (profile?.displayName ?? profile?.email ?? fallback)
}

interface TransferRegistrationInput {
  registrationId: string
  toEmail: string
}

/**
 * Admin moves a booking's slot — with its deposit, invoices and payment history — to another person,
 * creating their account (with a set-password invite) if needed. The seat stays counted in
 * confirmedCount: it changes hands, it isn't freed. The original booking ends as 'cancelled' with
 * `transferredTo`; the new one carries `transferredFrom` and `transferTermsAcceptedAt: null` (T&C pending).
 */
export const transferRegistration = onCall<TransferRegistrationInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<TransferRegistrationInput>) => {
    const actorId = await requireAdmin(request)
    const { registrationId } = request.data
    const toEmail = String(request.data.toEmail ?? '').trim().toLowerCase()
    if (!EMAIL_PATTERN.test(toEmail)) throw new HttpsError('invalid-argument', 'Enter a valid email.')

    const sourceRef = db.collection('registrations').doc(registrationId)
    const preview = (await sourceRef.get()).data()
    if (!preview) throw new HttpsError('not-found', 'Registration not found.')

    // Resolved before the transaction: creating an account (and emailing its invite) can't be rolled back.
    let toUid: string
    let invited = false
    try {
      toUid = (await auth.getUserByEmail(toEmail)).uid
    } catch (error) {
      if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error
      if (!TRANSFERABLE_STATUSES.includes(preview.status)) {
        throw new HttpsError('failed-precondition', 'This booking can no longer be transferred.')
      }
      toUid = (await createInvitedUser(toEmail)).uid
      invited = true
    }
    if (toUid === preview.userId) throw new HttpsError('invalid-argument', 'That email already holds this booking.')

    const targetId = `${toUid}_${preview.marathonId}_${preview.cycle ?? 1}`
    const targetRef = db.collection('registrations').doc(targetId)
    const now = new Date()
    let source: FirebaseFirestore.DocumentData = {}
    let fromName = ''
    let toName = ''
    let fromEmail = ''

    await db.runTransaction(async (transaction) => {
      const [sourceSnap, targetSnap, notesSnap, fromProfile, toProfile] = await Promise.all([
        transaction.get(sourceRef),
        transaction.get(targetRef),
        transaction.get(sourceRef.collection('internalNotes')),
        transaction.get(db.collection('users').doc(preview.userId)),
        transaction.get(db.collection('users').doc(toUid)),
      ])
      source = sourceSnap.data()!
      if (!TRANSFERABLE_STATUSES.includes(source.status)) {
        throw new HttpsError(
          'failed-precondition',
          source.status === 'payment_submitted'
            ? 'Approve or reject the payment under review before transferring.'
            : 'This booking can no longer be transferred.',
        )
      }
      const existing = targetSnap.data()
      if (existing && !REPLACEABLE_STATUSES.includes(existing.status)) {
        throw new HttpsError('already-exists', `${toEmail} already has an active booking for this marathon.`)
      }

      fromName = profileName(fromProfile.data(), 'the original registrant')
      toName = profileName(toProfile.data(), toEmail)
      fromEmail = fromProfile.data()?.email ?? ''

      const slot = Object.fromEntries(SLOT_FIELDS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]))
      const previousRounds = [
        ...(existing?.previousRounds ?? []),
        // A plain waitlist entry is simply superseded; an ended round is kept for their timeline.
        ...(existing && existing.status !== 'queued' ? [endedRound(existing)] : []),
      ]
      transaction.set(targetRef, {
        ...slot,
        userId: toUid,
        // An offer not yet accepted takes T&C in its normal step; past that they're accepted again by the new holder.
        // An unaccepted offer restarts its accept-by clock for the new holder (flagOverdueRegistrations would cancel it otherwise).
        ...(source.status === 'accepted' ? { offeredAt: now, dueExtension: null } : { transferTermsAcceptedAt: null }),
        transferredFrom: { registrationId, userId: preview.userId, name: fromName, email: fromEmail, at: now },
        ...(previousRounds.length > 0 ? { previousRounds } : {}),
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      })
      // Staff notes follow the slot. Copied, not moved, so the cancelled original keeps its context too.
      notesSnap.docs.forEach((note) => transaction.set(targetRef.collection('internalNotes').doc(note.id), note.data()))
      transaction.update(sourceRef, {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: 'admin',
        transferredTo: { registrationId: targetId, userId: toUid, name: toName, email: toEmail, at: now },
        updatedAt: now,
      })
    })

    const from = fromEmail && fromEmail !== fromName ? `${fromName} (${fromEmail})` : fromName
    const to = toEmail !== toName ? `${toName} (${toEmail})` : toName
    const marathonTitle: string | undefined = (await db.collection('marathons').doc(preview.marathonId).get()).data()?.title
    const tour = marathonTitle ? `the ${marathonTitle} tour` : 'this tour'
    await Promise.all([
      logBookingEvent(registrationId, source, `Slot transferred by ARS Dream to ${to}`, marathonTitle),
      logBookingEvent(targetId, { ...source, userId: toUid }, `Slot transferred by ARS Dream from ${from}`, marathonTitle),
      notifyUser({
        userId: preview.userId,
        registrationId,
        pushTitle: 'Slot transferred',
        pushBody: `Your slot on ${tour} has been transferred to ${to}.`,
        emailSubject: marathonTitle ? `Slot transferred — ${marathonTitle}` : 'Slot transferred',
        emailBody: `As arranged, your slot on ${tour} — including payments made so far — has been transferred to ${to}. Message us if this wasn't expected.`,
      }),
      notifyUser({
        userId: toUid,
        registrationId: targetId,
        pushTitle: 'A slot has been transferred to you',
        pushBody: `You now hold a slot on ${tour}. Sign in to accept the terms & conditions and complete your booking.`,
        emailSubject: marathonTitle ? `A slot has been transferred to you — ${marathonTitle}` : 'A slot has been transferred to you',
        emailBody:
          `${from}'s slot on ${tour} has been transferred to you, together with the payments made so far. ` +
          `Sign in to accept the terms & conditions${source.depositPaidAt ? ', upload your passport bio page and answer the questionnaire' : ''}.` +
          (invited ? ' Set your password first using the invite we just sent.' : ''),
      }),
    ])

    await logAuditEntry({
      actorId,
      action: 'registration_transferred',
      targetType: 'registration',
      targetId: registrationId,
      targetLabel: marathonTitle,
      metadata: { fromUserId: preview.userId, fromEmail, toUserId: toUid, toEmail, toRegistrationId: targetId },
    })

    return { registrationId: targetId, invited }
  }),
)
