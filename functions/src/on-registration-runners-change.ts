import { randomBytes } from 'node:crypto'

import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { endedRound, logBookingEvent } from './booking-event.js'
import { bookingDeposit, escapeHtml, renderEmailHtml, runnerShare } from './email-template.js'
import { APP_URL, notifyUser } from './notify-user.js'
import { requireAdmin } from './require-admin.js'
import { companionContacts, otherRunners } from './runners.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'
import { profileName } from './transfer-registration.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const ENDED_STATUSES = ['rejected', 'cancelled']

// Nothing paid or invoiced yet, so a runner's own entry can become their place on the package.
const REPLACEABLE_STATUSES = ['queued', 'accepted']

// Under way on a package of their own, but with no final invoice yet, so an admin can move it onto this one as it stands.
const MERGEABLE_STATUSES = ['terms_accepted', 'payment_submitted', 'payment_rejected', 'deposit_paid']

// Not paying yet, so a runner can still be taken off the package without a refund to sort out.
const RELEASABLE_STATUSES = ['accepted', 'terms_accepted']

type Doc = FirebaseFirestore.DocumentData

/** What the runnerBookings docs depend on; any other change to the booking needs no sync. */
function mirroredFields(registration: Doc) {
  const companions = (registration.companions ?? []) as { email?: string }[]
  return JSON.stringify([
    registration.status,
    registration.packageId,
    registration.packageName,
    companions.map((c) => c.email),
    // An admin saving runner details links them even if nothing changed, e.g. a runner entered before linking existed.
    registration.companionsSavedByAdminAt,
  ])
}

const marathonTitle = async (marathonId: string): Promise<string | undefined> =>
  (await db.collection('marathons').doc(marathonId).get()).data()?.title

const findPackage = (marathon: Doc | undefined, packageId: string) =>
  ((marathon?.packages ?? []) as { id: string; priceAmount: number; priceCurrency: string; runnerCount?: number; depositAmount?: number }[]).find(
    (p) => p.id === packageId,
  )

const ownRegistrationRef = (userId: string, booking: Doc) =>
  db.collection('registrations').doc(`${userId}_${booking.marathonId}_${booking.cycle}`)

const addStaffNote = (registrationId: string, text: string) =>
  db.collection('registrations').doc(registrationId).collection('internalNotes').add({
    authorId: 'system',
    authorName: 'ARS Dream system',
    text,
    createdAt: new Date(),
  })

/**
 * Gives a runner their own booking on the package: an open offer at their share of the price, which then runs the
 * normal pipeline (T&C, deposit, passport, final invoice). It sits at their usual registration id, so a waitlist place
 * or open offer they already hold becomes it, keeping createdAt for releaseRunner. One already under way keeps its
 * status, deposit and seat and just moves onto this package at their share, keeping `previousPackage` so it can move
 * back; only an admin can do that, because a lead can enter anyone's email and this changes what someone is paying.
 * Anything else is left for staff to sort out. Returns what happened, or null if nothing did.
 */
