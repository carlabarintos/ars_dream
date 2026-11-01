import { createHash } from 'node:crypto'

import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { db, storage } from './admin.js'
import { withSentry } from './sentry.js'

const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const REVIEW_LIMITS = {
  nameMax: 60,
  commentMax: 1000,
  photosMax: 3,
  photoBytesMax: 2 * 1024 * 1024,
  /** Submissions allowed per IP per window. */
  perIp: 3,
  windowMs: 24 * 60 * 60 * 1000,
  /** Hard cap on the pending queue, so IP rotation can't flood storage/the admin view. */
  pendingMax: 200,
}

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

interface SubmitReviewInput {
  name?: string
  rating: number
  comment: string
  /** data: URLs (base64), already downscaled client-side. */
  photos?: string[]
}

function parsePhoto(dataUrl: unknown) {
  const match = typeof dataUrl === 'string' ? /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl) : null
  const ext = match && PHOTO_TYPES[match[1]]
  if (!match || !ext) throw new HttpsError('invalid-argument', 'Photos must be JPEG, PNG or WebP images.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > REVIEW_LIMITS.photoBytesMax) throw new HttpsError('invalid-argument', 'Each photo must be under 2 MB.')
  return { bytes, contentType: match[1], ext }
}

/** Public (no sign-in) review submission. Lands as `pending` until an admin approves it. */
export const submitReview = onCall<SubmitReviewInput>(
  { enforceAppCheck, memory: '512MiB' },
  withSentry(async (request: CallableRequest<SubmitReviewInput>) => {
    const { name, rating, comment, photos = [] } = request.data ?? ({} as SubmitReviewInput)

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    const trimmedComment = typeof comment === 'string' ? comment.trim() : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpsError('invalid-argument', 'Rating must be 1–5 stars.')
    if (!trimmedComment || trimmedComment.length > REVIEW_LIMITS.commentMax) {
      throw new HttpsError('invalid-argument', `Review must be 1–${REVIEW_LIMITS.commentMax} characters.`)
    }
    if (trimmedName.length > REVIEW_LIMITS.nameMax) throw new HttpsError('invalid-argument', 'Name is too long.')
    if (!Array.isArray(photos) || photos.length > REVIEW_LIMITS.photosMax) {
      throw new HttpsError('invalid-argument', `Up to ${REVIEW_LIMITS.photosMax} photos.`)
    }
    const parsedPhotos = photos.map(parsePhoto)

    // Rate limit per hashed IP (raw IPs are never stored), checked and recorded atomically.
    // ponytail: rawRequest.ip is the leftmost X-Forwarded-For entry, which a script can spoof — App Check
    // and the pendingMax cap are the real backstop. Switch to the trusted XFF hop if abuse shows up.
    const ipHash = createHash('sha256').update(request.rawRequest.ip ?? 'unknown').digest('hex')
    const limitRef = db.collection('reviewRateLimits').doc(ipHash)
    await db.runTransaction(async (tx) => {
      const now = Date.now()
      const recent = ((((await tx.get(limitRef)).data()?.submittedAt as number[] | undefined) ?? [])).filter(
        (t) => now - t < REVIEW_LIMITS.windowMs,
      )
      if (recent.length >= REVIEW_LIMITS.perIp) {
        throw new HttpsError('resource-exhausted', "You've already sent a few reviews today — please try again tomorrow.")
      }
      tx.set(limitRef, { submittedAt: [...recent, now] })
    })

    const pending = await db.collection('reviews').where('status', '==', 'pending').count().get()
    if (pending.data().count >= REVIEW_LIMITS.pendingMax) {
      throw new HttpsError('resource-exhausted', 'We have a lot of reviews to go through right now — please try again later.')
    }

    const reviewRef = db.collection('reviews').doc()
    const photoPaths = await Promise.all(
      parsedPhotos.map(async ({ bytes, contentType, ext }, i) => {
        const path = `reviews/${reviewRef.id}/${i}.${ext}`
        await storage.bucket().file(path).save(bytes, { contentType, resumable: false })
        return path
      }),
    )

    await reviewRef.set({
      name: trimmedName || null,
      rating,
      comment: trimmedComment,
      photoPaths,
      status: 'pending',
      // Only a flag, never the uid: approved reviews are publicly readable.
      verified: Boolean(request.auth),
      createdAt: FieldValue.serverTimestamp(),
    })

    return { id: reviewRef.id }
  }),
)
