import { FieldValue } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { Resend } from 'resend'

import { db } from './admin.js'

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
  registrationId,
}: {
  to: string
  cc?: string[]
  subject: string
  html: string
  /** Keeps a copy at registrations/{id}/emails so staff can see it from the booking's history. */
  registrationId?: string
}): Promise<void> {
  let failed = true
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
    } else {
      failed = false
    }
  } catch (error) {
    logger.error('sendEmail threw', { to, subject, error })
  }
  if (!registrationId) return
  try {
    await db
      .collection('registrations')
      .doc(registrationId)
      .collection('emails')
      .add({ to, cc: cc ?? [], subject, html, failed, sentAt: FieldValue.serverTimestamp() })
  } catch (error) {
    logger.error('sendEmail log failed', { registrationId, subject, error })
  }
}
