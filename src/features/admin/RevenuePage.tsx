import { useMemo } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { getRegistrationTotalAmount } from '@/features/registrations/registration-flow'
import { useConfirmedRegistrations } from '@/features/registrations/use-registrations'

interface MarathonRevenueRow {
  marathonId: string
  currency: string
  registrationCount: number
  totalAmount: number
}

export function RevenuePage() {
  const { registrations, isLoading } = useConfirmedRegistrations()
  const marathons = useMarathonsByIds(registrations.map((registration) => registration.marathonId))

  // Grouped by (marathon, currency) rather than marathon alone — a single event's
  // packages could in principle be priced in different currencies.
  const rows = useMemo(() => {
    const byKey = new Map<string, MarathonRevenueRow>()
    for (const registration of registrations) {
      const key = `${registration.marathonId}|${registration.packagePriceCurrency}`
      const amount = getRegistrationTotalAmount(registration)
      const existing = byKey.get(key)
      if (existing) {
        existing.registrationCount += 1
        existing.totalAmount += amount
      } else {
        byKey.set(key, {
          marathonId: registration.marathonId,
          currency: registration.packagePriceCurrency,
          registrationCount: 1,
          totalAmount: amount,
        })
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [registrations])

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of rows) {
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.totalAmount)
    }
    return Array.from(totals.entries())
  }, [rows])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Revenue</h1>
        <p className="text-muted-foreground mt-1">
          Confirmed bookings only — package price plus any add-ons, per event.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="text-muted-foreground">No confirmed bookings yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {totalsByCurrency.map(([currency, total]) => (
              <div key={currency} className="border-border bg-card rounded-lg border px-5 py-4">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">{currency} total</p>
                <p className="font-display text-2xl">
                  {currency} {total.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marathon</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.marathonId}|${row.currency}`}>
                  <TableCell className="font-medium">
                    {marathons[row.marathonId]?.title ?? 'Unknown event'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.currency}</TableCell>
                  <TableCell className="text-muted-foreground">{row.registrationCount}</TableCell>
                  <TableCell className="text-right">
                    {row.currency} {row.totalAmount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
