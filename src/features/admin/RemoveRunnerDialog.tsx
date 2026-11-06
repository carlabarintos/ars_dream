import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getPackageBookings, removeRunner } from '@/features/registrations/api'
import { formatPackagePrice } from '@/lib/utils'
import type { Marathon, MarathonPackage, Registration } from '@/types'

import { runnerRemovalOutcome } from './package-rows'

type PackageBookings = Awaited<ReturnType<typeof getPackageBookings>>

const OUTCOME_TEXT = {
  invite: 'They have no booking yet, so their invite stops working.',
  restored: 'Their booking goes back to the package they were on before, keeping its status and deposit.',
  waitlist: 'They go back to their original place on the waitlist.',
  cancelled: 'Their booking is cancelled, since they had no place of their own. They can join the waitlist.',
  choose: 'They have started paying, so they carry on alone with their deposit and seat. Choose their package.',
}

function PackageSelect({
  id,
  label,
  packages,
  value,
  onChange,
}: {
  id: string
  label: string
  packages: MarathonPackage[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select a package" />
        </SelectTrigger>
        <SelectContent>
          {packages.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} — {formatPackagePrice(p.priceCurrency, p.priceAmount)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Takes a runner off a multi-runner package, from either runner's booking, and sets the package for whoever stays. To end
 * Runner 1 but keep Runner 2: remove the runner here, then cancel Runner 1, which no longer reaches them.
 */
export function RemoveRunnerDialog({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  onClose: () => void
}) {
  const [bookings, setBookings] = useState<PackageBookings | null>(null)
  const [runnerNumber, setRunnerNumber] = useState(registration.partOf?.runner ?? 2)
  const [leadPackageId, setLeadPackageId] = useState('')
  const [runnerPackageId, setRunnerPackageId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const packages = marathon?.packages ?? []
  const singlePackages = packages.filter((p) => (p.runnerCount ?? 1) === 1)

  useEffect(() => {
    getPackageBookings(registration)
      .then((result) => {
        setBookings(result)
        setLeadPackageId(result.lead.packageId)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Something went wrong'))
    // Read once on opening: the choices below are made against this view of the package.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration.id])

  const selected = bookings?.runners.find((r) => r.runner === runnerNumber)
  const outcome = selected ? runnerRemovalOutcome(selected.booking) : null
  const leadPackage = packages.find((p) => p.id === leadPackageId)
  const runnerPackage = singlePackages.find((p) => p.id === runnerPackageId)
  const isValid = !!selected && !!leadPackage && (outcome !== 'choose' || !!runnerPackage)

  async function handleRemove() {
    if (!bookings || !selected || !leadPackage) return
    setIsSubmitting(true)
    try {
      await removeRunner(
        bookings.lead,
        selected.runner,
        leadPackage,
        marathon,
        outcome === 'choose' ? (selected.booking ?? undefined) : undefined,
        outcome === 'choose' ? runnerPackage : undefined,
      )
      toast.success(`Runner ${selected.runner} removed from the package.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Runner</DialogTitle>
          <DialogDescription>
            Takes a runner off this package. Keep the package to link someone else; their seat stays held. To keep Runner 2 but
            end Runner 1's booking, remove the runner here first, then cancel Runner 1.
          </DialogDescription>
        </DialogHeader>

        {!bookings ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : bookings.runners.length === 0 ? (
          <p className="text-muted-foreground text-sm">No runners are linked to this package.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.runners.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="remove-runner">Runner to remove</Label>
                <Select value={String(runnerNumber)} onValueChange={(value) => setRunnerNumber(Number(value))}>
                  <SelectTrigger id="remove-runner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.runners.map((r) => (
                      <SelectItem key={r.runner} value={String(r.runner)}>
                        Runner {r.runner} — {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selected && outcome && (
              <p className="text-sm">
                <span className="font-medium">
                  Runner {selected.runner} ({selected.name}):
                </span>{' '}
                {OUTCOME_TEXT[outcome]}
              </p>
            )}
            {outcome === 'choose' &&
              (singlePackages.length === 0 ? (
                <p className="text-destructive text-sm" role="alert">
                  This marathon has no single-runner package. Add one first.
                </p>
              ) : (
                <PackageSelect
                  id="remove-runner-package"
                  label={`Runner ${runnerNumber}'s package`}
                  packages={singlePackages}
                  value={runnerPackageId}
                  onChange={setRunnerPackageId}
                />
              ))}
            <PackageSelect id="remove-lead-package" label="Runner 1's package" packages={packages} value={leadPackageId} onChange={setLeadPackageId} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" loading={isSubmitting} disabled={!isValid} onClick={handleRemove}>
            Remove Runner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
