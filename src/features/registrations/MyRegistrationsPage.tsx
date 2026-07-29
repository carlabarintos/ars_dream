import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  type LucideIcon,
  MapPinIcon,
  XCircleIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuthStore } from '@/features/auth/auth-store'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import type { Registration } from '@/types'

import { CancelRegistrationButton } from './CancelRegistrationButton'
import {
  canReopenWizard,
  canReRegister,
  getPendingActionStep,
  getRegistrationStatusMessage,
  getWizardButtonLabel,
} from './registration-flow'
import { RegistrationWizard } from './RegistrationWizard'
import { StatusBadge } from './StatusBadge'
import { useUserRegistrations } from './use-registrations'

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_ICON: Record<Registration['status'], LucideIcon> = {
  queued: ClockIcon,
  accepted: AlertCircleIcon,
  terms_accepted: AlertCircleIcon,
  payment_submitted: ClockIcon,
  payment_rejected: AlertCircleIcon,
  confirmed: CheckCircle2Icon,
  rejected: XCircleIcon,
  cancelled: BanIcon,
}

export function MyRegistrationsPage() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations, isLoading } = useUserRegistrations(uid)
  const marathonIds = registrations.map((r) => r.marathonId)
  const marathons = useMarathonsByIds(marathonIds)
  const [activeRegistration, setActiveRegistration] = useState<Registration | null>(null)

  const sorted = registrations
    .slice()
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">My Registrations</h1>
        <p className="text-muted-foreground mt-1">Track your bookings and complete any pending steps.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">You haven't registered for any marathons yet.</p>
          <Button asChild>
            <Link to="/">Browse Marathons</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((registration) => {
            const marathon = marathons[registration.marathonId]
            const pendingStep = getPendingActionStep(registration, marathon)
            const StatusIcon = STATUS_ICON[registration.status]

            return (
              <Card key={registration.id} className="gap-0 overflow-hidden py-0">
                {marathon?.bannerImageUrl && (
                  <div
                    className="h-28 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${marathon.bannerImageUrl})` }}
                  />
                )}
                <CardHeader>
                  <div>
                    <h2 className="font-display text-2xl leading-tight tracking-wide">
                      {marathon?.title ?? 'Marathon'}
                    </h2>
                    {marathon && (
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="size-3.5" />
                          {marathon.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="size-3.5" />
                          {formatDate(marathon.eventDate.toDate())}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 pb-5">
                  <div className="text-muted-foreground text-sm">
                    {registration.packageName} · {registration.packagePriceCurrency}{' '}
                    {registration.packagePriceAmount.toLocaleString()}
                  </div>
                  <div className="bg-muted/50 flex items-start gap-2 rounded-md p-3 text-sm">
                    <StatusIcon className="mt-0.5 size-4 shrink-0" />
                    <span>{getRegistrationStatusMessage(registration)}</span>
                  </div>
                </CardContent>

                <CardFooter className="border-border flex flex-col items-center gap-3 border-t pt-4 pb-5">
                  <StatusBadge status={registration.status} />
                  {canReopenWizard(registration) && (
                    <Button className="w-full" onClick={() => setActiveRegistration(registration)}>
                      {getWizardButtonLabel(pendingStep)}
                    </Button>
                  )}
                  {canReRegister(registration) && (
                    <Button className="w-full" asChild>
                      <Link to={`/marathons/${registration.marathonId}/packages`}>Register Again</Link>
                    </Button>
                  )}
                  <CancelRegistrationButton registration={registration} />
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {activeRegistration && (
        <RegistrationWizard
          registration={activeRegistration}
          marathon={marathons[activeRegistration.marathonId]}
          onClose={() => setActiveRegistration(null)}
        />
      )}
    </div>
  )
}