export async function attachRunner(userId: string, booking: Doc, marathon: Doc | undefined, { byAdmin = false } = {}) {
  const ref = ownRegistrationRef(userId, booking)
  const own = (await ref.get()).data()
  if (own?.partOf?.registrationId === booking.registrationId) return null

  const now = new Date()
  const pkg = findPackage(marathon, booking.packageId)
  const { registrationId, runner, leadName, packageName } = booking

  const isActive = own && !ENDED_STATUSES.includes(own.status)
  if (isActive && (own.partOf || !REPLACEABLE_STATUSES.includes(own.status))) {
    const canMerge = !own.partOf && !own.companions?.length && !own.finalInvoice && MERGEABLE_STATUSES.includes(own.status)
    if (!canMerge || !byAdmin) {
      await addStaffNote(
        registrationId,
        `Runner ${runner} (${booking.email}) already has a booking of their own for this tour, at status "${own.status}", so they weren't put on this package. ` +
          (canMerge ? 'To move it onto this package, keeping their deposit, save the runner details here as an admin.' : 'Sort this out with them.'),
      )
      return null
    }
    const { packageId, packageName: ownPackageName, packagePriceAmount, packagePriceCurrency, selectedAddOns } = own
    await ref.update({
      packageId: booking.packageId,
      packageName,
      packagePriceAmount: pkg ? runnerShare(pkg) : 0,
      packagePriceCurrency: pkg?.priceCurrency ?? '',
      // Approved against their old package, which is about to stop being the record of it.
      ...(own.depositPaidAt && own.depositPaidAmount == null
        ? { depositPaidAmount: bookingDeposit(own as Parameters<typeof bookingDeposit>[0], findPackage(marathon, packageId)) }
        : {}),
      partOf: {
        registrationId,
        runner,
        leadName,
        packageName,
        hadOwnPlace: true,
        joinedAt: now,
        previousPackage: { packageId, packageName: ownPackageName, packagePriceAmount, packagePriceCurrency, selectedAddOns: selectedAddOns ?? [] },
      },
      updatedAt: now,
    })
    if (own.depositPaidAt) await releaseHeldSeat(registrationId, booking.marathonId)
    await logBookingEvent(ref.id, own, `You're now Runner ${runner} on ${leadName}'s booking, on ${packageName}`, marathon?.title)
    return 'merged'
  }

  const offer = {
    packageId: booking.packageId,
    packageName,
    packagePriceAmount: pkg ? runnerShare(pkg) : 0,
    packagePriceCurrency: pkg?.priceCurrency ?? '',
    selectedAddOns: [],
    status: 'accepted',
    queuePosition: null,
    offeredPackageIds: [booking.packageId],
    offeredAt: now,
    partOf: { registrationId, runner, leadName, packageName, hadOwnPlace: !!isActive },
    updatedAt: now,
  }
  if (isActive) {
    await ref.update(offer)
  } else {
    await ref.set({
      ...offer,
      userId,
      marathonId: booking.marathonId,
      cycle: booking.cycle,
      termsAcceptedAt: null,
      proofOfPaymentUrls: [],
      proofSubmittedAt: null,
      adminNote: null,
      cancelledAt: null,
      ...(own ? { previousRounds: [...(own.previousRounds ?? []), endedRound(own)] } : {}),
      createdAt: now,
    })
  }
  const replaced = own?.status === 'accepted' ? 'Your offer was changed' : 'Your waitlist place was changed'
  await logBookingEvent(
    ref.id,
    { userId },
    `${isActive ? `${replaced} to ${packageName}: you're` : "You're"} now Runner ${runner} on ${leadName}'s booking`,
    marathon?.title,
  )
  return isActive ? 'replaced' : 'attached'
}

