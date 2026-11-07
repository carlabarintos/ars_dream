import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatUserName } from '@/features/auth/use-user-profiles'
import {
  resendRunnerInvite,
  subscribeToInternalNotes,
  subscribeToRegistrationRunnerBookings,
} from '@/features/registrations/api'
import { BookingTimeline } from '@/features/registrations/BookingTimeline'
import { QuestionnaireLink } from '@/features/registrations/QuestionnaireLink'
import { UploadedFileThumb } from '@/features/registrations/BookingDocumentDialog'
import {
  getCompanions,
  getLabelledPaymentProofs,
  getOfferedPackagesLabel,
  getPaymentProofs,
  getRunners,
  runnerPrefix,
} from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { formatPackagePrice } from '@/lib/utils'
import type { InternalNote, Marathon, Registration, RunnerBooking, RunnerDetails, UserProfile } from '@/types'

import { InternalNotes } from './InternalNotes'
import { ApprovedReferences } from './PaymentProofsDialog'

/** Whether a runner is linked to their account, and a way to chase them if they haven't taken up their invite. */
function RunnerLinkStatus({ runner, booking }: { runner: RunnerDetails; booking: RunnerBooking | undefined }) {
  const [isSending, setIsSending] = useState(false)
  if (!booking || booking.email !== runner.email?.trim().toLowerCase()) return <>Not linked yet</>
  if (booking.userId) return <>Linked</>

  async function handleResend() {
    setIsSending(true)
    try {
      await resendRunnerInvite(booking!.id)
      toast.success('Invite sent again.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      Invited, hasn't accepted yet
      {!['rejected', 'cancelled'].includes(booking.status) && (
        <Button variant="outline" size="sm" className="mt-1 w-full" loading={isSending} onClick={handleResend}>
          Resend Invite
        </Button>
      )}
    </>
  )
}

/** Everything about one booking: its history, documents, questionnaire answers and the actions its status allows. */
export function BookingDetailDialog({
  registration,
  marathon,
  profile,
  queueNumber,
  runnerTabs,
  onOpenRunner,
  actions,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  profile: UserProfile | undefined
  queueNumber: number | undefined
  /** Every booking on this one's package, for moving between runners. */
  runnerTabs: { id: string; label: string }[]
  onOpenRunner: (registrationId: string) => void
  actions: ReactNode
  onClose: () => void
}) {
  const { latest } = getPaymentProofs(registration)
  const proofs = getLabelledPaymentProofs(registration)
  const [runnerBookings, setRunnerBookings] = useState<RunnerBooking[]>([])
  // A package's bookings share one notes view; a booking outside the tabs (a runner swapped out once paying) only shows its own.
  const tabIds = runnerTabs.map((tab) => tab.id)
  const noteIds = tabIds.includes(registration.id) ? tabIds : [registration.id]
  const noteIdsKey = noteIds.join(',')
  const [notesById, setNotesById] = useState<Record<string, InternalNote[]>>({})

  useEffect(() => subscribeToRegistrationRunnerBookings(registration.id, setRunnerBookings), [registration.id])
  useEffect(() => {
    const unsubscribes = noteIdsKey.split(',').map((id) =>
      subscribeToInternalNotes(id, (notes) => setNotesById((prev) => ({ ...prev, [id]: notes }))),
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [noteIdsKey])

  const notes = noteIds
    .flatMap((id) =>
      (notesById[id] ?? []).map((note) => ({
        registrationId: id,
        note,
        label: noteIds.length > 1 ? runnerTabs.find((tab) => tab.id === id)?.label : undefined,
      })),
    )
    .sort((a, b) => b.note.createdAt.toMillis() - a.note.createdAt.toMillis())

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
              queueNumber && `Queue #${queueNumber}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {runnerTabs.length > 1 && runnerTabs.some((tab) => tab.id === registration.id) && (
          <Tabs value={registration.id} onValueChange={onOpenRunner}>
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              {runnerTabs.map(({ id, label }) => (
                <TabsTrigger key={id} value={id} className="flex-none">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
          <Tabs defaultValue="details" className="min-w-0">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="notes">Internal notes{notes.length > 0 && ` (${notes.length})`}</TabsTrigger>
            </TabsList>
            {/* data-[state=inactive]:hidden: the flex class would otherwise beat the hidden attribute and leave a gap. */}
            <TabsContent value="details" className="flex flex-col gap-6 data-[state=inactive]:hidden">
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
            </TabsContent>
            <TabsContent value="notes">
              <InternalNotes addRegistrationId={registration.id} notes={notes} />
            </TabsContent>
          </Tabs>

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
                <span className="text-muted-foreground">
                  {getOfferedPackagesLabel(registration, marathon) ?? 'No package chosen yet'}
                </span>
              )}
            </p>
            {registration.partOf && (
              <p className="text-sm">
                Runner {registration.partOf.runner} on {registration.partOf.leadName}'s booking
              </p>
            )}
            {getCompanions(registration, marathon).length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {getCompanions(registration, marathon).map((runner, i) => (
                  <li key={i}>
                    <span className="font-medium">Runner {i + 2}:</span> {runner.name || (!runner.email && 'Not given yet')}
                    {runner.email && (
                      <span className="text-muted-foreground block break-all">
                        {runner.email} · <RunnerLinkStatus runner={runner} booking={runnerBookings.find((b) => b.runner === i + 2)} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="text-muted-foreground mt-2 text-xs font-semibold tracking-wide uppercase">Actions</h3>
            <div className="flex flex-col gap-2 [&>button]:w-full">{actions}</div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
