import { formatPackagePrice } from '@/lib/utils'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { changeOfferedPackages, changeRegistrationPackage } from '@/features/registrations/api'
import type { Marathon, Registration } from '@/types'

/** Lets an admin swap a registrant's package/add-ons at any stage; the change is logged to the booking's history. */
export function ChangePackageDialog({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  onClose: () => void
}) {
  // Still on an open offer: nothing is chosen yet, so change which packages they may pick from.
  if (registration.status === 'accepted') {
    return <ChangeOfferedPackagesDialog registration={registration} marathon={marathon} onClose={onClose} />
  }
  return <ChangeChosenPackageDialog registration={registration} marathon={marathon} onClose={onClose} />
}

function ChangeOfferedPackagesDialog({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  onClose: () => void
}) {
  const packages = marathon?.packages ?? []
  const [ids, setIds] = useState(() => registration.offeredPackageIds ?? [registration.packageId].filter(Boolean))
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSave() {
    setIsSubmitting(true)
    try {
      await changeOfferedPackages(registration.id, ids)
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSubmitting} disabled={!ids.length}>
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
  onClose,
}: {
  registration: Registration
  marathon: Marathon | null
  onClose: () => void
}) {
  const packages = marathon?.packages ?? []
  const [packageId, setPackageId] = useState(registration.packageId)
  const [addOnIds, setAddOnIds] = useState(() => (registration.selectedAddOns ?? []).map((addOn) => addOn.addOnId))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pkg = packages.find((p) => p.id === packageId)
  // Mandatory add-ons are always included, whatever was toggled.
  const addOns = (pkg?.addOns ?? []).filter((addOn) => addOn.mandatory || addOnIds.includes(addOn.id))
  const total = (pkg?.priceAmount ?? 0) + addOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)

  async function handleSave() {
    if (!pkg) return
    setIsSubmitting(true)
    try {
      await changeRegistrationPackage(registration, pkg, addOns)
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
          <Button onClick={handleSave} loading={isSubmitting} disabled={!pkg}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
