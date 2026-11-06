import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { BookingChatDialog } from '@/features/messages/BookingChatDialog'
import { EditRunnersDialog } from '@/features/registrations/EditRunnersDialog'
import { applySharedDeposit, cancelRegistration, decideQueueRegistration, sendReminder } from '@/features/registrations/api'
import {
  getPendingActionReminder,
  getPendingActionStep,
  getRunnerCount,
  getCompanions,
  isOnSharedPackage,
  sharedDepositMessage,
  hasChosenPackage,
  isOverdue,
} from '@/features/registrations/registration-flow'
import type { Marathon, Registration, UserProfile } from '@/types'

import { BookingDetailDialog } from './BookingDetailDialog'
import { ChangePackageDialog } from './ChangePackageDialog'
import { EXTENDABLE_STATUSES, ExtendDueDateDialog } from './ExtendDueDateDialog'
import { FinalInvoiceDialog } from './FinalInvoiceDialog'
import { OfferChatDialog } from './OfferChatDialog'
import { PaymentProofsDialog } from './PaymentProofsDialog'
import { RemoveRunnerDialog } from './RemoveRunnerDialog'
import { TRANSFERABLE_STATUSES, TransferSlotDialog } from './TransferSlotDialog'

function runnersButtonLabel(registration: Registration, marathon: Marathon | undefined) {
  const missing = getCompanions(registration, marathon).findIndex((runner) => !runner.email)
  return missing === -1 ? 'Edit Runner Details' : `Link Runner ${missing + 2}`
}

/**
 * The admin actions a booking's status allows (offer, reject, invoice, chat…) and the dialogs they open,
 * shared by Queue Review and Manage user so both offer the same controls.
 */
