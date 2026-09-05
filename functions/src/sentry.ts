import { logger } from 'firebase-functions'
import { HttpsError } from 'firebase-functions/v2/https'

let sentryPromise: Promise<typeof import('@sentry/node')> | null = null

/**
 * Sentry DSNs are meant to be public (the frontend already ships one in its
 * bundle), so this is a plain runtime env var rather than a Secret Manager
 * binding — set via a committed functions/.env.<project-id> file, same
 * pattern as FIRESTORE_BACKUP_BUCKET (see scheduled-backup.ts). A Secret
 * Manager binding would also require the secret to already exist with a
 * non-empty value before every deploy, which defeats staying optional.
 *
 * Dynamically imported so @sentry/node is only ever required (and only ever
 * initialized) when an error actually needs reporting AND a DSN is
 * configured — avoids the cold-start cost of loading it in every invocation
 * of every function when Sentry isn't set up.
 */
function loadSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return null
  if (!sentryPromise) {
    sentryPromise = import('@sentry/node').then((Sentry) => {
      Sentry.init({ dsn, tracesSampleRate: 0.1 })
      return Sentry
    })
  }
  return sentryPromise
}

/**
 * Wraps a callable/trigger handler so an unexpected failure is reported to
 * Sentry before it propagates. An HttpsError is a deliberate, client-facing
 * outcome (e.g. "not-found", "resource-exhausted") rather than a bug, so it's
 * logged normally but never sent to Sentry as an error.
 */
export function withSentry<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error
      }
      logger.error('Unhandled error', error)
      const Sentry = await loadSentry()
      Sentry?.captureException(error)
      throw error
    }
  }
}
