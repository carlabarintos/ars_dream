import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathon } from '@/features/marathons/use-marathons'
import { BookingChatDialog } from '@/features/messages/BookingChatDialog'
import { cancelRegistration, decideQueueRegistration, sendReminder, swapQueuePositions } from '@/features/registrations/api'
import {
  getPendingActionStep,
  hasChosenPackage,
  isBookingComplete,
  isOverdue,
  PENDING_ACTION_REMINDER,
} from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Registration } from '@/types'

import { BookingDetailDialog } from './BookingDetailDialog'
import { BookingProgress } from '@/features/registrations/BookingTimeline'
import { BulkWaitlistDialog } from './BulkWaitlistDialog'
import { exportQueueCsv } from './export-import/full-export'
import { ImportDialog } from './export-import/ImportDialog'
import { ChangePackageDialog } from './ChangePackageDialog'
import { FinalInvoiceDialog } from './FinalInvoiceDialog'
import { OfferChatDialog } from './OfferChatDialog'
import { PaymentProofsDialog } from './PaymentProofsDialog'

// A registration only ever reaches these statuses by first being accepted out of the queue
// (or, for 'cancelled', by being withdrawn by the registrant themselves at any step), so they
// still belong on this page even though they've since moved past the 'accepted' step.
const ALL_DECIDED_STATUSES: Registration['status'][] = [
  'queued',
  'accepted',
  'rejected',
  'terms_accepted',
  'payment_submitted',
  'deposit_paid',
  'final_invoiced',
  'confirmed',
  'payment_rejected',
  'cancelled',
]

type StatusFilter = 'all' | 'overdue' | 'queued' | 'accepted' | 'deposit_paid' | 'rejected' | 'cancelled'

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All statuses',
  overdue: 'Overdue',
  queued: 'Queued',
  accepted: 'Offered',
  deposit_paid: 'Deposit Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function matchesStatusFilter(registration: Registration, filter: StatusFilter) {
  switch (filter) {
    case 'all':
      return true
    case 'overdue':
      return isOverdue(registration)
    case 'queued':
      return registration.status === 'queued'
    case 'accepted':
      return ['accepted', 'terms_accepted', 'payment_submitted', 'deposit_paid', 'final_invoiced', 'confirmed'].includes(
        registration.status,
      )
    case 'deposit_paid':
      return registration.status === 'deposit_paid'
    case 'rejected':
      return ['rejected', 'payment_rejected'].includes(registration.status)
    case 'cancelled':
      return registration.status === 'cancelled'
  }
}

