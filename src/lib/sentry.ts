const dsn = import.meta.env.VITE_SENTRY_DSN

let sentryPromise: Promise<typeof import('@sentry/react')> | null = null

/**
 * Dynamically imported so the SDK is never downloaded by a browser when no
 * DSN is configured — same no-op convention as the VAPID/reCAPTCHA keys in
 * firebase/config.ts, but also keeps it out of the main bundle entirely.
 */
function loadSentry() {
  if (!dsn) return null
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react').then((Sentry) => {
      Sentry.init({ dsn, tracesSampleRate: 0.1 })
      return Sentry
    })
  }
  return sentryPromise
}

export function initSentry() {
  void loadSentry()
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  void loadSentry()?.then((Sentry) => Sentry.captureException(error, extra ? { extra } : undefined))
}
