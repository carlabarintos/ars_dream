import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  HistoryIcon,
  type LucideIcon,
  MapPinIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  TicketIcon,
  XCircleIcon,
  ZapIcon,
} from 'lucide-react'

import { BibCountdown } from '@/components/BibCountdown'
import { MarathonBanner } from '@/components/MarathonBanner'
import { RouteLines } from '@/components/RouteLines'
import { TicketSeam } from '@/components/TicketSeam'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/features/auth/auth-store'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { BookingChat } from '@/features/messages/BookingChatDialog'
import { cn } from '@/lib/utils'
import type { Registration, RegistrationStatus } from '@/types'

import { BookingTimeline } from './BookingTimeline'
import { CancelRegistrationButton } from './CancelRegistrationButton'
import { QuestionnaireLink } from './QuestionnaireLink'
import {
  canReopenWizard,
  canReRegister,
  getPendingActionStep,
  isBookingComplete,
  getRegistrationStatusMessage,
  getRegistrationTotalAmount,
  getWizardButtonLabel,
  isOnFinalInvoice,
  isOverdue,
  hasChosenPackage,
} from './registration-flow'
import { RegistrationWizard } from './RegistrationWizard'
import { StatusBadge } from './StatusBadge'
import { useUserRegistrations } from './use-registrations'

