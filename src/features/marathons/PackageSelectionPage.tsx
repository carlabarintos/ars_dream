import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/features/auth/auth-store'
import { joinQueue } from '@/features/registrations/api'
import { CancelRegistrationButton } from '@/features/registrations/CancelRegistrationButton'
import {
  canCancelRegistration,
  canChangePackage,
  canReopenWizard,
  canReRegister,
  getPendingActionStep,
  getRegistrationStatusMessage,
  getRegistrationTotalAmount,
  getWizardButtonLabel,
  needsPackageUpdate,
} from '@/features/registrations/registration-flow'
import { RegistrationWizard } from '@/features/registrations/RegistrationWizard'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import { cn } from '@/lib/utils'
import type { MarathonPackage, MarathonPackageAddOn } from '@/types'

import { PackagePhotoCarousel } from './PackagePhotoCarousel'
import { useMarathon } from './use-marathons'

function formatPrice(pkg: MarathonPackage) {
  return `${pkg.priceCurrency} ${pkg.priceAmount.toLocaleString()}`
}

function formatTotal(pkg: MarathonPackage, selectedAddOns: MarathonPackageAddOn[]) {
  const total = pkg.priceAmount + selectedAddOns.reduce((sum, addOn) => sum + addOn.priceAmount, 0)
  return `${pkg.priceCurrency} ${total.toLocaleString()}`
}

