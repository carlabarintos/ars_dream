import { FieldValue } from 'firebase-admin/firestore'

import { db, messaging } from './admin.js'
import { APP_URL, renderEmailHtml, runnerCcNoteHtml } from './email-template.js'
import type { RunnerContact } from './runners.js'
import { sendEmail } from './send-email.js'

export { APP_URL }

/**
 * Best-effort push + email notification to one user, extracted from
 * onRegistrationStatusChange so reopenMarathon can reuse the same
 * fetch-tokens/send/prune-stale-tokens/send-email pattern.
 */
export async function notifyUser({
  userId,
  pushTitle,
  pushBody,
  emailSubject,
  emailBody,
  ctaLabel = 'Open ARS Dream',
  ctaUrl = APP_URL,
  emailHtml,
  cc = [],
  runners = [],
}: {
  userId: string
  pushTitle: string
  pushBody: string
  emailSubject: string
  emailBody: string
  ctaLabel?: string
  ctaUrl?: string
  /** Fully rendered email, overriding the default title/body/CTA layout (e.g. the acceptance email). */
  emailHtml?: string
  cc?: string[]
  /** Runners 2+ on a multi-runner booking: CC'd, with a note on top saying the account holder completes it for them. */
  runners?: RunnerContact[]
}): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get()

  const tokens: string[] = userDoc.data()?.fcmTokens ?? []
  if (tokens.length > 0) {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: pushTitle, body: pushBody },
      webpush: { fcmOptions: { link: '/' } },
    })

    const staleTokens = response.responses
      .map((result, index) => (result.success ? null : tokens[index]))
      .filter((token): token is string => token !== null)

    if (staleTokens.length > 0) {
      await userDoc.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) })
    }
  }

  const email: string | undefined = userDoc.data()?.email
  if (email) {
    const data = userDoc.data()
    const leadName =
      [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim() || data?.displayName?.trim() || 'The account holder'
    const html = emailHtml ?? renderEmailHtml({ title: pushTitle, body: emailBody, ctaLabel, ctaUrl })
    await sendEmail({
      to: email,
      cc: [...cc, ...runners.map((r) => r.email)],
      subject: emailSubject,
      html: runners.length ? runnerCcNoteHtml(leadName, runners) + html : html,
    })
  }
}
