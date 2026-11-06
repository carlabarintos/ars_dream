import { formatPackagePrice } from '@/lib/utils'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { changeOfferedPackages, changeRegistrationPackage } from '@/features/registrations/api'
import { areRunnerRowsValid, filledRunnerRows, toRunnerRows } from '@/features/registrations/registration-flow'
import type { Marathon, Registration } from '@/types'

import { runnerShare } from '../../../functions/src/email-template'
import { OptionalRunnerFields } from './OptionalRunnerFields'

/** Lets an admin swap a registrant's package/add-ons at any stage; the change is logged to the booking's history. */
export function ChangePackageDialog({
  registration,
  marathon,
  leadEmail,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  leadEmail: string | null | undefined
  onClose: () => void
}) {
  // Still on an open offer: nothing is chosen yet, so change which packages they may pick from.
  if (registration.status === 'accepted') {
    return <ChangeOfferedPackagesDialog registration={registration} marathon={marathon} leadEmail={leadEmail} onClose={onClose} />
  }
  return <ChangeChosenPackageDialog registration={registration} marathon={marathon} leadEmail={leadEmail} onClose={onClose} />
}

function ChangeOfferedPackagesDialog({
  registration,
  marathon,
  leadEmail,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  leadEmail: string | null | undefined
  onClose: () => void
}) {
  const packages = marathon?.packages ?? []
  const [ids, setIds] = useState(() => registration.offeredPackageIds ?? [registration.packageId].filter(Boolean))
  const [runners, setRunners] = useState(() => toRunnerRows(registration.suggestedCompanions))
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Runner 2's own offer is on the lead's package, so they name nobody.
  const runnersNeeded = registration.partOf
    ? 0
    : Math.max(1, ...packages.filter((p) => ids.includes(p.id)).map((p) => p.runnerCount ?? 1)) - 1
  const offeredRunners = Array.from({ length: runnersNeeded }, (_, i) => runners[i] ?? { name: '', email: '' })

  async function handleSave() {
    setIsSubmitting(true)
    try {
      await changeOfferedPackages(registration.id, ids, filledRunnerRows(offeredRunners))
      toast.success('Offered packages updated.')
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
          <DialogTitle>Change Offered Packages</DialogTitle>
          <DialogDescription>
            The registrant picks one of these when accepting their offer. The change is recorded in the booking's
            messages &amp; history.
          </DialogDescription>
        </DialogHeader>

        {packages.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Checkbox
              id={`offer-pkg-${p.id}`}
              checked={ids.includes(p.id)}
              onCheckedChange={(v) => setIds((cur) => (v === true ? [...cur, p.id] : cur.filter((id) => id !== p.id)))}
            />
            <Label htmlFor={`offer-pkg-${p.id}`} className="flex-1 text-sm font-normal">
              {p.name} — {formatPackagePrice(p.priceCurrency, p.priceAmount)}
            </Label>
          </div>
        ))}

        <OptionalRunnerFields count={runnersNeeded} rows={runners} leadEmail={leadEmail} onChange={setRunners} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSubmitting} disabled={!ids.length || !areRunnerRowsValid(offeredRunners, leadEmail)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangeChosenPackageDialog({
  registration,
  marathon,
  leadEmail,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  leadEmail: string | null | undefined
  onClose: () => void
}) {
  const packages = marathon?.packages ?? []
  const [packageId, setPackageId] = useState(registration.packageId)
  const [addOnIds, setAddOnIds] = useState(() => (registration.selectedAddOns ?? []).map((addOn) => addOn.addOnId))
  const [runners, setRunners] = useState(() => toRunnerRows(registration.companions))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pkg = packages.find((p) => p.id === packageId)
  const runnersNeeded = registration.partOf ? 0 : (pkg?.runnerCount ?? 1) - 1
  const packageRunners = Array.from({ length: runnersNeeded }, (_, i) => runners[i] ?? { name: '', email: '' })
  // Blanking a linked runner here would skip Remove Runner's handling of their package and seat.
  const blankedLinkedRunner = packageRunners.some((row, i) => registration.companions?.[i]?.email && !row.email.trim())
  // Mandatory add-ons are always included, whatever was toggled.
  const addOns = (pkg?.addOns ?? []).filter((addOn) => addOn.mandatory || addOnIds.includes(addOn.id))
  const total = (pkg ? runnerShare(pkg) : 0) + addOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)

  async function handleSave() {
    if (!pkg) return
    setIsSubmitting(true)
    try {
      await changeRegistrationPackage(registration, pkg, addOns, marathon, filledRunnerRows(packageRunners))
      toast.success('Package updated.')
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
          <DialogTitle>Change Package</DialogTitle>
          <DialogDescription>
            Currently {registration.packageName}. The change is recorded in the booking's messages &amp; history.
          </DialogDescription>
        </DialogHeader>

        <Select value={packageId} onValueChange={setPackageId}>
          <SelectTrigger>
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

        {(pkg?.addOns ?? []).map((addOn) => (
          <div key={addOn.id} className="flex items-center gap-2">
            <Checkbox
              id={`change-addon-${addOn.id}`}
              checked={addOn.mandatory || addOnIds.includes(addOn.id)}
              disabled={addOn.mandatory}
              onCheckedChange={(v) =>
                setAddOnIds((ids) => (v === true ? [...ids, addOn.id] : ids.filter((id) => id !== addOn.id)))
              }
            />
            <Label htmlFor={`change-addon-${addOn.id}`} className="flex-1 text-sm font-normal">
              {addOn.name}
              {addOn.mandatory && <span className="text-muted-foreground text-xs"> (required)</span>}
            </Label>
            <span className="text-muted-foreground text-xs">
              +{pkg!.priceCurrency} {addOn.priceAmount.toLocaleString()}
            </span>
          </div>
        ))}

        <OptionalRunnerFields count={runnersNeeded} rows={runners} leadEmail={leadEmail} onChange={setRunners} />
        {blankedLinkedRunner && (
          <p className="text-destructive text-xs" role="alert">
            To take a runner off this package, use Remove Runner.
          </p>
        )}

        {pkg && (
          <p className="text-sm">
            New total:{' '}
            <span className="font-semibold">
              {pkg.priceCurrency} {total.toLocaleString()}
            </span>
          </p>
        )}
        {registration.finalInvoice && (
          <p className="text-muted-foreground text-sm">
            {registration.status === 'confirmed'
              ? "The paid invoice isn't changed — issue an Additional Invoice afterwards to bill the difference."
              : 'The final invoice is updated to the new package and re-sent.'}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSubmitting}
            disabled={!pkg || blankedLinkedRunner || !areRunnerRowsValid(packageRunners, leadEmail)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
