import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { setMarathonStatus } from '@/features/marathons/api'
import { useAllMarathons } from '@/features/marathons/use-marathons'
import type { MarathonStatus } from '@/types'

import { ExportImportControls } from './export-import/ExportImportControls'
import { MarathonFormDialog } from './MarathonFormDialog'

const STATUS_VARIANT: Record<MarathonStatus, 'secondary' | 'success' | 'destructive'> = {
  draft: 'secondary',
  published: 'success',
  closed: 'destructive',
}

export function AdminDashboard() {
  const { marathons, isLoading } = useAllMarathons()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(id: string, status: MarathonStatus) {
    setUpdatingId(id)
    try {
      await setMarathonStatus(id, status)
      toast.success(`Marathon marked as ${status}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setUpdatingId(null)
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
          <ExportImportControls />
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
            {marathons.map((marathon) => (
              <TableRow key={marathon.id}>
                <TableCell className="font-medium">{marathon.title}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[marathon.status]}>{marathon.status}</Badge>
                </TableCell>
                <TableCell>
                  {marathon.confirmedCount}/{marathon.capacity}
                </TableCell>
                <TableCell>{marathon.eventDate.toDate().toLocaleDateString()}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <MarathonFormDialog marathon={marathon} />
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/marathons/${marathon.id}/queue`}>Queue</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/marathons/${marathon.id}/payments`}>Payments</Link>
                  </Button>
                  {marathon.status !== 'published' && (
                    <Button
                      size="sm"
                      loading={updatingId === marathon.id}
                      onClick={() => handleStatusChange(marathon.id, 'published')}
                    >
                      Publish
                    </Button>
                  )}
                  {marathon.status === 'published' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={updatingId === marathon.id}
                      onClick={() => handleStatusChange(marathon.id, 'closed')}
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
    </div>
  )
}