export function PackageSelectionPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const navigate = useNavigate()
  const { marathon, isLoading } = useMarathon(marathonId)
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)
  const [joiningPackageId, setJoiningPackageId] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Record<string, Set<string>>>({})

  const myRegistration = registrations.find(
    (r) => r.marathonId === marathonId && (r.cycle ?? 1) === (marathon?.cycle ?? 1),
  )

  // Once the registrant has touched a package's add-on checkboxes, that
  // becomes the source of truth for it; until then, default to whatever
  // they'd previously selected if this is the package on their existing
  // registration, so re-opening the page doesn't silently drop their picks.
  function getSelectedIdsForPackage(pkg: MarathonPackage): Set<string> {
    if (selectedAddOnIds[pkg.id]) return selectedAddOnIds[pkg.id]
    if (myRegistration && myRegistration.packageId === pkg.id) {
      return new Set((myRegistration.selectedAddOns ?? []).map((a) => a.addOnId))
    }
    return new Set()
  }

  function toggleAddOn(pkg: MarathonPackage, addOnId: string) {
    setSelectedAddOnIds((prev) => {
      const current = new Set(prev[pkg.id] ?? getSelectedIdsForPackage(pkg))
      if (current.has(addOnId)) current.delete(addOnId)
      else current.add(addOnId)
      return { ...prev, [pkg.id]: current }
    })
  }
  const pendingStep = myRegistration ? getPendingActionStep(myRegistration, marathon ?? undefined) : null
  const canSwapPackage = myRegistration ? canChangePackage(myRegistration) : false
  const canReRegisterNow = myRegistration ? canReRegister(myRegistration) : false

  const spotsLeft = marathon ? Math.max(marathon.capacity - marathon.confirmedCount, 0) : 0
  const isFull = spotsLeft <= 0
  // A fresh join and a cancelled/rejected re-registration both require the
  // marathon to still be 'published' (see firestore.rules) — an admin can
  // manually close it independent of capacity or registrationClosesAt, so
  // that must be checked here too or a stale "Register Again" link (e.g.
  // from MyRegistrationsPage, which doesn't filter by marathon status)
  // reaches a write the rules silently reject as permission-denied.
  const isClosed =
    (marathon ? new Date() > marathon.registrationClosesAt.toDate() : false) ||
    marathon?.status !== 'published'

  async function handleSelectPackage(pkg: MarathonPackage) {
    if (!uid || !marathon) return
    const isSwap = myRegistration != null && !canReRegisterNow
    const selectedIds = getSelectedIdsForPackage(pkg)
    const selectedAddOns = (pkg.addOns ?? []).filter((addOn) => selectedIds.has(addOn.id))
    setJoiningPackageId(pkg.id)
    try {
      await joinQueue(uid, marathon.id, pkg, selectedAddOns, marathon.cycle ?? 1)
      if (isSwap) {
        toast.success('Your package has been updated.')
      } else {
        toast.success("You're in the queue! We'll notify you once an admin reviews your request.")
        navigate('/')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join the queue')
    } finally {
      setJoiningPackageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!marathon) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">Marathon not found.</p>
        <Link to="/" className="text-primary text-sm underline underline-offset-2">
          Back to marathons
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Marathons</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{marathon.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-display mt-2 text-4xl tracking-wide">{marathon.title}</h1>
        <p className="text-muted-foreground mt-1">{marathon.location}</p>
      </div>

      {myRegistration && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>You already have a registration for this event</CardTitle>
              <StatusBadge status={myRegistration.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Package: {myRegistration.packageName} ({myRegistration.packagePriceCurrency}{' '}
              {myRegistration.packagePriceAmount.toLocaleString()})
            </p>
            {myRegistration.selectedAddOns && myRegistration.selectedAddOns.length > 0 && (
              <p className="text-muted-foreground">
                Add-ons: {myRegistration.selectedAddOns.map((addOn) => addOn.name).join(', ')}
              </p>
            )}
            {myRegistration.selectedAddOns && myRegistration.selectedAddOns.length > 0 && (
              <p className="font-medium">
                Total: {myRegistration.packagePriceCurrency}{' '}
                {getRegistrationTotalAmount(myRegistration).toLocaleString()}
              </p>
            )}
            <p className="text-muted-foreground">{getRegistrationStatusMessage(myRegistration)}</p>
            {needsPackageUpdate(myRegistration) ? (
              <p className="text-muted-foreground">
                Your previous package isn't available anymore — pick a new one below to keep your place in queue.
              </p>
            ) : (
              canSwapPackage && (
                <p className="text-muted-foreground">
                  You can still switch to a different package below while your registration is pending.
                </p>
              )
            )}
            {canReRegisterNow && (
              <p className="text-muted-foreground">Pick a package below to register again.</p>
            )}
          </CardContent>
          {(canReopenWizard(myRegistration) || canCancelRegistration(myRegistration)) && (
            <CardFooter className="border-border flex flex-col gap-2 border-t pt-4">
              {canReopenWizard(myRegistration) && (
                <Button className="w-full" onClick={() => setShowWizard(true)}>
                  {getWizardButtonLabel(pendingStep)}
                </Button>
              )}
              <CancelRegistrationButton registration={myRegistration} />
            </CardFooter>
          )}
        </Card>
      )}

      {!myRegistration || canSwapPackage || canReRegisterNow ? (
        (marathon.packages ?? []).length === 0 ? (
          !myRegistration && <p className="text-muted-foreground">No packages are available for this event yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marathon.packages!.map((pkg) => {
              // Swap mode = editing the package on a still-pending registration.
              // Re-register/fresh-join both start a new queue attempt, so they
              // share the same capacity/closed gating a first-time join uses.
              const isSwapMode = myRegistration != null && !canReRegisterNow
              const isCurrentPackage = isSwapMode && myRegistration!.packageId === pkg.id
              const isBlockedByCapacity = !isSwapMode && (isFull || isClosed)
              const disabled = isCurrentPackage || isBlockedByCapacity || joiningPackageId !== null
              const label = isCurrentPackage
                ? 'Current Package'
                : isBlockedByCapacity
                  ? 'Registration Closed'
                  : joiningPackageId === pkg.id
                    ? isSwapMode
                      ? 'Switching…'
                      : 'Joining…'
                    : isSwapMode
                      ? 'Switch to This Package'
                      : canReRegisterNow
                        ? 'Register Again'
                        : 'Select & Join Queue'

              const selectedIds = getSelectedIdsForPackage(pkg)
              const selectedAddOns = (pkg.addOns ?? []).filter((addOn) => selectedIds.has(addOn.id))

              return (
                <Card
                  key={pkg.id}
                  className={cn('flex flex-col', pkg.photoUrls?.length && 'gap-0 overflow-hidden py-0')}
                >
                  {pkg.photoUrls && pkg.photoUrls.length > 0 && (
                    <PackagePhotoCarousel photoUrls={pkg.photoUrls} />
                  )}
                  <CardHeader>
                    <CardTitle>{pkg.name}</CardTitle>
                    <p className="text-lg font-medium">{formatTotal(pkg, selectedAddOns)}</p>
                    {selectedAddOns.length > 0 && (
                      <p className="text-muted-foreground text-xs">Base price {formatPrice(pkg)}</p>
                    )}
                  </CardHeader>
                  <CardContent className={cn('flex-1', pkg.photoUrls?.length && 'pt-5')}>
                    {pkg.details.length > 0 && (
                      <dl className="flex flex-col gap-1.5 text-sm">
                        {pkg.details.map((detail, index) => (
                          <div key={index} className="flex justify-between gap-3">
                            <dt className="text-muted-foreground shrink-0 font-medium">{detail.label}</dt>
                            <dd className="text-right">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {pkg.addOns && pkg.addOns.length > 0 && (
                      <div
                        className={cn(
                          'flex flex-col gap-2',
                          pkg.details.length > 0 && 'border-border mt-3 border-t pt-3',
                        )}
                      >
                        <p className="text-muted-foreground text-xs font-medium">Add-ons</p>
                        {pkg.addOns.map((addOn) => {
                          const checkboxId = `addon-${pkg.id}-${addOn.id}`
                          return (
                            <div key={addOn.id} className="flex items-center gap-2">
                              <Checkbox
                                id={checkboxId}
                                checked={selectedIds.has(addOn.id)}
                                disabled={disabled}
                                onCheckedChange={() => toggleAddOn(pkg, addOn.id)}
                              />
                              <Label htmlFor={checkboxId} className="flex-1 text-sm font-normal">
                                {addOn.name}
                              </Label>
                              <span className="text-muted-foreground text-xs">
                                +{pkg.priceCurrency} {addOn.priceAmount.toLocaleString()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className={cn(pkg.photoUrls?.length && 'mt-4 border-t border-border pt-4')}>
                    <Button
                      className="w-full"
                      disabled={disabled}
                      loading={joiningPackageId === pkg.id}
                      onClick={() => handleSelectPackage(pkg)}
                    >
                      {label}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )
      ) : null}

      {showWizard && myRegistration && (
        <RegistrationWizard
          registration={myRegistration}
          marathon={marathon ?? undefined}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
