import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/features/auth/auth-store'
import {
  compareManualOrder,
  reopenMarathon,
  reorderMarathons,
  setMarathonStatus,
  unpublishMarathon,
} from '@/features/marathons/api'
import { useAllMarathons } from '@/features/marathons/use-marathons'
import type { Marathon, MarathonStatus } from '@/types'

import { logAdminAction } from './audit-log/api'
import { CsvWaitlistImportDialog } from './CsvWaitlistImportDialog'
import { ClearDataDialog } from './danger-zone/ClearDataDialog'
import { ExportImportControls } from './export-import/ExportImportControls'
import { MarathonFormDialog } from './MarathonFormDialog'
import { hasUnseenActivity } from './use-acknowledge-marathon'
import { NotificationSettingsDialog } from './NotificationSettingsDialog'

const STATUS_VARIANT: Record<MarathonStatus, 'secondary' | 'success' | 'destructive'> = {
  draft: 'secondary',
  published: 'success',
  closed: 'destructive',
}

export function AdminDashboard() {
  const { marathons, isLoading } = useAllMarathons()
  const actorId = useAuthStore((state) => state.firebaseUser?.uid)
  const actorProfile = useAuthStore((state) => state.profile)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [reopening, setReopening] = useState<Marathon | null>(null)
  const [isReopening, setIsReopening] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  // Date-TBA marathons can't be ordered by date, so the admin orders them by hand; they stay listed first
  const tbaMarathons = marathons.filter((m) => !m.eventDate).sort(compareManualOrder)
  const rows = [...tbaMarathons, ...marathons.filter((m) => m.eventDate)]

  async function handleMove(index: number, delta: -1 | 1) {
    const ids = tbaMarathons.map((m) => m.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    setIsReordering(true)
    try {
      await reorderMarathons(ids)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsReordering(false)
    }
  }

  async function handleStatusChange(marathon: Marathon, status: MarathonStatus) {
    setUpdatingId(marathon.id)
    try {
      await (status === 'draft' ? unpublishMarathon(marathon.id) : setMarathonStatus(marathon.id, status))
      if (actorId) {
        await logAdminAction({
          actorId,
          actorName: actorProfile?.displayName ?? null,
          actorEmail: actorProfile?.email ?? null,
          action:
            status === 'published' ? 'marathon_published' : status === 'draft' ? 'marathon_unpublished' : 'marathon_closed',
          targetType: 'marathon',
          targetId: marathon.id,
          targetLabel: marathon.title,
        })
      }
      toast.success(`Marathon marked as ${status}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleReopen() {
    if (!reopening) return
    setIsReopening(true)
    try {
      const { carriedForward } = await reopenMarathon(reopening.id)
      toast.success(
        carriedForward > 0
          ? `Reopened — ${carriedForward} ${carriedForward === 1 ? 'person' : 'people'} moved into the new queue.`
          : 'Reopened for a new round.',
      )
      setReopening(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsReopening(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Admin</h1>
          <p className="text-muted-foreground mt-1">Manage marathon tours and review registrations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/users">Manage Users</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/questionnaire-templates">Manage Questionnaire Templates</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/audit-log">Audit Log</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/revenue">Revenue</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/funnel-analytics">Funnel Analytics</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/legal-content">Legal Pages</Link>
          </Button>
          <ExportImportControls />
          <CsvWaitlistImportDialog marathons={marathons} />
          <NotificationSettingsDialog />
          <ClearDataDialog />
          <MarathonFormDialog />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Spots</TableHead>
              <TableHead>Event Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((marathon, index) => (
              <TableRow key={marathon.id}>
                <TableCell className="font-medium">
                  {index < tbaMarathons.length && (
                    <span className="mr-2 inline-flex align-middle">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Move ${marathon.title} up`}
                        disabled={isReordering || index === 0}
                        onClick={() => handleMove(index, -1)}
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Move ${marathon.title} down`}
                        disabled={isReordering || index === tbaMarathons.length - 1}
                        onClick={() => handleMove(index, 1)}
                      >
                        <ChevronDown />
                      </Button>
                    </span>
                  )}
                  {marathon.title}
                  {hasUnseenActivity(marathon, actorProfile) && (
                    <span
                      className="bg-destructive ml-2 inline-block size-2 rounded-full align-middle"
                      title="New activity since you last opened this marathon"
                      aria-label="New activity"
                    />
                  )}
                  {marathon.code && <span className="text-muted-foreground ml-2 font-mono text-xs">{marathon.code}</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[marathon.status]}>{marathon.status}</Badge>
                </TableCell>
                <TableCell>
                  {marathon.confirmedCount}/{marathon.capacity || 'TBA'}
                </TableCell>
                <TableCell>{marathon.eventDate?.toDate().toLocaleDateString() ?? 'TBA'}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <MarathonFormDialog marathon={marathon} />
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/marathons/${marathon.id}/queue`}>Queue</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/marathons/${marathon.id}/payments`}>Payments</Link>
                  </Button>
                  {marathon.status === 'draft' && (
                    <Button
                      size="sm"
                      loading={updatingId === marathon.id}
                      onClick={() => handleStatusChange(marathon, 'published')}
                    >
                      Publish
                    </Button>
                  )}
                  {marathon.status === 'closed' && (
                    <Button size="sm" onClick={() => setReopening(marathon)}>
                      Reopen
                    </Button>
                  )}
                  {marathon.status === 'published' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingId === marathon.id}
                      onClick={() => handleStatusChange(marathon, 'draft')}
                    >
                      Back to draft
                    </Button>
                  )}
                  {marathon.status === 'published' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={updatingId === marathon.id}
                      onClick={() => handleStatusChange(marathon, 'closed')}
                    >
                      Close
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!reopening} onOpenChange={(open) => !open && setReopening(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen "{reopening?.title}"?</DialogTitle>
            <DialogDescription>
              This starts a fresh registration round with full capacity available again. Everyone still
              waiting in the queue, or mid-review (accepted, terms accepted, or payment submitted), moves
              into a new queue in their original order. Registrants who already completed their trip, or
              were previously rejected, are left untouched as history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(null)}>
              Cancel
            </Button>
            <Button onClick={handleReopen} loading={isReopening}>
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
