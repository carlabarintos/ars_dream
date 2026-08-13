import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { Resend } from 'resend'

export const resendApiKey = defineSecret('RESEND_API_KEY')

const FROM_ADDRESS = 'ARS Dream <no-reply@mail.arsdreamph.com>'
const BRAND_COLOR = '#1D67CD'

/**
 * Best-effort transactional email — swallows and logs any failure instead of
 * throwing, so a Resend outage (or, pre-domain-verification, its sandbox
 * restriction on non-owner recipients) never breaks the caller's Firestore
 * trigger or leaves the FCM push notification path unsent alongside it.
 */
export async function sendEmail({
  to,
  cc,
  subject,
  html,
}: {
  to: string
  cc?: string[]
  subject: string
  html: string
}): Promise<void> {
  try {
    const resend = new Resend(resendApiKey.value())
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      ...(cc && cc.length > 0 ? { cc } : {}),
      subject,
      html,
    })
    if (error) {
      logger.error('sendEmail failed', { to, subject, error })
    }
  } catch (error) {
    logger.error('sendEmail threw', { to, subject, error })
  }
}

/** Minimal branded HTML wrapper, reused for every status-change email. */
export function renderEmailHtml({
  title,
  body,
  ctaLabel,
  ctaUrl,
}: {
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
}): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: ${BRAND_COLOR}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <span style="color: #ffffff; font-size: 18px; font-weight: bold;">ARS Dream</span>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">${title}</h1>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #374151;">${body}</p>
        <a
          href="${ctaUrl}"
          style="display: inline-block; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 10px 20px; border-radius: 6px;"
        >${ctaLabel}</a>
      </div>
    </div>
  `
}
