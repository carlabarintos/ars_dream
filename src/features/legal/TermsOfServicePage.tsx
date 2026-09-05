import { LegalPageLayout } from './LegalPageLayout'

export function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="September 5, 2026">
      <section>
        <p>
          These Terms of Service ("Terms") govern your use of the ARS Dream Sports booking platform,
          operated by ARS Dream Sports ("ARS Dream", "we", "us"), a Manila-based marathon tour operator
          arranging travel packages to international marathon events (New York, Berlin, London, Tokyo,
          Sydney, and others). By creating an account or submitting a registration, you agree to these
          Terms.
        </p>
      </section>

      <section>
        <h2>1. How registration works</h2>
        <p>
          Tour packages have limited capacity. Joining a marathon's queue does not guarantee a spot.
          Your registration moves through review (queued → accepted → terms accepted → payment submitted
          → confirmed) at ARS Dream's discretion, based on available capacity. ARS Dream may reject an
          application at the queue-review stage, or reject submitted proof of payment, without being
          obligated to disclose its internal review criteria.
        </p>
      </section>

      <section>
        <h2>2. Payments</h2>
        <p>
          A registration is only confirmed once ARS Dream has verified your submitted proof of payment.
          Submitting proof of payment does not by itself confirm your package — see our{' '}
          <a href="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </a>{' '}
          for what happens if payment is rejected or a confirmed booking is later cancelled.
        </p>
      </section>

      <section>
        <h2>3. Your responsibilities</h2>
        <ul>
          <li>Provide accurate personal, contact, and payment information.</li>
          <li>Meet any event-specific eligibility requirements (age, medical fitness, visa/travel documents).</li>
          <li>Respond to questionnaire requirements before your payment window closes.</li>
        </ul>
      </section>

      <section>
        <h2>4. Account suspension</h2>
        <p>
          ARS Dream may suspend or terminate an account it reasonably believes is being used to abuse the
          registration queue (for example, scripted or automated signups) or to defraud other registrants.
        </p>
      </section>

      <section>
        <h2>5. Limitation of liability</h2>
        <p>
          ARS Dream acts as a booking intermediary for third-party events and travel providers. We are not
          liable for cancellations, delays, or changes made by race organizers, airlines, or accommodation
          providers, beyond what is required by Philippine consumer protection law.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>Questions about these Terms can be sent to support@arsdreamsports.com.</p>
      </section>
    </LegalPageLayout>
  )
}