/** Takes a runner off the package: back to their original place in line if they had one (an open offer isn't revived), else cancelled. Once they're paying it's staff's call. */
async function releaseRunner(userId: string, booking: Doc) {
  const ref = ownRegistrationRef(userId, booking)
  const own = (await ref.get()).data()
  if (!own || own.partOf?.registrationId !== booking.registrationId) return

  const { previousPackage } = own.partOf
  if (previousPackage && !own.finalInvoice) {
    // onRegistrationStatusChange logs it, tells them, and re-sends any deposit invoice, as for any package change.
    await ref.update({ ...previousPackage, partOf: FieldValue.delete(), updatedAt: new Date() })
    return
  }
  if (previousPackage || !RELEASABLE_STATUSES.includes(own.status)) {
    await addStaffNote(
      ref.id,
      `No longer Runner ${booking.runner} on ${booking.leadName}'s booking, but this runner is already paying (status "${own.status}"), so their booking was left as it is. Sort this out with them.`,
    )
    return
  }

  const now = new Date()
  const { hadOwnPlace } = own.partOf
  await ref.update({
    status: hadOwnPlace ? 'queued' : 'cancelled',
    ...(hadOwnPlace ? { cancelledAt: null } : { cancelledAt: now, cancelledBy: 'admin' }),
    packageId: '',
    packageName: '',
    packagePriceAmount: 0,
    packagePriceCurrency: '',
    selectedAddOns: [],
    queuePosition: null,
    termsAcceptedAt: null,
    partOf: FieldValue.delete(),
    offeredPackageIds: FieldValue.delete(),
    offeredAt: FieldValue.delete(),
    overdueStatus: FieldValue.delete(),
    overdueAt: FieldValue.delete(),
    dueExtension: FieldValue.delete(),
    updatedAt: now,
  })
  const title = await marathonTitle(booking.marathonId)
  const heading = hadOwnPlace ? "You're back on the waitlist" : 'Your place was cancelled'
  const text =
    `You're no longer Runner ${booking.runner} on ${booking.leadName}'s booking` +
    (hadOwnPlace ? ", so you're back on the waitlist in your original place." : ', so this place has been cancelled.')
  await logBookingEvent(ref.id, own, text, title)
  await notifyUser({
    userId,
    pushTitle: heading,
    pushBody: text,
    emailSubject: title ? `${heading} — ${title}` : heading,
    // renderEmailHtml doesn't escape, and the lead's name is theirs to set.
    emailBody: escapeHtml(text),
    ctaLabel: 'View My Bookings',
    ctaUrl: `${APP_URL}/my-registrations`,
  })
}

/**
 * The lead's booking ended, so the package is over and their runners' bookings end with it, at any stage. A seat already
 * taken is given back. Nothing is refunded here: staff get a note to sort out any payment.
 */
async function cancelRunner(userId: string, booking: Doc) {
  const ref = ownRegistrationRef(userId, booking)
  // Transaction so a deposit being approved at the same moment can't leave its seat counted.
  const own = await db.runTransaction(async (transaction) => {
    const current = (await transaction.get(ref)).data()
    if (!current || current.partOf?.registrationId !== booking.registrationId || ENDED_STATUSES.includes(current.status)) return null
    const now = new Date()
    // partOf goes too: it would otherwise read as the runner dropping out, and they can rejoin the waitlist from here.
    transaction.update(ref, { status: 'cancelled', cancelledAt: now, cancelledBy: 'admin', partOf: FieldValue.delete(), updatedAt: now })
    if (current.status === 'confirmed' || current.depositPaidAt) {
      transaction.update(db.collection('marathons').doc(booking.marathonId), {
        confirmedCount: FieldValue.increment(-((current.seatCount as number | undefined) ?? 1)),
      })
    }
    return current
  })
  if (!own) return

  const hasPaid = own.status === 'confirmed' || own.depositPaidAt != null
  if (hasPaid) {
    await addStaffNote(ref.id, `Cancelled with ${booking.leadName}'s booking after this runner had paid (status "${own.status}"). Sort out their payment with them.`)
  }
  const title = await marathonTitle(booking.marathonId)
  const heading = 'Your place was cancelled'
  const text =
    `${booking.leadName}'s booking was cancelled, so your place as Runner ${booking.runner} has been cancelled too.` +
    (hasPaid ? " We'll be in touch about the payment you've made." : '')
  await logBookingEvent(ref.id, own, text, title)
  await notifyUser({
    userId,
    pushTitle: heading,
    pushBody: text,
    emailSubject: title ? `${heading} — ${title}` : heading,
    // renderEmailHtml doesn't escape, and the lead's name is theirs to set.
    emailBody: escapeHtml(text),
    ctaLabel: 'View My Bookings',
    ctaUrl: `${APP_URL}/my-registrations`,
  })
}

