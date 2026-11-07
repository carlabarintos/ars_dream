import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
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
  getOfferedPackagesLabel,
  getPendingActionLabel,
  getPendingActionStep,
  isOverdue,
} from '@/features/registrations/registration-flow'
import { RunnerLinkNote } from '@/features/registrations/RunnerLinkNote'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import { cn } from '@/lib/utils'
import type { Marathon, Registration } from '@/types'

import { BookingProgress } from '@/features/registrations/BookingTimeline'
import { BulkWaitlistDialog } from './BulkWaitlistDialog'
import { exportQueueCsv } from './export-import/full-export'
import { ImportDialog } from './export-import/ImportDialog'
import { groupByPackage, samePackage } from './package-rows'
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

// Values double as the header's aria-sort. 'none' keeps queue order.
const NEXT_SORT = { none: 'descending', descending: 'ascending', ascending: 'none' } as const
const SORT_ICON = { none: ChevronsUpDown, descending: ChevronDown, ascending: ChevronUp }

const updatedMillis = (registration: Registration) => registration.updatedAt?.toMillis() ?? 0

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
  const [updatedSort, setUpdatedSort] = useState<keyof typeof NEXT_SORT>('none')
  const SortIcon = SORT_ICON[updatedSort]
  const statusFilteredRegistrations = orderedRegistrations.filter(
    (registration) =>
      matchesStatusFilter(registration, statusFilter) &&
      (showCancelled || statusFilter === 'cancelled' || registration.status !== 'cancelled'),
  )
  // Display only: moves and the CSV export keep using orderedRegistrations.
  const sortedRegistrations =
    updatedSort === 'none'
      ? statusFilteredRegistrations
      : [...statusFilteredRegistrations].sort(
          (a, b) => (updatedMillis(a) - updatedMillis(b)) * (updatedSort === 'ascending' ? 1 : -1),
        )
  const { query, setQuery, filtered, visible, loadMore } = usePaginatedSearch(
    sortedRegistrations,
    (registration, q) => {
      const profile = profiles[registration.userId]
      return formatUserName(profile).toLowerCase().includes(q) || (profile?.email ?? '').toLowerCase().includes(q)
    },
  )

  // Payments under review and confirmed bookings always show in full; only "Others" pages, reusing the hook's page size.
  // Runners on one package stay together, in the section the most urgent of them belongs to.
  const packages = groupByPackage(filtered)
  const isUnderReview = (group: Registration[]) => group.some((r) => r.status === 'payment_submitted')
  const underReview = packages.filter(isUnderReview).flat()
  const reviewed = packages.filter((group) => !isUnderReview(group))
  const confirmed = reviewed.filter((group) => group.some(hasLockedSlot)).flat()
  const others = reviewed.filter((group) => !group.some(hasLockedSlot)).flat()
  const othersShown = others.slice(0, visible.length)

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
        <div className="flex flex-col gap-4">
          {[
            { title: 'Payment Under Review', group: underReview },
            { title: 'Confirmed (deposit paid)', group: confirmed },
            { title: 'Others', group: othersShown },
          ].map(({ title, group }) =>
            group.length === 0 ? null : (
              <details key={title} open className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                  <ChevronDown className="size-4 -rotate-90 transition-transform group-open:rotate-0" />
                  {title} <span className="text-muted-foreground text-sm">({group.length})</span>
                </summary>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead aria-sort={updatedSort}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8"
                          onClick={() => setUpdatedSort(NEXT_SORT[updatedSort])}
                        >
                          Last Update
                          <SortIcon />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.map((registration, index) => {
                      const isPaired =
                        samePackage(registration, group[index - 1]) || samePackage(registration, group[index + 1])
                      return (
                      <TableRow
                        key={registration.id}
                        className={cn(
                          'cursor-pointer',
                          isPaired && 'bg-primary/5',
                          samePackage(registration, group[index + 1]) && 'border-b-0',
                        )}
                        onClick={() => openDetail(registration.id)}
                      >
                        <TableCell
                          className={cn('text-muted-foreground', isPaired && 'border-l-primary border-l-2')}
                          onClick={(e) => e.stopPropagation()}
                        >
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
                          <RunnerLinkNote registration={registration} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.packageName || getOfferedPackagesLabel(registration, marathon) || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge
                              registration={registration}
                              marathon={marathon}
                            />
                            <BookingProgress registration={registration} />
                            <PendingActionNote registration={registration} marathon={marathon ?? undefined} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.createdAt?.toDate().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {registration.updatedAt?.toDate().toLocaleString() ?? '—'}
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </details>
            ),
          )}
        </div>
      )}
      {othersShown.length < others.length && (
        <Button variant="outline" onClick={loadMore} className="self-center">
          Load more ({others.length - othersShown.length} remaining)
        </Button>
      )}
      {dialogs}
    </div>
  )
}

/** Deposit approved and the seat still held. */
function hasLockedSlot(registration: Registration) {
  return registration.depositPaidAt != null && registration.status !== 'cancelled'
}

/** What the registrant still owes, e.g. "Waiting on: Answer Health Declaration". */
function PendingActionNote({ registration, marathon }: { registration: Registration; marathon: Marathon | undefined }) {
  const step = getPendingActionStep(registration, marathon)
  if (!step) return null
  return <span className="text-muted-foreground text-xs">Waiting on: {getPendingActionLabel(step, registration, marathon)}</span>
}
