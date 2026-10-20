import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { APP_URL, renderEmailHtml } from './email-template.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const MAX_EMAILS = 500
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface BulkWaitlistInput {
  marathonId: string
  emails: string[]
}

/**
 * Puts one existing user on a marathon's current-cycle waitlist, at the same deterministic id joinQueue
 * uses. A rejected/cancelled entry is reset like a re-register; any other existing entry is left alone.
 * `joinedAt` sets their place in line (the queue is ordered by createdAt).
 */
async function addToWaitlist(userId: string, marathonId: string, cycle: number, joinedAt: Date): Promise<boolean> {
  const ref = db.collection('registrations').doc(`${userId}_${marathonId}_${cycle}`)
  const existing = await ref.get()
  if (existing.exists && !['rejected', 'cancelled'].includes(existing.data()!.status)) return false
  await ref.set({
    userId,
    marathonId,
    packageId: '',
    packageName: '',
    packagePriceAmount: 0,
    packagePriceCurrency: '',
    selectedAddOns: [],
    status: 'queued',
    queuePosition: null,
    termsAcceptedAt: null,
    proofOfPaymentUrls: [],
    proofSubmittedAt: null,
    adminNote: null,
    cancelledAt: null,
    cycle,
    createdAt: joinedAt,
    updatedAt: FieldValue.serverTimestamp(),
  })
  return true
}

/**
 * Admin bulk import of an existing waitlist. Emails with an account are waitlisted right away; the rest
 * are parked in `pendingWaitlist/{email}` (Admin SDK only — no client rule) and claimed on sign-up by
 * claimPendingWaitlist below. Either way they get a "you're waitlisted" email.
 */
export const bulkWaitlist = onCall<BulkWaitlistInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<BulkWaitlistInput>) => {
    await requireAdmin(request)
    const { marathonId } = request.data
    const emails = [...new Set((request.data.emails ?? []).map((email) => String(email).trim().toLowerCase()))]
    const invalid = emails.filter((email) => !EMAIL_PATTERN.test(email))
    if (emails.length === 0 || emails.length > MAX_EMAILS || invalid.length > 0) {
      throw new HttpsError(
        'invalid-argument',
        invalid.length > 0 ? `Invalid email(s): ${invalid.join(', ')}` : `Provide 1–${MAX_EMAILS} emails.`,
      )
    }

    const marathonSnap = await db.collection('marathons').doc(marathonId).get()
    const marathon = marathonSnap.data()
    if (!marathon) throw new HttpsError('not-found', 'Marathon not found.')
    if (marathon.status !== 'published') {
      throw new HttpsError('failed-precondition', 'Only a published marathon can take waitlist imports.')
    }
    const cycle = (marathon.cycle as number | undefined) ?? 1
    const now = Date.now()

    const result = { added: 0, invited: 0, alreadyListed: 0 }
    // Sequential so each import keeps the order it was pasted in (createdAt = now + index).
    for (const [index, email] of emails.entries()) {
      const joinedAt = new Date(now + index)
      const user = await auth.getUserByEmail(email).catch((error) => {
        if (error?.code === 'auth/user-not-found') return null
        throw error
      })

      if (user) {
        if (!(await addToWaitlist(user.uid, marathonId, cycle, joinedAt))) {
          result.alreadyListed++
          continue
        }
        result.added++
        await sendEmail({
          to: email,
          subject: `You're on the waitlist — ${marathon.title}`,
          html: renderEmailHtml({
            title: "You're on the waitlist",
            body: `ARS Dream has added you to the waitlist for the ${marathon.title} tour. Your booking is pending — we'll email you as soon as a slot opens up and an offer is ready.`,
            ctaLabel: 'View My Bookings',
            ctaUrl: `${APP_URL}/my-registrations`,
          }),
        })
        continue
      }

      await db
        .collection('pendingWaitlist')
        .doc(email)
        .set({ email, marathons: { [marathonId]: Timestamp.fromDate(joinedAt) } }, { merge: true })
      result.invited++
      await sendEmail({
        to: email,
        subject: `You're on the waitlist — ${marathon.title}`,
        html: renderEmailHtml({
          title: "You're on the waitlist",
          body: `ARS Dream has added you to the waitlist for the ${marathon.title} tour. Your booking is pending — create your ARS Dream account using this email address (${email}) and it will appear under My Bookings automatically. We'll email you as soon as a slot opens up.`,
          ctaLabel: 'Create My Account',
          ctaUrl: `${APP_URL}/sign-in?mode=sign-up&email=${encodeURIComponent(email)}`,
        }),
      })
    }

    return result
  }),
)

/** When an invited email signs up, turns its pending imports into real waitlist entries, keeping their imported place in line. */
export const claimPendingWaitlist = onDocumentCreated(
  { document: 'users/{userId}' },
  withSentry(async (event) => {
    const userId = event.params.userId
    const email = ((event.data?.data().email as string | undefined) ?? (await auth.getUser(userId)).email)?.toLowerCase()
    if (!email) return

    const pendingRef = db.collection('pendingWaitlist').doc(email)
    const pending = await pendingRef.get()
    if (!pending.exists) return

    const marathons = (pending.data()!.marathons ?? {}) as Record<string, Timestamp>
    for (const [marathonId, importedAt] of Object.entries(marathons)) {
      const marathon = (await db.collection('marathons').doc(marathonId).get()).data()
      // ponytail: imports for a marathon that has since closed are dropped, not carried into a reopened cycle.
      if (marathon?.status !== 'published') continue
      await addToWaitlist(userId, marathonId, (marathon.cycle as number | undefined) ?? 1, importedAt.toDate())
    }
    await pendingRef.delete()
  }),
)