export function useBookingActions(
  registrations: Registration[],
  getMarathon: (registration: Registration) => Marathon | undefined,
  getProfile: (registration: Registration) => UserProfile | undefined,
) {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const [decidingKey, setDecidingKey] = useState<string | null>(null)
  // Ids, re-derived live from the subscription, so an open dialog never acts on a stale snapshot.
  const [offerRegistrationId, setOfferRegistrationId] = useState<string | null>(null)
  const [chatRegistrationId, setChatRegistrationId] = useState<string | null>(null)
  const [invoiceRegistrationId, setInvoiceRegistrationId] = useState<string | null>(null)
  const [packageRegistrationId, setPackageRegistrationId] = useState<string | null>(null)
  const [paymentsRegistrationId, setPaymentsRegistrationId] = useState<string | null>(null)
  const [detailRegistrationId, setDetailRegistrationId] = useState<string | null>(null)
  const [extendRegistrationId, setExtendRegistrationId] = useState<string | null>(null)
  const [transferRegistrationId, setTransferRegistrationId] = useState<string | null>(null)
  const [runnersRegistrationId, setRunnersRegistrationId] = useState<string | null>(null)
  const [removeRunnerRegistrationId, setRemoveRunnerRegistrationId] = useState<string | null>(null)
  const find = (id: string | null) => registrations.find((r) => r.id === id)
  const offerRegistration = registrations.find((r) => r.id === offerRegistrationId && r.status === 'queued') ?? null
  const chatRegistration = find(chatRegistrationId)
  const invoiceRegistration = find(invoiceRegistrationId)
  const packageRegistration = find(packageRegistrationId)
  const paymentsRegistration = find(paymentsRegistrationId)
  const detailRegistration = find(detailRegistrationId)
  // Only the bookings this page has loaded: Queue Review has everyone on the tour, Manage user just that person.
  const detailLeadId = detailRegistration?.partOf?.registrationId ?? detailRegistration?.id
  // By the lead's list, not just partOf: a runner swapped out once paying keeps partOf until staff sort them out.
  const isNamedByLead = (r: Registration) =>
    find(detailLeadId ?? null)?.companions?.some((c) => c.email?.trim().toLowerCase() === getProfile(r)?.email?.toLowerCase())
  const packageBookings = registrations
    .filter((r) => r.id === detailLeadId || (r.partOf?.registrationId === detailLeadId && isNamedByLead(r)))
    .sort((a, b) => (a.partOf?.runner ?? 1) - (b.partOf?.runner ?? 1))
  const runnersRegistration = find(runnersRegistrationId)
  const removeRunnerRegistration = find(removeRunnerRegistrationId)
  // Closes itself once transferred (the booking turns 'cancelled').
  const transferRegistration = registrations.find(
    (r) => r.id === transferRegistrationId && TRANSFERABLE_STATUSES.includes(r.status),
  )
  // Closes itself if the registration moves past the step being extended.
  const extendRegistration = registrations.find(
    (r) => r.id === extendRegistrationId && (EXTENDABLE_STATUSES as string[]).includes(r.status),
  )

  async function handleReject(id: string) {
    setDecidingKey(`${id}-rejected`)
    try {
      await decideQueueRegistration(id, 'rejected')
      toast.success('Registration rejected.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  async function handleCancel(registration: Registration) {
    const name = formatUserName(getProfile(registration))
    const runners = registration.companions?.some((runner) => runner.email)
      ? " This also cancels the other runners on their package, even if they've already paid."
      : ''
    if (!confirm(`Cancel ${name}'s registration? They'll be notified and their slot freed up.${runners}`)) return
    setDecidingKey(`${registration.id}-cancelled`)
    try {
      await cancelRegistration(registration.id)
      toast.success('Registration cancelled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  async function handleSharedDeposit(registration: Registration) {
    if (!confirm('Mark every other runner on this package as deposit paid, using the payment already approved?')) return
    setDecidingKey(`${registration.id}-shared-deposit`)
    try {
      toast.success(sharedDepositMessage(await applySharedDeposit(registration.id)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  async function handleRemind(registration: Registration) {
    const marathon = getMarathon(registration)
    const step = getPendingActionStep(registration, marathon)
    if (!step) return
    const name = formatUserName(getProfile(registration))
    const text = prompt(`Remind ${name} by email and push:`, getPendingActionReminder(step, registration, marathon))?.trim()
    if (!text) return
    setDecidingKey(`${registration.id}-remind`)
    try {
      await sendReminder(registration.id, text)
      toast.success(`Reminder sent to ${name}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  // The actions this registration's status allows, shown in its BookingDetailDialog.
  function renderActions(registration: Registration) {
    return (
      <>
        {registration.status === 'queued' && (
          <>
            <Button onClick={() => setOfferRegistrationId(registration.id)}>Offer</Button>
            <Button
              variant="destructive"
              loading={decidingKey === `${registration.id}-rejected`}
              onClick={() => handleReject(registration.id)}
            >
              Reject
            </Button>
          </>
        )}
        {['deposit_paid', 'final_invoiced', 'confirmed'].includes(registration.status) && (
          <Button onClick={() => setInvoiceRegistrationId(registration.id)}>
            {registration.status === 'confirmed'
              ? 'Additional Invoice'
              : registration.finalInvoice
                ? 'Edit Final Invoice'
                : 'Final Invoice'}
          </Button>
        )}
        {(registration.status === 'accepted' ||
          (hasChosenPackage(registration) && !['rejected', 'cancelled'].includes(registration.status))) && (
          <Button
            variant="outline"
            title={registration.packageName}
            onClick={() => setPackageRegistrationId(registration.id)}
          >
            Change Package
          </Button>
        )}
        {getRunnerCount(registration, getMarathon(registration)) > 1 &&
          !['rejected', 'cancelled'].includes(registration.status) && (
            <Button variant="outline" onClick={() => setRunnersRegistrationId(registration.id)}>
              {runnersButtonLabel(registration, getMarathon(registration))}
            </Button>
          )}
        {isOnSharedPackage(registration) && !['rejected', 'cancelled'].includes(registration.status) && (
          <Button variant="outline" onClick={() => setRemoveRunnerRegistrationId(registration.id)}>
            Remove Runner
          </Button>
        )}
        {isOnSharedPackage(registration) &&
          !registration.finalInvoice &&
          ['terms_accepted', 'payment_rejected', 'deposit_paid'].includes(registration.status) && (
            <Button
              variant="outline"
              loading={decidingKey === `${registration.id}-shared-deposit`}
              onClick={() => handleSharedDeposit(registration)}
            >
              Apply Shared Deposit
            </Button>
          )}
        {registration.status === 'payment_submitted' && (
          <Button variant="outline" onClick={() => setPaymentsRegistrationId(registration.id)}>
            Review Payment
          </Button>
        )}
        {getPendingActionStep(registration, getMarathon(registration)) && (
          <Button
            variant="outline"
            loading={decidingKey === `${registration.id}-remind`}
            onClick={() => handleRemind(registration)}
          >
            Send Reminder
          </Button>
        )}
        {(EXTENDABLE_STATUSES as string[]).includes(registration.status) && !(registration.status === 'accepted' && registration.partOf) && (
          <Button variant="outline" onClick={() => setExtendRegistrationId(registration.id)}>
            Extend Due Date
          </Button>
        )}
        {TRANSFERABLE_STATUSES.includes(registration.status) && (
          <Button variant="outline" onClick={() => setTransferRegistrationId(registration.id)}>
            Transfer Slot
          </Button>
        )}
        {/* Blocked server-side too (transferRegistration) so it can't race confirmPayment. */}
        {registration.status === 'payment_submitted' && (
          <div className="flex flex-col gap-1">
            <Button variant="outline" disabled aria-describedby={`transfer-note-${registration.id}`}>
              Transfer Slot
            </Button>
            <p id={`transfer-note-${registration.id}`} className="text-muted-foreground text-xs">
              A payment is pending review — approve or reject it before transferring this slot.
            </p>
          </div>
        )}
        <Button variant="outline" onClick={() => setChatRegistrationId(registration.id)}>
          Chat
        </Button>
        {isOverdue(registration) && (
          <Button
            variant="destructive"
            loading={decidingKey === `${registration.id}-cancelled`}
            onClick={() => handleCancel(registration)}
          >
            Cancel Booking
          </Button>
        )}
      </>
    )
  }

  const dialogs = (
    <>
      {detailRegistration && (
        <BookingDetailDialog
          registration={detailRegistration}
          marathon={getMarathon(detailRegistration)}
          profile={getProfile(detailRegistration)}
          runnerTabs={packageBookings.map((r) => ({
            id: r.id,
            label: `Runner ${r.partOf?.runner ?? 1} · ${formatUserName(getProfile(r))}`,
          }))}
          onOpenRunner={setDetailRegistrationId}
          onClose={() => setDetailRegistrationId(null)}
          actions={renderActions(detailRegistration)}
        />
      )}
      <OfferChatDialog
        registration={offerRegistration}
        marathon={(offerRegistration && getMarathon(offerRegistration)) ?? null}
        profile={offerRegistration ? getProfile(offerRegistration) : undefined}
        onClose={() => setOfferRegistrationId(null)}
      />
      {chatRegistration && adminUid && (
        <BookingChatDialog
          registration={chatRegistration}
          marathonTitle={getMarathon(chatRegistration)?.title ?? 'Booking'}
          viewerId={adminUid}
          viewerRole="admin"
          otherPartyLabel={formatUserName(getProfile(chatRegistration))}
          onClose={() => setChatRegistrationId(null)}
        />
      )}
      {packageRegistration && (
        <ChangePackageDialog
          registration={packageRegistration}
          marathon={getMarathon(packageRegistration) ?? null}
          leadEmail={getProfile(packageRegistration)?.email}
          onClose={() => setPackageRegistrationId(null)}
        />
      )}
      {removeRunnerRegistration && (
        <RemoveRunnerDialog
          registration={removeRunnerRegistration}
          marathon={getMarathon(removeRunnerRegistration) ?? null}
          onClose={() => setRemoveRunnerRegistrationId(null)}
        />
      )}
      {runnersRegistration && (
        <EditRunnersDialog
          registration={runnersRegistration}
          marathon={getMarathon(runnersRegistration)}
          leadEmail={getProfile(runnersRegistration)?.email}
          editedBy="admin"
          onClose={() => setRunnersRegistrationId(null)}
        />
      )}
      {paymentsRegistration && (
        <PaymentProofsDialog
          registration={paymentsRegistration}
          registrantName={formatUserName(getProfile(paymentsRegistration))}
          marathon={getMarathon(paymentsRegistration)}
          review
          onClose={() => setPaymentsRegistrationId(null)}
        />
      )}
      {extendRegistration && (
        <ExtendDueDateDialog
          registration={extendRegistration}
          marathon={getMarathon(extendRegistration)}
          onClose={() => setExtendRegistrationId(null)}
        />
      )}
      {transferRegistration && (
        <TransferSlotDialog
          registration={transferRegistration}
          registrantName={formatUserName(getProfile(transferRegistration))}
          onClose={() => setTransferRegistrationId(null)}
        />
      )}
      {invoiceRegistration && (
        <FinalInvoiceDialog
          registration={invoiceRegistration}
          marathon={getMarathon(invoiceRegistration) ?? null}
          onClose={() => setInvoiceRegistrationId(null)}
        />
      )}
    </>
  )

  return { openDetail: setDetailRegistrationId, dialogs, decidingKey, setDecidingKey }
}