/** A runner who'd have used a seat held on the package no longer will: their own deposit brought one, or they've left. Any runner may be the one holding it. */
async function releaseHeldSeat(leadId: string, marathonId: string) {
  const leadRef = db.collection('registrations').doc(leadId)
  await db.runTransaction(async (transaction) => {
    const lead = (await transaction.get(leadRef)).data()
    if (!lead) return
    const everyone = [{ ref: leadRef, data: lead }, ...(await otherRunners(transaction, leadRef, lead))]
    const holder = everyone.find(({ data }) => ((data.seatCount as number | undefined) ?? 1) > 1)
    if (!holder) return
    transaction.update(holder.ref, { seatCount: (holder.data.seatCount as number) - 1 })
    transaction.update(db.collection('marathons').doc(marathonId), { confirmedCount: FieldValue.increment(-1) })
  })
}

/** The runner moved up a slot when someone ahead of them left, so their own booking says the new number. */
async function renumberRunner(userId: string, booking: Doc) {
  const ref = ownRegistrationRef(userId, booking)
  const own = (await ref.get()).data()
  if (!own || own.partOf?.registrationId !== booking.registrationId) return
  await ref.update({ partOf: { ...own.partOf, runner: booking.runner }, updatedAt: new Date() })
}

/** Moves a booking made when the lead held the whole package onto per-runner terms: their share of the price. Any seats held stay held for their runners. */
async function splitLeadBooking(registrationId: string, registration: Doc, marathon: Doc | undefined) {
  const pkg = findPackage(marathon, registration.packageId)
  if (!pkg || runnerShare(pkg) === pkg.priceAmount || registration.packagePriceAmount !== pkg.priceAmount) return
  await db.collection('registrations').doc(registrationId).update({ packagePriceAmount: runnerShare(pkg), updatedAt: new Date() })
}

function offerCopy(booking: Doc, title: string | undefined) {
  const tour = title ? `the ${title} tour` : 'a marathon tour'
  const offer = (lead: string, packageName: string, tourName: string) =>
    `You've been offered a place on ${lead}'s ${packageName} package for ${tourName}, as Runner ${booking.runner}.`
  const heading = `You've been offered a place as Runner ${booking.runner}`
  return {
    title: heading,
    subject: title ? `${heading} — ${title}` : heading,
    text: offer(booking.leadName, booking.packageName, tour),
    // renderEmailHtml doesn't escape, and the lead's name is theirs to set.
    html: offer(escapeHtml(booking.leadName), escapeHtml(booking.packageName), escapeHtml(tour)),
    ownStepsHtml: "You'll have your own deposit invoice, terms & conditions, passport upload and final invoice.",
  }
}

async function notifyMerged(userId: string, booking: Doc, title: string | undefined) {
  const heading = `You're now Runner ${booking.runner}`
  const text = (lead: string, packageName: string) =>
    `ARS Dream has moved your booking onto ${lead}'s ${packageName} package, as Runner ${booking.runner}. Any deposit you've paid stays on your booking and comes off your final invoice.`
  await notifyUser({
    userId,
    pushTitle: heading,
    pushBody: text(booking.leadName, booking.packageName),
    emailSubject: title ? `${heading} — ${title}` : heading,
    // renderEmailHtml doesn't escape, and the lead's name is theirs to set.
    emailBody: text(escapeHtml(booking.leadName), escapeHtml(booking.packageName)),
    ctaLabel: 'View My Booking',
    ctaUrl: `${APP_URL}/my-registrations`,
  })
}

async function sendRunnerInvite(booking: Doc, title: string | undefined) {
  const copy = offerCopy(booking, title)
  const params = new URLSearchParams({ mode: 'sign-up', email: booking.email, runnerInvite: booking.inviteToken })
  await sendEmail({
    to: booking.email,
    subject: copy.subject,
    html: renderEmailHtml({
      title: copy.title,
      body: `${copy.html} Use the button below to create your ARS Dream account with this email address (${escapeHtml(booking.email)}) and your booking will appear under My Bookings automatically. ${copy.ownStepsHtml}`,
      ctaLabel: 'Create My Account',
      ctaUrl: `${APP_URL}/sign-in?${params}`,
    }),
  })
}