export function QueueReviewPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const { marathon } = useMarathon(marathonId)
  const { registrations, isLoading } = useMarathonRegistrations(marathonId, marathon?.cycle ?? 1, ALL_DECIDED_STATUSES)
  const orderedRegistrations = [...registrations].sort(
    (a, b) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity),
  )
  const profiles = useUserProfilesByIds(orderedRegistrations.map((registration) => registration.userId))
  const [decidingKey, setDecidingKey] = useState<string | null>(null)
  const [reviewingOffer, setReviewingOffer] = useState<Registration | null>(null)
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  // Ids, re-derived live from the subscription, so an open dialog never acts on a stale snapshot.
  const [chatRegistrationId, setChatRegistrationId] = useState<string | null>(null)
  const [invoiceRegistrationId, setInvoiceRegistrationId] = useState<string | null>(null)
  const chatRegistration = registrations.find((r) => r.id === chatRegistrationId)
  const invoiceRegistration = registrations.find((r) => r.id === invoiceRegistrationId)
  const [packageRegistrationId, setPackageRegistrationId] = useState<string | null>(null)
  const packageRegistration = registrations.find((r) => r.id === packageRegistrationId)
  const [paymentsRegistrationId, setPaymentsRegistrationId] = useState<string | null>(null)
  const paymentsRegistration = registrations.find((r) => r.id === paymentsRegistrationId)
  const [detailRegistrationId, setDetailRegistrationId] = useState<string | null>(null)
  const detailRegistration = registrations.find((r) => r.id === detailRegistrationId)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const statusFilteredRegistrations = orderedRegistrations.filter((registration) =>
    matchesStatusFilter(registration, statusFilter),
  )
  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(
    statusFilteredRegistrations,
    (registration, q) => {
      const profile = profiles[registration.userId]
      return formatUserName(profile).toLowerCase().includes(q) || (profile?.email ?? '').toLowerCase().includes(q)
    },
  )

  async function handleDecision(id: string, decision: 'accepted' | 'rejected') {
    setDecidingKey(`${id}-${decision}`)
    try {
      await decideQueueRegistration(id, decision)
      toast.success(decision === 'accepted' ? 'Offer sent.' : 'Registration rejected.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  // Neighbours come from the full queue, not the filtered/paginated view.
  const queued = orderedRegistrations.filter((r) => r.status === 'queued' && r.queuePosition != null)

  async function handleMove(registration: Registration, offset: -1 | 1) {
    const index = queued.findIndex((r) => r.id === registration.id)
    const neighbour = queued[index + offset]
    if (index === -1 || !neighbour) return
    setDecidingKey(`${registration.id}-move`)
    try {
      await swapQueuePositions(registration, neighbour)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDecidingKey(null)
    }
  }

  async function handleCancel(registration: Registration) {
    const name = formatUserName(profiles[registration.userId])
    if (!confirm(`Cancel ${name}'s registration? They'll be notified and their slot freed up.`)) return
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

  async function handleRemind(registration: Registration) {
    const step = getPendingActionStep(registration, marathon ?? undefined)
    if (!step) return
    const name = formatUserName(profiles[registration.userId])
    const text = prompt(`Remind ${name} by email and push:`, PENDING_ACTION_REMINDER[step])?.trim()
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
            <Button onClick={() => setReviewingOffer(registration)}>Offer</Button>
            <Button
              variant="destructive"
              loading={decidingKey === `${registration.id}-rejected`}
              onClick={() => handleDecision(registration.id, 'rejected')}
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
        {hasChosenPackage(registration) && !['rejected', 'cancelled'].includes(registration.status) && (
          <Button
            variant="outline"
            title={registration.packageName}
            onClick={() => setPackageRegistrationId(registration.id)}
          >
            Change Package
          </Button>
        )}
        {registration.status === 'payment_submitted' && (
          <Button variant="outline" onClick={() => setPaymentsRegistrationId(registration.id)}>
            Review Payment
          </Button>
        )}
        {getPendingActionStep(registration, marathon ?? undefined) && (
          <Button
            variant="outline"
            loading={decidingKey === `${registration.id}-remind`}
            onClick={() => handleRemind(registration)}
          >
            Send Reminder
          </Button>
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Queue Review</h1>
        {marathonId && (
          <div className="flex flex-wrap gap-2">
            <BulkWaitlistDialog marathonId={marathonId} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportQueueCsv(marathonId, orderedRegistrations, profiles)}
            >
              Export Queue
            </Button>
            <ImportDialog
              scope={{
                mode: 'queue',
                marathonId,
                existingRegistrationIds: new Set(orderedRegistrations.map((r) => r.id)),
              }}
              trigger={
                <Button variant="outline" size="sm">
                  Restore Queue
                </Button>
              }
            />
          </div>
        )}
      </div>

      {registrations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_FILTER_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">No one is waiting in the queue right now.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No registrations match your search.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((registration) => (
              <TableRow
                key={registration.id}
                className="cursor-pointer"
                onClick={() => setDetailRegistrationId(registration.id)}
              >
                <TableCell className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {registration.queuePosition ?? '—'}
                    {registration.status === 'queued' && registration.queuePosition != null && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label="Move up"
                          disabled={decidingKey !== null || queued[0]?.id === registration.id}
                          onClick={() => handleMove(registration, -1)}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label="Move down"
                          disabled={decidingKey !== null || queued.at(-1)?.id === registration.id}
                          onClick={() => handleMove(registration, 1)}
                        >
                          <ChevronDown />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatUserName(profiles[registration.userId])}</div>
                  <div className="text-muted-foreground text-xs">{profiles[registration.userId]?.email ?? '—'}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{registration.packageName || '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge
                      status={registration.status}
                      overdue={isOverdue(registration)}
                      incomplete={!isBookingComplete(registration, marathon ?? undefined)}
                    />
                    <BookingProgress registration={registration} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {registration.createdAt?.toDate().toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {hasMore && (
        <Button variant="outline" onClick={loadMore} className="self-center">
          Load more ({filtered.length - visible.length} remaining)
        </Button>
      )}
      {detailRegistration && (
        <BookingDetailDialog
          registration={detailRegistration}
          marathon={marathon ?? undefined}
          profile={profiles[detailRegistration.userId]}
          onClose={() => setDetailRegistrationId(null)}
          actions={renderActions(detailRegistration)}
        />
      )}
      <OfferChatDialog
        registration={reviewingOffer}
        marathon={marathon ?? null}
        profile={reviewingOffer ? profiles[reviewingOffer.userId] : undefined}
        onClose={() => setReviewingOffer(null)}
      />
      {chatRegistration && adminUid && (
        <BookingChatDialog
          registration={chatRegistration}
          marathonTitle={marathon?.title ?? 'Booking'}
          viewerId={adminUid}
          viewerRole="admin"
          otherPartyLabel={formatUserName(profiles[chatRegistration.userId])}
          onClose={() => setChatRegistrationId(null)}
        />
      )}
      {packageRegistration && (
        <ChangePackageDialog
          registration={packageRegistration}
          marathon={marathon ?? null}
          onClose={() => setPackageRegistrationId(null)}
        />
      )}
      {paymentsRegistration && (
        <PaymentProofsDialog
          registration={paymentsRegistration}
          registrantName={formatUserName(profiles[paymentsRegistration.userId])}
          marathon={marathon}
          review
          onClose={() => setPaymentsRegistrationId(null)}
        />
      )}
      {invoiceRegistration && (
        <FinalInvoiceDialog
          registration={invoiceRegistration}
          marathon={marathon ?? null}
          onClose={() => setInvoiceRegistrationId(null)}
        />
      )}
    </div>
  )
}
