import { LegalPageLayout } from './LegalPageLayout'

export function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="September 5, 2026">
      <section>
        <p>
          This policy covers refunds for ARS Dream Sports tour package bookings. Because packages involve
          third-party costs (race entries, flights, accommodation), refund terms depend on how far along
          your registration is.
        </p>
      </section>

      <section>
        <h2>1. Before payment is submitted</h2>
        <p>
          If you cancel your registration while still queued, accepted, or before submitting proof of
          payment, no payment has been collected and there is nothing to refund.
        </p>
      </section>

      <section>
        <h2>2. Rejected proof of payment</h2>
        <p>
          If your submitted proof of payment is rejected, you have not been charged a confirmed booking
          fee by ARS Dream — resolve the issue noted by our team and resubmit, or contact support if you
          believe a real payment was made in error.
        </p>
      </section>

      <section>
        <h2>3. After a booking is confirmed</h2>
        <p>
          Once your registration reaches "confirmed," cancellation refund eligibility depends on the
          specific event's package terms and third-party providers' own cancellation policies (race
          organizers, airlines, hotels). Where a provider allows a refund, ARS Dream will pass through
          what we're able to recover, less any non-recoverable fees already paid on your behalf.
        </p>
      </section>

      <section>
        <h2>4. How to request a refund</h2>
        <p>
          Contact support@arsdreamsports.com with your registration details. We aim to respond within 5
          business days.
        </p>
      </section>
    </LegalPageLayout>
  )
}