/**
 * Keeps one runnerBookings doc per runner 2+ (who they are, and whether they've joined). A runner with an account gets
 * their booking now (attachRunner) and is told so; anyone else gets a sign-up invite and it waits for claimRunnerInvite.
 */
export async function syncRunnerBookings(registrationId: string, registration: Doc, { byAdmin = false } = {}) {
  const bookings = db.collection('runnerBookings')
  const existing = await bookings.where('registrationId', '==', registrationId).get()
  const updatedAt = new Date()

  // Nobody new is invited onto a booking that's over. A slot transferred away isn't over: it lives on with someone else,
  // so its runners are only taken off it.
  if (ENDED_STATUSES.includes(registration.status)) {
    await Promise.all(
      existing.docs.map(async (doc) => {
        await doc.ref.update({ status: registration.status, updatedAt })
        const { userId } = doc.data()
        if (userId) await (registration.transferredTo ? releaseRunner : cancelRunner)(userId, doc.data())
      }),
    )
    return
  }

  const [marathonDoc, leadDoc] = await Promise.all([
    db.collection('marathons').doc(registration.marathonId).get(),
    db.collection('users').doc(registration.userId).get(),
  ])
  const marathon = marathonDoc.data()
  const leadName = profileName(leadDoc.data(), 'The account holder')

  const contacts = companionContacts(registration, marathon)
  if (contacts.length > 0) await splitLeadBooking(registrationId, registration, marathon)

  const keptSlots = new Set<string>()
  const keptEmails = new Set<string>()
  for (const contact of contacts) {
    const email = contact.email.toLowerCase()
    const user = await auth.getUserByEmail(email).catch((error) => {
      if (error?.code === 'auth/user-not-found') return null
      throw error
    })
    if (user?.uid === registration.userId) continue

    const ref = bookings.doc(`${registrationId}_${contact.runner}`)
    keptSlots.add(ref.id)
    keptEmails.add(email)
    // By email first: removing Runner 2 moves Runner 3 up a slot, and they're still the same person on the package.
    const previous = (existing.docs.find((doc) => doc.data().email === email) ?? existing.docs.find((doc) => doc.id === ref.id))?.data()
    const sameRunner = previous?.email === email
    // An invite stays unclaimed until its link is used, even if an account has appeared for that email since:
    // sign-up doesn't verify emails, so that account could be anyone's.
    const userId = sameRunner ? previous.userId : (user?.uid ?? null)
    const inviteToken = sameRunner ? previous.inviteToken : user ? undefined : randomBytes(32).toString('hex')
    const booking = {
      userId,
      email,
      ...(inviteToken ? { inviteToken } : {}),
      registrationId,
      marathonId: registration.marathonId,
      cycle: registration.cycle ?? 1,
      runner: contact.runner,
      leadName,
      packageId: registration.packageId,
      packageName: registration.packageName,
      status: registration.status,
      updatedAt,
    }
    await ref.set(booking)
    if (sameRunner) {
      if (userId && previous.runner !== contact.runner) await renumberRunner(userId, booking)
      // An admin saving again is how a booking left alone earlier gets moved onto the package.
      if (byAdmin && userId && (await attachRunner(userId, booking, marathon, { byAdmin })) === 'merged') {
        await notifyMerged(userId, booking, marathon?.title)
      }
      continue
    }

    if (user) {
      const outcome = await attachRunner(user.uid, booking, marathon, { byAdmin })
      if (!outcome) continue
      if (outcome === 'merged') {
        await notifyMerged(user.uid, booking, marathon?.title)
        continue
      }
      const replaced = outcome === 'replaced'
      const copy = offerCopy(booking, marathon?.title)
      await notifyUser({
        userId: user.uid,
        pushTitle: copy.title,
        pushBody: copy.text,
        emailSubject: copy.subject,
        emailBody:
          `${copy.html} It's on your account, under My Bookings. ${copy.ownStepsHtml}` +
          (replaced ? " This replaces your own entry for this tour. If you're taken off the package before paying, you go back to your original waitlist place." : ''),
        ctaLabel: 'View My Booking',
        ctaUrl: `${APP_URL}/my-registrations`,
      })
    } else {
      await sendRunnerInvite(booking, marathon?.title)
    }
  }

  await Promise.all(
    existing.docs.map(async (doc) => {
      if (!keptSlots.has(doc.id)) await doc.ref.delete()
      if (doc.data().userId && !keptEmails.has(doc.data().email)) await releaseRunner(doc.data().userId, doc.data())
    }),
  )
}

