import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathon } from '@/features/marathons/use-marathons'
import { decideQueueRegistration } from '@/features/registrations/api'
import { useMarathonRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Registration } from '@/types'

import { exportQueueCsv } from './export-import/full-export'
import { ImportDialog } from './export-import/ImportDialog'
import { OfferChatDialog } from './OfferChatDialog'

const STATUS_BADGE_VARIANT: Record<Exclude<Registration['status'], 'queued'>, 'success' | 'destructive' | 'secondary'> = {
  accepted: 'success',
  rejected: 'destructive',
  terms_accepted: 'success',
  payment_submitted: 'success',
  confirmed: 'success',
  payment_rejected: 'destructive',
  cancelled: 'secondary',
}

const STATUS_BADGE_LABEL: Record<Exclude<Registration['status'], 'queued'>, string> = {
  accepted: 'Offered',
  rejected: 'Rejected',
  terms_accepted: 'Offered',
  payment_submitted: 'Offered',
  confirmed: 'Offered',
  payment_rejected: 'Rejected',
  cancelled: 'Cancelled',
}

// A registration only ever reaches these statuses by first being accepted out of the queue
// (or, for 'cancelled', by being withdrawn by the registrant themselves at any step), so they
// still belong on this page even though they've since moved past the 'accepted' step.
const ALL_DECIDED_STATUSES: Registration['status'][] = [
  'queued',
  'accepted',
  'rejected',
  'terms_accepted',
  'payment_submitted',
  'confirmed',
  'payment_rejected',
  'cancelled',
]

type StatusFilter = 'all' | 'queued' | 'accepted' | 'rejected' | 'cancelled'

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All statuses',
  queued: 'Queued',
  accepted: 'Offered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function matchesStatusFilter(registration: Registration, filter: StatusFilter) {
  switch (filter) {
    case 'all':
      return true
    case 'queued':
      return registration.status === 'queued'
    case 'accepted':
      return ['accepted', 'terms_accepted', 'payment_submitted', 'confirmed'].includes(registration.status)
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Queue Review</h1>
        {marathonId && (
          <div className="flex gap-2">
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((registration) => (
              <TableRow key={registration.id}>
                <TableCell className="text-muted-foreground">{registration.queuePosition ?? '—'}</TableCell>
                <TableCell>{formatUserName(profiles[registration.userId])}</TableCell>
                <TableCell className="text-muted-foreground">
                  {profiles[registration.userId]?.email ?? '—'}
                </TableCell>
                <TableCell>{registration.createdAt?.toDate().toLocaleString()}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  {registration.status === 'queued' ? (
                    <>
                      <Button size="sm" onClick={() => setReviewingOffer(registration)}>
                        Offer
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={decidingKey === `${registration.id}-rejected`}
                        onClick={() => handleDecision(registration.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant={
                        STATUS_BADGE_VARIANT[registration.status as Exclude<Registration['status'], 'queued'>]
                      }
                    >
                      {STATUS_BADGE_LABEL[registration.status as Exclude<Registration['status'], 'queued'>]}
                    </Badge>
                  )}
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
      <OfferChatDialog
        registration={reviewingOffer}
        marathon={marathon ?? null}
        profile={reviewingOffer ? profiles[reviewingOffer.userId] : undefined}
        onClose={() => setReviewingOffer(null)}
      />
    </div>
  )
}
