import { useState } from 'react'
import { CalendarIcon, CheckIcon, MapPinIcon, UsersIcon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import { Progress } from '@/components/ui/progress'
import { TicketSeam } from '@/components/TicketSeam'
import { useAuthStore } from '@/features/auth/auth-store'
import { getPackageDescription, toBulletLines } from '@/features/marathons/api'
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
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { cn } from '@/lib/utils'
import type { MarathonPackage, MarathonPackageAddOn } from '@/types'

import { AVAILABILITY_PILL, getMarathonAvailability } from './marathon-status'
import { PackagePhotoCarousel } from './PackagePhotoCarousel'
import { useMarathon } from './use-marathons'

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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
  // Mandatory add-ons are always selected regardless.
  function getSelectedIdsForPackage(pkg: MarathonPackage): Set<string> {
    const mandatoryIds = (pkg.addOns ?? []).filter((a) => a.mandatory).map((a) => a.id)
    if (selectedAddOnIds[pkg.id]) return new Set([...selectedAddOnIds[pkg.id], ...mandatoryIds])
    if (myRegistration && myRegistration.packageId === pkg.id) {
      return new Set([...(myRegistration.selectedAddOns ?? []).map((a) => a.addOnId), ...mandatoryIds])
    }
    return new Set(mandatoryIds)
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
      toast.error(getFriendlyErrorMessage(error, 'queue'))
    } finally {
      setJoiningPackageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">Warming up…</p>
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

  const eventDate = marathon.eventDate.toDate()
  const percentFull = marathon.capacity > 0 ? (marathon.confirmedCount / marathon.capacity) * 100 : 0
  const statusPill = AVAILABILITY_PILL[getMarathonAvailability(marathon)]
  const sharedInclusions = toBulletLines(marathon.sharedInclusions)
  const packageNotes = toBulletLines(marathon.packageNotes)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
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

      <div className="border-border overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="relative h-56 w-full bg-cover bg-center sm:h-64"
          style={{ backgroundImage: `url(${marathon.bannerImageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <Badge variant={statusPill.variant} className="absolute top-4 right-4">
            {statusPill.label}
          </Badge>
          <div className="absolute right-5 bottom-5 left-5 flex flex-col gap-1.5">
            <h1 className="font-display text-4xl leading-none tracking-wide text-white drop-shadow sm:text-5xl">
              {marathon.title}
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-white/85">
              <MapPinIcon className="size-4" />
              {marathon.location}
            </div>
          </div>
        </div>

        <div className="bg-card divide-border border-border grid grid-cols-2 divide-x border-t sm:grid-cols-3">
          <div className="flex flex-col gap-1 p-4">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <CalendarIcon className="size-3.5" />
              Marathon Date
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatDate(eventDate)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <CalendarIcon className="size-3.5" />
              Registration Closes
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatDate(marathon.registrationClosesAt.toDate())}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 p-4 sm:col-span-1">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <UsersIcon className="size-3.5" />
              Spots Left
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {spotsLeft} of {marathon.capacity}
            </span>
            <Progress value={percentFull} className="h-1.5" />
          </div>
        </div>
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
          <div className="flex flex-col gap-5">
            <div>
              <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">Packages</span>
              <h2 className="font-display mt-1 text-3xl tracking-wide">Choose Your Package</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {canSwapPackage || canReRegisterNow
                  ? "Pick a package below — we'll notify you once an admin reviews your request."
                  : "Select a package to join the queue. We'll notify you once it's your turn."}
              </p>
            </div>
            {sharedInclusions.length > 0 && (
              <div className="bg-secondary/40 border-border rounded-xl border p-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Included in every package
                </p>
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {sharedInclusions.map((line, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div
              className={cn(
                'grid grid-cols-1 gap-5',
                marathon.packages!.length === 2 && 'sm:grid-cols-2',
                marathon.packages!.length >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
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

                const hasPhotos = (pkg.photoUrls?.length ?? 0) > 0

                return (
                <Card
                  key={pkg.id}
                  className={cn(
                    'group flex flex-col gap-0 overflow-hidden py-0 transition-all duration-200',
                    !disabled && 'hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg',
                    isCurrentPackage && 'border-primary ring-primary/25 ring-2',
                  )}
                >
                  {hasPhotos ? (
                    <>
                      <PackagePhotoCarousel photoUrls={pkg.photoUrls!} />
                      <TicketSeam />
                    </>
                  ) : (
                    <div className="from-primary to-brand-navy h-2.5 w-full shrink-0 bg-gradient-to-r" />
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>{pkg.name}</CardTitle>
                      {isCurrentPackage && <Badge variant="secondary">Current</Badge>}
                    </div>
                    <p className="font-display pt-1 text-3xl tracking-wide">
                      {formatTotal(pkg, selectedAddOns)}
                    </p>
                    {selectedAddOns.length > 0 && (
                      <p className="text-muted-foreground text-xs">Base package {formatPrice(pkg)}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4 pt-4">
                    {getPackageDescription(pkg) && (
                      <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm">
                        {getPackageDescription(pkg)
                          .split('\n')
                          .filter((line) => line.trim())
                          .map((line, index) => (
                            <li key={index}>{line.trim()}</li>
                          ))}
                      </ul>
                    )}
                    {pkg.addOns && pkg.addOns.length > 0 && (
                      <div className="bg-secondary/40 border-border mt-auto flex flex-col gap-2 rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                          Add-ons
                        </p>
                        {pkg.addOns.map((addOn) => {
                          const checkboxId = `addon-${pkg.id}-${addOn.id}`
                          return (
                            <div key={addOn.id} className="flex items-center gap-2">
                              <Checkbox
                                id={checkboxId}
                                checked={selectedIds.has(addOn.id)}
                                disabled={disabled || addOn.mandatory}
                                onCheckedChange={() => toggleAddOn(pkg, addOn.id)}
                              />
                              <Label htmlFor={checkboxId} className="flex-1 text-sm font-normal">
                                {addOn.name}
                                {addOn.mandatory && <span className="text-muted-foreground text-xs">(required)</span>}
                              </Label>
                              <span className="text-muted-foreground text-xs font-medium">
                                +{pkg.priceCurrency} {addOn.priceAmount.toLocaleString()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-border mt-4 border-t pt-4">
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
            {packageNotes.length > 0 && (
              <div className="bg-secondary/40 border-border rounded-xl border p-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Notes</p>
                <ul className="text-muted-foreground mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm">
                  {packageNotes.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
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