/**
 * The invite link's token proves the person holds the invited mailbox, which sign-up alone doesn't, so a booking is only
 * handed over this way. Safe to repeat, since the same email link can be opened twice.
 */
export async function claimInvite(token: string, userId: string, email: string | undefined) {
  const invited = (await db.collection('runnerBookings').where('inviteToken', '==', token).get()).docs[0]
  if (!invited) throw new HttpsError('not-found', 'This invite is no longer valid. Ask ARS Dream to send a new one.')
  const booking = invited.data()
  if (booking.email !== email?.toLowerCase()) {
    throw new HttpsError('permission-denied', `This invite is for ${booking.email}. Sign in with that email to accept it.`)
  }
  if (ENDED_STATUSES.includes(booking.status)) {
    throw new HttpsError('failed-precondition', 'This booking has been cancelled, so this invite no longer applies.')
  }
  if (booking.userId !== userId) {
    await invited.ref.update({ userId })
    await attachRunner(userId, booking, (await db.collection('marathons').doc(booking.marathonId).get()).data())
  }
  return { runner: booking.runner as number }
}

export const claimRunnerInvite = onCall<{ token: string }>(
  { enforceAppCheck },
  withSentry(async (request: CallableRequest<{ token: string }>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to accept this invite.')
    return claimInvite(String(request.data.token ?? ''), request.auth.uid, request.auth.token.email)
  }),
)

/** Admin re-sends an unclaimed invite, with the same link. */
export const resendRunnerInvite = onCall<{ bookingId: string }>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<{ bookingId: string }>) => {
    await requireAdmin(request)
    const booking = (await db.collection('runnerBookings').doc(String(request.data.bookingId)).get()).data()
    if (!booking?.inviteToken || booking.userId || ENDED_STATUSES.includes(booking.status)) {
      throw new HttpsError('failed-precondition', 'This runner has no open invite to re-send.')
    }
    await sendRunnerInvite(booking, await marathonTitle(booking.marathonId))
    return { sent: true }
  }),
)

// Its own trigger, not part of onRegistrationStatusChange, so a failed invite can't hold up the lead's invoice email.
export const onRegistrationRunnersChange = onDocumentUpdated(
  { document: 'registrations/{registrationId}', secrets: [resendApiKey] },
  withSentry(async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || mirroredFields(before) === mirroredFields(after)) return
    if (after.partOf) {
      if (ENDED_STATUSES.includes(after.status) && !ENDED_STATUSES.includes(before.status)) {
        if (!after.depositPaidAt) await releaseHeldSeat(after.partOf.registrationId, after.marathonId)
        await addStaffNote(
          after.partOf.registrationId,
          `Runner ${after.partOf.runner}'s own booking ended (${after.status}), so this package has lost a runner. Review the lead's price and package.`,
        )
      }
      return
    }
    await syncRunnerBookings(event.params.registrationId, after, {
      byAdmin: JSON.stringify(before.companionsSavedByAdminAt) !== JSON.stringify(after.companionsSavedByAdminAt),
    })
  }),
)
