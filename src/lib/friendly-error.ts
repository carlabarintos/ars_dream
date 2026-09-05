import { UserFacingError } from './user-facing-error'

/**
 * Where in the user-facing app an error was caught — picks which pool of
 * on-brand fallback copy to draw from when the error itself isn't safe to
 * show verbatim.
 */
export type ErrorSurface = 'auth' | 'profile' | 'queue' | 'terms' | 'payment' | 'cancel' | 'message'

// Known Firebase Auth/Firestore/Storage error codes, translated into plain,
// non-technical language. Never show error.code or error.message for these —
// they're internal implementation detail (SDK names, security-rule outcomes)
// that shouldn't leak to a registrant.
const CODE_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': "That email and password don't match what we have on file.",
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/user-not-found': "We couldn't find an account with that email.",
  'auth/wrong-password': "That email and password don't match what we have on file.",
  'auth/email-already-in-use': 'An account with that email already exists — try signing in instead.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
  'auth/network-request-failed': 'We lost signal for a second there. Check your connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact ARS Dream support.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'permission-denied': "That's not something you're able to do right now.",
  unavailable: 'Our servers are catching their breath — please try again in a moment.',
  'deadline-exceeded': 'That took longer than expected. Please try again.',
  'resource-exhausted': "We're seeing heavy traffic right now — please try again shortly.",
  'not-found': "We couldn't find what you were looking for.",
  cancelled: 'That action was cancelled.',
  'storage/unauthorized': "That file couldn't be uploaded right now.",
  'storage/canceled': 'Upload cancelled.',
  'storage/quota-exceeded': "We're out of room for uploads right now — please contact ARS Dream support.",
  'storage/retry-limit-exceeded': 'That upload timed out. Please check your connection and try again.',
}

// Light, on-brand copy (marathon/travel wording) for anything unrecognized —
// randomized per surface so a retry doesn't feel like a broken record.
// Kept understated on purpose: this is a real travel company handling real
// bookings and payments, not a novelty app.
const FALLBACKS: Record<ErrorSurface, string[]> = {
  auth: [
    'We hit an unexpected bump at the start line — please try again.',
    "That didn't quite make it through. Give it one more try.",
  ],
  profile: [
    "Your details didn't save this time — please try again.",
    'We fumbled the handoff there — please try saving again.',
  ],
  queue: [
    "We couldn't get you into the queue just now — please try again.",
    "That entry didn't make it through. Please try again.",
  ],
  terms: ["We couldn't save that just now — please try again."],
  payment: ["We couldn't submit your proof of payment — please try again. Nothing has been charged."],
  cancel: ["We couldn't cancel that just now — please try again."],
  message: ["That message didn't make it through — please try sending it again."],
}

function pickFallback(surface: ErrorSurface): string {
  const pool = FALLBACKS[surface]
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Turns any caught error into copy that's safe to show a registrant: never
 * raw SDK error text, error codes, or stack detail. Logs the real error to
 * the console for developers, and only ever surfaces a message verbatim
 * when it's a UserFacingError or a Cloud Functions HttpsError — both are
 * always written by us, for the user, on purpose.
 */
export function getFriendlyErrorMessage(error: unknown, surface: ErrorSurface): string {
  console.error(`[${surface}]`, error)

  if (error instanceof UserFacingError) return error.message

  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (typeof code === 'string') {
    if (code.startsWith('functions/')) {
      return error instanceof Error ? error.message : pickFallback(surface)
    }
    const mapped = CODE_MESSAGES[code]
    if (mapped) return mapped
  }

  return pickFallback(surface)
}
