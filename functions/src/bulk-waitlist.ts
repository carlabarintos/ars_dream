import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db } from './admin.js'
import { APP_URL, escapeHtml, renderEmailHtml } from './email-template.js'
import { requireAdmin } from './require-admin.js'
import { resendApiKey, sendEmail } from './send-email.js'
import { withSentry } from './sentry.js'

// Same reasoning as reopen-marathon.ts.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const MAX_EMAILS = 500
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PROFILE_FIELDS = ['firstName', 'middleName', 'lastName', 'contactNumber', 'dateOfBirth', 'gender'] as const
type WaitlistProfile = Partial<Record<(typeof PROFILE_FIELDS)[number], string>>

interface WaitlistImportRow {
  email: string
  marathonIds: string[]
  /** Optional sign-up details; used only to prefill the invite's sign-up form, never written onto an existing account. */
  profile?: WaitlistProfile
}

interface BulkWaitlistInput {
  rows: WaitlistImportRow[]
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

/** Title · location · date, one marathon per line, for the "you're waitlisted" email. */
function marathonListHtml(marathons: FirebaseFirestore.DocumentData[]): string {
  return marathons
    .map((marathon) => {
      const date = (marathon.eventDate as Timestamp | null)?.toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      })
      const details = [marathon.location, date ?? 'Date TBA'].filter(Boolean).map((text) => escapeHtml(String(text)))
      return `• <strong>${escapeHtml(marathon.title)}</strong> — ${details.join(' · ')}`
    })
    .join('<br>')
}

/**
 * Admin bulk import of an existing waitlist — one row per person, each listing the marathons they're on.
 * Emails with an account are waitlisted right away; the rest are parked in `pendingWaitlist/{email}`
 * (Admin SDK only — no client rule) and claimed on sign-up by claimPendingWaitlist below. Either way they
 * get one "you're waitlisted" email listing the marathons newly added. Row order sets queue order.
 */
export const bulkWaitlist = onCall<BulkWaitlistInput>(
  { enforceAppCheck, secrets: [resendApiKey] },
  withSentry(async (request: CallableRequest<BulkWaitlistInput>) => {
    await requireAdmin(request)
    // Merge duplicate emails into one row, keeping the first occurrence's place in line.
    const byEmail = new Map<string, { marathonIds: Set<string>; profile: WaitlistProfile }>()
    for (const row of request.data.rows ?? []) {
      const email = String(row.email ?? '').trim().toLowerCase()
      const entry = byEmail.get(email) ?? { marathonIds: new Set<string>(), profile: {} }
      for (const id of row.marathonIds ?? []) entry.marathonIds.add(String(id))
      for (const field of PROFILE_FIELDS) {
        const value = String(row.profile?.[field] ?? '').trim()
        if (value && !entry.profile[field]) entry.profile[field] = value
      }
      byEmail.set(email, entry)
    }
    const invalid = [...byEmail.keys()].filter((email) => !EMAIL_PATTERN.test(email))
    if (byEmail.size === 0 || byEmail.size > MAX_EMAILS || invalid.length > 0) {
      throw new HttpsError(
        'invalid-argument',
        invalid.length > 0 ? `Invalid email(s): ${invalid.join(', ')}` : `Provide 1–${MAX_EMAILS} emails.`,
      )
    }
    const noMarathon = [...byEmail].filter(([, entry]) => entry.marathonIds.size === 0).map(([email]) => email)
    if (noMarathon.length > 0) throw new HttpsError('invalid-argument', `No marathon for: ${noMarathon.join(', ')}`)

    const marathonIds = [...new Set([...byEmail.values()].flatMap((entry) => [...entry.marathonIds]))]
    const marathons = new Map<string, FirebaseFirestore.DocumentData>()
    for (const id of marathonIds) {
      const marathon = (await db.collection('marathons').doc(id).get()).data()
      if (marathon?.status !== 'published') {
        throw new HttpsError('failed-precondition', `"${marathon?.title ?? id}" isn't published — only published marathons take waitlist imports.`)
      }
      marathons.set(id, marathon)
    }

    const now = Date.now()
    const result = { added: 0, invited: 0, alreadyListed: 0 }
    // Sequential so each import keeps the order it was listed in (createdAt = now + index).
    for (const [index, [email, entry]] of [...byEmail].entries()) {
      const joinedAt = new Date(now + index)
      const user = await auth.getUserByEmail(email).catch((error) => {
        if (error?.code === 'auth/user-not-found') return null
        throw error
      })

      const newlyListed: string[] = []
      if (user) {
        for (const id of entry.marathonIds) {
          const cycle = (marathons.get(id)!.cycle as number | undefined) ?? 1
          if (await addToWaitlist(user.uid, id, cycle, joinedAt)) newlyListed.push(id)
        }
      } else {
        // Already invited to a marathon — keep their original place in line for it.
        const pendingRef = db.collection('pendingWaitlist').doc(email)
        const pending = (await pendingRef.get()).data()
        const pendingMarathons: Record<string, Timestamp> = { ...pending?.marathons }
        for (const id of entry.marathonIds) {
          if (pendingMarathons[id]) continue
          pendingMarathons[id] = Timestamp.fromDate(joinedAt)
          newlyListed.push(id)
        }
        if (newlyListed.length > 0) {
          await pendingRef.set(
            { email, marathons: pendingMarathons, profile: { ...entry.profile, ...pending?.profile } },
            { merge: true },
          )
        }
      }

      if (newlyListed.length === 0) {
        result.alreadyListed++
        continue
      }
      result[user ? 'added' : 'invited']++

      const listed = newlyListed.map((id) => marathons.get(id)!)
      const tours = listed.length === 1 ? `the ${escapeHtml(listed[0].title)} tour` : 'these tours'
      const intro = `ARS Dream has added you to the waitlist for ${tours}:<br><br>${marathonListHtml(listed)}<br><br>`
      // Profile goes in the fragment, not the query, so it's never sent to the server in the page request.
      const prefill = new URLSearchParams(Object.entries(entry.profile).filter(([, value]) => value)).toString()
      await sendEmail({
        to: email,
        subject: `You're on the waitlist — ${listed.map((marathon) => marathon.title).join(', ')}`,
        html: renderEmailHtml(
          user
            ? {
                title: "You're on the waitlist",
                body: `${intro}Your booking is pending — we'll email you as soon as a slot opens up and an offer is ready.`,
                ctaLabel: 'View My Bookings',
                ctaUrl: `${APP_URL}/my-registrations`,
              }
            : {
                title: "You're on the waitlist",
                body: `${intro}Your booking is pending — create your ARS Dream account using this email address (${escapeHtml(email)}) and it will appear under My Bookings automatically. We'll email you as soon as a slot opens up.`,
                ctaLabel: 'Create My Account',
                ctaUrl: `${APP_URL}/sign-in?mode=sign-up&email=${encodeURIComponent(email)}${prefill ? `#${prefill}` : ''}`,
              },
        ),
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
