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
import { useAuthStore } from '@/features/auth/auth-store'
import { joinQueue } from '@/features/registrations/api'
import {
  canReopenWizard,
  getPendingActionStep,
  getRegistrationStatusMessage,
  getWizardButtonLabel,
} from '@/features/registrations/registration-flow'
import { RegistrationWizard } from '@/features/registrations/RegistrationWizard'
import { StatusBadge } from '@/features/registrations/StatusBadge'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import type { MarathonPackage } from '@/types'

import { useMarathon } from './use-marathons'

function formatPrice(pkg: MarathonPackage) {
  return `${pkg.priceCurrency} ${pkg.priceAmount.toLocaleString()}`
}

export function PackageSelectionPage() {
  const { marathonId } = useParams<{ marathonId: string }>()
  const navigate = useNavigate()
  const { marathon, isLoading } = useMarathon(marathonId)
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)
  const [joiningPackageId, setJoiningPackageId] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const myRegistration = registrations.find((r) => r.marathonId === marathonId)
  const pendingStep = myRegistration ? getPendingActionStep(myRegistration, marathon ?? undefined) : null

  const spotsLeft = marathon ? Math.max(marathon.capacity - marathon.confirmedCount, 0) : 0
  const isFull = spotsLeft <= 0
  const isClosed = marathon ? new Date() > marathon.registrationClosesAt.toDate() : false

  async function handleSelectPackage(pkg: MarathonPackage) {
    if (!uid || !marathon) return
    setJoiningPackageId(pkg.id)
    try {
      await joinQueue(uid, marathon.id, pkg)
      toast.success("You're in the queue! We'll notify you once an admin reviews your request.")
      navigate('/')
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

      {myRegistration ? (
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
            <p className="text-muted-foreground">{getRegistrationStatusMessage(myRegistration)}</p>
          </CardContent>
          {myRegistration && canReopenWizard(myRegistration) && (
            <CardFooter className="border-border border-t pt-4">
              <Button className="w-full" onClick={() => setShowWizard(true)}>
                {getWizardButtonLabel(pendingStep)}
              </Button>
            </CardFooter>
          )}
        </Card>
      ) : (marathon.packages ?? []).length === 0 ? (
        <p className="text-muted-foreground">No packages are available for this event yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {marathon.packages!.map((pkg) => (
            <Card key={pkg.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{pkg.name}</CardTitle>
                <p className="text-lg font-medium">{formatPrice(pkg)}</p>
              </CardHeader>
              <CardContent className="flex-1">
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
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={isFull || isClosed || joiningPackageId !== null}
                  loading={joiningPackageId === pkg.id}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  {isFull || isClosed
                    ? 'Registration Closed'
                    : joiningPackageId === pkg.id
                      ? 'Joining…'
                      : 'Select & Join Queue'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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