function formatDate(date: Date | undefined) {
  if (!date) return 'TBA'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_ICON: Record<RegistrationStatus, LucideIcon> = {
  queued: ClockIcon,
  accepted: AlertCircleIcon,
  terms_accepted: AlertCircleIcon,
  payment_submitted: ClockIcon,
  payment_rejected: AlertCircleIcon,
  deposit_paid: MessageCircleIcon,
  final_invoiced: AlertCircleIcon,
  confirmed: CheckCircle2Icon,
  rejected: XCircleIcon,
  cancelled: BanIcon,
}

const STATUS_ICON_BG: Record<RegistrationStatus, string> = {
  queued: 'bg-secondary text-secondary-foreground',
  accepted: 'bg-warning text-warning-foreground',
  terms_accepted: 'bg-warning text-warning-foreground',
  payment_submitted: 'bg-secondary text-secondary-foreground',
  payment_rejected: 'bg-destructive text-destructive-foreground',
  deposit_paid: 'bg-success text-success-foreground',
  final_invoiced: 'bg-warning text-warning-foreground',
  confirmed: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-secondary text-secondary-foreground',
}

// Statuses off the happy path where a "race day in..." countdown no longer makes sense.
const COUNTDOWN_HIDDEN_STATUSES: RegistrationStatus[] = ['rejected', 'cancelled', 'payment_rejected']

// Mirrors the registrations.status pipeline documented in CLAUDE.md — the
// happy-path progression a booking moves through from queue to confirmation.
const PIPELINE_STEPS = ['Queued', 'Offered', 'Invoiced', 'Deposit', 'Balance', 'Confirmed'] as const

const PIPELINE_INDEX: Partial<Record<RegistrationStatus, number>> = {
  queued: 0,
  accepted: 1,
  terms_accepted: 2,
  payment_submitted: 3,
  payment_rejected: 3,
  deposit_paid: 3,
  final_invoiced: 4,
  confirmed: 5,
}

/** Compact step tracker for the happy-path pipeline; renders nothing for terminal off-path statuses (rejected/cancelled) where a linear step count no longer applies. */
function PipelineTracker({ registration }: { registration: Registration }) {
  const { status } = registration
  const baseIndex = PIPELINE_INDEX[status]
  if (baseIndex === undefined) return null
  // payment_submitted/payment_rejected are reused for the balance once a final invoice exists.
  const currentIndex = baseIndex === 3 && isOnFinalInvoice(registration) ? 4 : baseIndex
  const isDerailed = status === 'payment_rejected'

  return (
    <div className="flex items-center" aria-hidden="true">
      {PIPELINE_STEPS.map((label, index) => {
        const isReached = index <= currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'size-2.5 rounded-full border-2',
                  isCurrent && isDerailed
                    ? 'border-destructive bg-destructive'
                    : isReached
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background',
                )}
              />
              <span
                className={cn(
                  'text-[9px] font-semibold tracking-wide uppercase',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {index < PIPELINE_STEPS.length - 1 && (
              <span
                className={cn('mx-1 mb-3.5 h-0.5 flex-1 rounded-full', index < currentIndex ? 'bg-primary' : 'bg-border')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const STAT_TONE = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
} as const

/** One tile in the bookings summary strip — a colored icon chip on top of a big number, staggered in on mount for a bit of life. */
function StatTile({
  icon: Icon,
  value,
  label,
  tone,
  pulse,
  delayMs,
}: {
  icon: LucideIcon
  value: number
  label: string
  tone: keyof typeof STAT_TONE
  pulse?: boolean
  delayMs: number
}) {
  return (
    <div
      className="group border-border bg-card animate-fade-up-in flex flex-col items-center gap-2 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-5"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6',
          STAT_TONE[tone],
          pulse && 'animate-bounce',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="font-display text-3xl tracking-wide tabular-nums">{value}</span>
      <span className="text-muted-foreground text-center text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
    </div>
  )
}

export function MyRegistrationsPage() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const profile = useAuthStore((state) => state.profile)
  const { registrations, isLoading } = useUserRegistrations(uid)
  const marathonIds = registrations.map((r) => r.marathonId)
  const marathons = useMarathonsByIds(marathonIds)
  const [activeRegistrationId, setActiveRegistrationId] = useState<string | null>(null)
  // Re-derived live from the subscription every render (not captured once into
  // state) so the wizard always acts on the current server-side status — a
  // frozen copy would let a status change while the dialog is open (e.g. an
  // admin decision) lead to a write the security rules now reject.
  const activeRegistration = activeRegistrationId
    ? (registrations.find((r) => r.id === activeRegistrationId) ?? null)
    : null

  const sorted = registrations
    .slice()
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

  const actionNeededCount = registrations.filter(
    (r) => getPendingActionStep(r, marathons[r.marathonId]) != null,
  ).length
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 pt-14 pb-24 sm:pt-20 sm:pb-28">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <svg
          className="pointer-events-none absolute top-1/2 right-[-8%] h-[min(52vw,420px)] w-[min(52vw,420px)] -translate-y-1/2 opacity-90 max-sm:top-auto max-sm:right-[-22%] max-sm:bottom-[-18%] max-sm:h-[70vw] max-sm:w-[70vw] max-sm:translate-y-0 max-sm:opacity-40"
          viewBox="0 0 300 300"
          aria-hidden="true"
        >
          <circle cx="150" cy="150" r="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="52" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="95" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="20" y1="150" x2="280" y2="150" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="95" x2="265" y2="95" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="205" x2="265" y2="205" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70">
            Ticket Wallet
          </span>
          <h1 className="font-display max-w-[14ch] text-5xl leading-[0.95] tracking-wide text-white sm:text-6xl">
            Your Bookings
          </h1>
          <p className="mt-5 max-w-[46ch] text-white/80">
            Every marathon package you've queued for, reviewed, and confirmed — all in one place.
          </p>
        </div>
      </section>

      {!isLoading && sorted.length > 0 && (
        <div className="relative z-10 mx-auto -mt-10 max-w-2xl px-4 sm:-mt-12">
          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={TicketIcon} value={sorted.length} label="Total" tone="primary" delayMs={0} />
            <StatTile
              icon={ZapIcon}
              value={actionNeededCount}
              label="Action Needed"
              tone="warning"
              pulse={actionNeededCount > 0}
              delayMs={80}
            />
            <StatTile icon={PartyPopperIcon} value={confirmedCount} label="Confirmed" tone="success" delayMs={160} />
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pt-8 pb-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              <TicketIcon className="size-6" />
            </span>
            <div>
              <p className="font-display text-xl tracking-wide">No bookings yet</p>
              <p className="text-muted-foreground mt-1 text-sm">You haven't registered for any marathons yet.</p>
            </div>
            <Button asChild className="mt-2">
              <Link to="/">Browse Marathons</Link>
            </Button>
          </div>
        ) : (
          sorted.map((registration) => {
            const marathon = marathons[registration.marathonId]
            const pendingStep = getPendingActionStep(registration, marathon)
            const StatusIcon = STATUS_ICON[registration.status]

            return (
              <Card
                key={registration.id}
                className="group gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <MarathonBanner
                  url={marathon?.bannerImageUrl}
                  vertical={marathon?.bannerVertical && !!marathon.bannerImageUrl}
                  sideUrl={marathon?.bannerSideImageUrl}
                  className="aspect-[5/2] w-full"
                  imageClassName="transition-transform duration-300 group-hover:scale-105"
                >
                  {!marathon?.bannerImageUrl && (
                    <div className="from-primary to-brand-navy absolute inset-0 bg-gradient-to-br" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-brand-navy/25 to-transparent" />
                  <StatusBadge
                    status={registration.status}
                    overdue={isOverdue(registration)}
                    incomplete={!isBookingComplete(registration, marathon)}
                    className="absolute top-3 right-3"
                  />
                  {marathon &&
                    marathon.eventDate &&
                    marathon.eventDate.toDate().getTime() > Date.now() &&
                    !COUNTDOWN_HIDDEN_STATUSES.includes(registration.status) && (
                      <BibCountdown target={marathon.eventDate.toDate()} className="absolute top-3 left-3" />
                    )}
                  <div className="absolute right-4 bottom-4 left-4 flex flex-col gap-1">
                    <h2 className="font-display text-2xl leading-none tracking-wide text-white drop-shadow">
                      {marathon?.title ?? 'Marathon'}
                    </h2>
                    {marathon && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="size-3.5" />
                          {marathon.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="size-3.5" />
                          {formatDate(marathon.eventDate?.toDate())}
                        </span>
                      </div>
                    )}
                  </div>
                </MarathonBanner>

                <TicketSeam />

                <CardContent className="flex flex-col gap-4 pt-4 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Package
                      </div>
                      <div className="text-sm font-semibold">
                        {hasChosenPackage(registration) ? registration.packageName : 'Chosen when you accept your offer'}
                      </div>
                      {registration.selectedAddOns && registration.selectedAddOns.length > 0 && (
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          + {registration.selectedAddOns.map((addOn) => addOn.name).join(', ')}
                        </div>
                      )}
                    </div>
                    {hasChosenPackage(registration) && (
                      <div className="text-right">
                        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                          Total
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                          {registration.packagePriceCurrency}{' '}
                          {getRegistrationTotalAmount(registration).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <PipelineTracker registration={registration} />

                  <div className="bg-muted/50 flex items-start gap-2.5 rounded-lg p-3 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                        STATUS_ICON_BG[registration.status],
                      )}
                    >
                      <StatusIcon className="size-3.5" />
                    </span>
                    <span>{getRegistrationStatusMessage(registration, marathon)}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
                    {uid && (
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                          <MessageCircleIcon className="size-3.5" />
                          Messages
                        </div>
                        <BookingChat
                          registration={registration}
                          marathonTitle={marathon?.title ?? 'Your booking'}
                          viewerId={uid}
                          viewerRole="user"
                          otherPartyLabel="Support team"
                          className="h-96"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-3 md:max-h-[26rem] md:overflow-y-auto">
                      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                        <HistoryIcon className="size-3.5" />
                        Timeline
                      </div>
                      {profile && <BookingTimeline registration={registration} marathon={marathon} profile={profile} />}
                      <QuestionnaireLink registration={registration} marathon={marathon} />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-border flex flex-col gap-2 border-t pt-4 pb-5">
                  {canReopenWizard(registration, marathon) && (
                    <Button className="w-full" onClick={() => setActiveRegistrationId(registration.id)}>
                      {getWizardButtonLabel(pendingStep)}
                    </Button>
                  )}
                  {canReRegister(registration) && (
                    <Button className="w-full" asChild>
                      <Link to={`/marathons/${registration.marathonId}/packages`}>Join Waitlist Again</Link>
                    </Button>
                  )}
                  <CancelRegistrationButton registration={registration} />
                </CardFooter>
              </Card>
            )
          })
        )}
      </div>

      {activeRegistration && (
        <RegistrationWizard
          registration={activeRegistration}
          marathon={marathons[activeRegistration.marathonId]}
          onClose={() => setActiveRegistrationId(null)}
        />
      )}
    </>
  )
}
