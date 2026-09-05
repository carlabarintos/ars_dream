import { PageSpinner } from '@/components/ui/spinner'

import { LegalPageLayout } from './LegalPageLayout'
import { useLegalContent } from './use-legal-content'

export function PrivacyPolicyPage() {
  const { content, isLoading } = useLegalContent('privacy')

  if (isLoading) return <PageSpinner />

  if (content?.body) {
    return (
      <LegalPageLayout
        title="Privacy Policy"
        lastUpdated={content.updatedAt?.toDate().toLocaleDateString() ?? '—'}
      >
        {content.body.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </LegalPageLayout>
    )
  }

  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="September 5, 2026">
      <section>
        <p>
          This Privacy Policy explains what personal data ARS Dream Sports collects through this platform,
          why, and how it's handled, in line with the Philippines' Data Privacy Act of 2012.
        </p>
      </section>

      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>Account details: name, email, contact number, date of birth, gender.</li>
          <li>Registration details: selected tour package, add-ons, and answers to any event questionnaire.</li>
          <li>Proof-of-payment images you upload when submitting payment for a package.</li>
          <li>Device push-notification tokens, if you enable notifications.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <p>
          To operate the registration queue, verify payments, communicate booking status by email and push
          notification, and provide support through in-app messaging. We do not sell your personal data.
        </p>
      </section>

      <section>
        <h2>3. Who can see it</h2>
        <p>
          ARS Dream staff (admin and finance roles) can access registration and payment data needed to run
          the queue and verify payments. Proof-of-payment images are stored privately and are never made
          public.
        </p>
      </section>

      <section>
        <h2>4. Retention</h2>
        <p>
          Registration records are kept for as long as your account exists, plus a reasonable period after
          for accounting and dispute-resolution purposes. You can request deletion by contacting us below.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          Under the Data Privacy Act, you may request access to, correction of, or deletion of your
          personal data, subject to our legitimate need to keep records of confirmed bookings and
          payments.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>Privacy questions or data requests: support@arsdreamsports.com.</p>
      </section>
    </LegalPageLayout>
  )
}
