import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathon } from '@/features/marathons/use-marathons'
import { swapQueuePositions } from '@/features/registrations/api'
import {
  getPendingActionLabel,
  getPendingActionStep,
  isBookingComplete,
  isOverdue,
} from '@/features/registrations/registration-flow'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Marathon, Registration } from '@/types'

import { BookingProgress } from '@/features/registrations/BookingTimeline'
import { BulkWaitlistDialog } from './BulkWaitlistDialog'
import { exportQueueCsv } from './export-import/full-export'
import { ImportDialog } from './export-import/ImportDialog'
import { useAcknowledgeMarathon } from './use-acknowledge-marathon'
import { useBookingActions } from './use-booking-actions'

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
  useAcknowledgeMarathon(marathon)
  const { registrations, isLoading } = useMarathonRegistrations(marathonId, marathon?.cycle ?? 1, ALL_DECIDED_STATUSES)
  const orderedRegistrations = [...registrations].sort(
    (a, b) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity),
  )
  const profiles = useUserProfilesByIds(orderedRegistrations.map((registration) => registration.userId))
  const { openDetail, dialogs, decidingKey, setDecidingKey } = useBookingActions(
    registrations,
    () => marathon ?? undefined,
    (registration) => profiles[registration.userId],
  )
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCancelled, setShowCancelled] = useState(false)
  const statusFilteredRegistrations = orderedRegistrations.filter(
    (registration) =>
      matchesStatusFilter(registration, statusFilter) &&
      (showCancelled || statusFilter === 'cancelled' || registration.status !== 'cancelled'),
  )
  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(
    statusFilteredRegistrations,
    (registration, q) => {
      const profile = profiles[registration.userId]
      return formatUserName(profile).toLowerCase().includes(q) || (profile?.email ?? '').toLowerCase().includes(q)
    },
  )

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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showCancelled} onCheckedChange={(checked) => setShowCancelled(checked === true)} />
            Show cancelled
          </label>
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
                onClick={() => openDetail(registration.id)}
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
                    <PendingActionNote registration={registration} marathon={marathon ?? undefined} />
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
      {dialogs}
    </div>
  )
}

/** What the registrant still owes, e.g. "Waiting on: Answer Health Declaration". */
function PendingActionNote({ registration, marathon }: { registration: Registration; marathon: Marathon | undefined }) {
  const step = getPendingActionStep(registration, marathon)
  if (!step) return null
  return <span className="text-muted-foreground text-xs">Waiting on: {getPendingActionLabel(step, registration, marathon)}</span>
}
