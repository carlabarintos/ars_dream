import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { BookingTimeline } from '@/features/registrations/BookingTimeline'
import { QuestionnaireLink } from '@/features/registrations/QuestionnaireLink'
import { UploadedFileThumb } from '@/features/registrations/BookingDocumentDialog'
import {
  getLabelledPaymentProofs,
  getPaymentProofs,
  getRunners,
  runnerPrefix,
} from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { formatPackagePrice } from '@/lib/utils'
import type { Marathon, Registration, UserProfile } from '@/types'

import { InternalNotes } from './InternalNotes'
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
  const { latest } = getPaymentProofs(registration)
  const proofs = getLabelledPaymentProofs(registration)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {formatUserName(profile)}
            <StatusBadge
              registration={registration}
              marathon={marathon}
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
                <div className="flex flex-wrap gap-3">
                  {getRunners(registration, marathon).map((runner, i, all) =>
                    runner.passportPhotoUrl ? (
                      <UploadedFileThumb
                        key={i}
                        url={runner.passportPhotoUrl}
                        label={`${runnerPrefix(i, all.length, runner.name)}Passport bio page`}
                        className="h-48"
                      />
                    ) : (
                      <p key={i} className="text-muted-foreground text-sm">
                        {runnerPrefix(i, all.length, runner.name)}Not uploaded yet.
                      </p>
                    ),
                  )}
                </div>
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
                  {proofs.map(({ url, label }) => (
                    <UploadedFileThumb key={url} url={url} label={label} className="h-36" />
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
            {getRunners(registration, marathon).length > 1 && (
              <ul className="flex flex-col gap-1 text-sm">
                {getRunners(registration, marathon).slice(1).map((runner, i) => (
                  <li key={i}>
                    <span className="font-medium">Runner {i + 2}:</span> {runner.name || 'Name not given yet'}
                    {runner.email && <span className="text-muted-foreground block break-all">{runner.email}</span>}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="text-muted-foreground mt-2 text-xs font-semibold tracking-wide uppercase">Actions</h3>
            <div className="flex flex-col gap-2 [&>button]:w-full">{actions}</div>
            <InternalNotes registrationId={registration.id} />
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
