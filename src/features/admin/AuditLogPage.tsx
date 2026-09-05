import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { AuditAction, AuditLogEntry } from '@/types'

import { useAuditLog } from './audit-log/use-audit-log'

const ACTION_LABEL: Record<AuditAction, string> = {
  registration_accepted: 'Accepted registration',
  registration_rejected: 'Rejected registration',
  payment_confirmed: 'Confirmed payment',
  payment_rejected: 'Rejected payment',
  marathon_published: 'Published marathon',
  marathon_closed: 'Closed marathon',
  marathon_reopened: 'Reopened marathon',
  user_role_changed: 'Changed user role',
  operational_data_cleared: 'Cleared operational data',
}

const ACTION_VARIANT: Record<AuditAction, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  registration_accepted: 'success',
  registration_rejected: 'destructive',
  payment_confirmed: 'success',
  payment_rejected: 'destructive',
  marathon_published: 'success',
  marathon_closed: 'secondary',
  marathon_reopened: 'secondary',
  user_role_changed: 'warning',
  operational_data_cleared: 'destructive',
}

function describeMetadata(entry: AuditLogEntry): string {
  if (!entry.metadata) return '—'
  return Object.entries(entry.metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

export function AuditLogPage() {
  const { entries, isLoading } = useAuditLog()
  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(
    entries,
    (entry, q) =>
      (entry.actorName ?? '').toLowerCase().includes(q) ||
      (entry.actorEmail ?? '').toLowerCase().includes(q) ||
      ACTION_LABEL[entry.action].toLowerCase().includes(q) ||
      (entry.targetLabel ?? '').toLowerCase().includes(q),
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          A permanent record of who accepted, rejected, confirmed, or reset what — for accountability once more
          than one person has admin access.
        </p>
      </div>

      <Input
        placeholder="Search by admin, action, or target…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No matching entries.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {entry.createdAt?.toDate().toLocaleString() ?? '—'}
                  </TableCell>
                  <TableCell>{entry.actorName ?? entry.actorEmail ?? entry.actorId}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[entry.action]}>{ACTION_LABEL[entry.action]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.targetLabel ?? entry.targetId}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{describeMetadata(entry)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && (
            <Button variant="outline" onClick={loadMore} className="self-center">
              Load more ({filtered.length - visible.length} remaining)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
