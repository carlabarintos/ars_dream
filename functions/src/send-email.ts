import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { Resend } from 'resend'

export const resendApiKey = defineSecret('RESEND_API_KEY')

const FROM_ADDRESS = 'ARS Dream <no-reply@mail.arsdreamsports.com>'

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
