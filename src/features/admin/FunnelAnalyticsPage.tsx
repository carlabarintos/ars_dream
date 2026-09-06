import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAllRegistrationsOnce } from '@/features/registrations/api'
import { useAllMarathons } from '@/features/marathons/use-marathons'
import type { Registration, RegistrationStatus } from '@/types'

const PIPELINE_STATUSES: RegistrationStatus[] = [
  'queued',
  'accepted',
  'terms_accepted',
  'payment_submitted',
  'confirmed',
]

const EXIT_STATUSES: RegistrationStatus[] = ['rejected', 'payment_rejected', 'cancelled']

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  queued: 'Queued',
  accepted: 'Accepted',
  terms_accepted: 'Terms Accepted',
  payment_submitted: 'Payment Submitted',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  payment_rejected: 'Payment Rejected',
  cancelled: 'Cancelled',
}

function StatusBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function FunnelAnalyticsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [marathonFilter, setMarathonFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const { marathons } = useAllMarathons()

  async function refresh() {
    setIsLoading(true)
    const data = await getAllRegistrationsOnce()
    setRegistrations(data)
    setIsLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const filteredRegistrations = useMemo(() => {
    const from = fromDate ? new Date(fromDate) : null
    const to = toDate ? new Date(toDate) : null
    return registrations.filter((registration) => {
      if (marathonFilter !== 'all' && registration.marathonId !== marathonFilter) return false
      const createdAt = registration.createdAt.toDate()
      if (from && createdAt < from) return false
      if (to && createdAt > to) return false
      return true
    })
  }, [registrations, marathonFilter, fromDate, toDate])

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<RegistrationStatus, number>> = {}
    for (const registration of filteredRegistrations) {
      counts[registration.status] = (counts[registration.status] ?? 0) + 1
    }
    return counts
  }, [filteredRegistrations])

  const total = filteredRegistrations.length
  const confirmedCount = statusCounts.confirmed ?? 0
  const exitCount = EXIT_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Funnel Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Snapshot of where registrations currently stand in the pipeline — not a historical
          conversion trend, since individual status changes aren't timestamped.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Marathon</Label>
          <Select value={marathonFilter} onValueChange={setMarathonFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All marathons</SelectItem>
              {marathons.map((marathon) => (
                <SelectItem key={marathon.id} value={marathon.id}>
                  {marathon.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromDate">Joined queue from</Label>
          <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="toDate">Joined queue to</Label>
          <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <p className="text-muted-foreground">No registrations match these filters.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="border-border bg-card rounded-lg border px-5 py-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Total</p>
              <p className="font-display text-2xl">{total}</p>
            </div>
            <div className="border-border bg-card rounded-lg border px-5 py-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Confirmed</p>
              <p className="font-display text-2xl">{confirmedCount}</p>
            </div>
            <div className="border-border bg-card rounded-lg border px-5 py-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Confirmed rate</p>
              <p className="font-display text-2xl">{((confirmedCount / total) * 100).toFixed(1)}%</p>
            </div>
            <div className="border-border bg-card rounded-lg border px-5 py-4">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Exit rate</p>
              <p className="font-display text-2xl">{((exitCount / total) * 100).toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-display text-lg tracking-wide">Pipeline</h2>
            {PIPELINE_STATUSES.map((status) => (
              <StatusBar
                key={status}
                label={STATUS_LABELS[status]}
                count={statusCounts[status] ?? 0}
                total={total}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-display text-lg tracking-wide">Exited the pipeline</h2>
            {EXIT_STATUSES.map((status) => (
              <StatusBar
                key={status}
                label={STATUS_LABELS[status]}
                count={statusCounts[status] ?? 0}
                total={total}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
