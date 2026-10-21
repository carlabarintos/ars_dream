import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { BookingTimeline } from '@/features/registrations/BookingTimeline'
import { QuestionnaireLink } from '@/features/registrations/QuestionnaireLink'
import { getPaymentProofs, isBookingComplete, isOnFinalInvoice, isOverdue } from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { formatPackagePrice } from '@/lib/utils'
import type { Marathon, Registration, UserProfile } from '@/types'

import { ApprovedReferences } from './PaymentProofsDialog'

/** Everything about one booking: its history, documents, questionnaire answers and the actions its status allows. */
export function BookingDetailDialog({
  registration,
  marathon,
  profile,
  actions,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  profile: UserProfile | undefined
  actions: ReactNode
  onClose: () => void
}) {
  const { approved, latest } = getPaymentProofs(registration)
  const latestLabel =
    registration.status === 'payment_submitted'
      ? 'Awaiting review'
      : registration.status === 'payment_rejected'
        ? 'Rejected'
        : 'Approved'
  const paidBalanceProofs = new Set(registration.previousFinalInvoices?.flatMap((v) => v.paidProofUrls ?? []))
  const proofs = [
    ...approved.map((url) => ({ url, label: `${paidBalanceProofs.has(url) ? 'Balance' : 'Deposit'} · Approved` })),
    ...latest.map((url) => ({ url, label: `${isOnFinalInvoice(registration) ? 'Balance' : 'Deposit'} · ${latestLabel}` })),
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {formatUserName(profile)}
            <StatusBadge
              status={registration.status}
              overdue={isOverdue(registration)}
              incomplete={!isBookingComplete(registration, marathon)}
            />
          </DialogTitle>
          <DialogDescription>
            {[
              profile?.email,
              profile?.contactNumber,
              registration.queuePosition && `Queue #${registration.queuePosition}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">History</h3>
              {profile && <BookingTimeline registration={registration} marathon={marathon} profile={profile} />}
              <QuestionnaireLink registration={registration} marathon={marathon} />
            </section>

            {registration.status === 'confirmed' && (
              <section className="flex flex-col gap-3">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Passport bio page</h3>
                {registration.passportPhotoUrl ? (
                  <a href={registration.passportPhotoUrl} target="_blank" rel="noreferrer" className="w-fit">
                    <img
                      src={registration.passportPhotoUrl}
                      alt="Passport bio page"
                      className="border-border h-48 w-auto rounded-md border object-contain"
                    />
                  </a>
                ) : (
                  <p className="text-muted-foreground text-sm">Not uploaded yet.</p>
                )}
              </section>
            )}

            {proofs.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Payment proofs</h3>
                <ApprovedReferences registration={registration} />
                {registration.paymentReference && latest.length > 0 && (
                  <p className="text-sm">
                    <span className="font-semibold">Branch / Ref. no.</span> · {registration.paymentReference}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {proofs.map(({ url, label }, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="flex flex-col gap-1 text-xs">
                      <img
                        src={url}
                        alt={`Payment proof ${index + 1}`}
                        className="border-border h-36 w-auto rounded-md border object-contain"
                      />
                      <span className={label.endsWith('Rejected') ? 'text-destructive' : 'text-muted-foreground'}>
                        {label}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

          </div>

          <aside className="flex flex-col gap-3 md:border-l md:pl-6">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Booking</h3>
            <p className="text-sm">
              {registration.packageName ? (
                <>
                  <span className="font-medium">{registration.packageName}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {formatPackagePrice(registration.packagePriceCurrency, registration.packagePriceAmount)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No package chosen yet</span>
              )}
            </p>
            <h3 className="text-muted-foreground mt-2 text-xs font-semibold tracking-wide uppercase">Actions</h3>
            <div className="flex flex-col gap-2 [&>button]:w-full">{actions}</div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
