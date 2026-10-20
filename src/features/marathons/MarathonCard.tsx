import { MapPinIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TicketSeam } from '@/components/TicketSeam'
import { canReRegister } from '@/features/registrations/registration-flow'
import type { Marathon, Registration } from '@/types'

import { AVAILABILITY_PILL, getMarathonAvailability } from './marathon-status'

function formatDate(date: Date | undefined) {
  if (!date) return 'TBA'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MarathonCard({
  marathon,
  myRegistration,
}: {
  marathon: Marathon
  myRegistration?: Registration
}) {
  const eventDate = marathon.eventDate?.toDate()
  const spotsLeft = Math.max(marathon.capacity - marathon.confirmedCount, 0)
  const percentFull = marathon.capacity > 0 ? (marathon.confirmedCount / marathon.capacity) * 100 : 0
  const closesAt = marathon.registrationClosesAt?.toDate()
  const isFull = spotsLeft <= 0
  const isClosed = !!closesAt && new Date() > closesAt
  const statusPill = AVAILABILITY_PILL[getMarathonAvailability(marathon)]

  return (
    <Card className="group overflow-hidden py-0 gap-0 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      <Link to={`/marathons/${marathon.id}/packages`} className="relative block h-44 w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: `url(${marathon.bannerImageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-brand-navy/25 to-transparent" />
        <Badge variant={statusPill.variant} className="absolute top-3 right-3">
          {statusPill.label}
        </Badge>
        <div className="absolute right-4 bottom-4 left-4 flex flex-col gap-1">
          <h3 className="font-display text-2xl leading-none tracking-wide text-white drop-shadow hover:underline">
            {marathon.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <MapPinIcon className="size-3.5" />
            {marathon.location}
          </div>
        </div>
      </Link>

      <TicketSeam />

      <CardContent className="flex flex-col gap-3.5 pt-0.5">
        <div>
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Marathon Date
          </div>
          <div className="text-sm font-semibold tabular-nums">{formatDate(eventDate)}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{spotsLeft} spots left</span>
            <span>
              {marathon.confirmedCount}/{marathon.capacity}
            </span>
          </div>
          <Progress value={percentFull} />
        </div>
      </CardContent>

      <CardFooter className="mt-1 pt-4 border-t border-border">
        {myRegistration && !canReRegister(myRegistration) ? (
          myRegistration.status === 'queued' ? (
            <span className="text-muted-foreground text-sm">You're in the waiting list.</span>
          ) : (
            <span className="text-muted-foreground text-sm">You're registered for this event.</span>
          )
        ) : (
          <Button className="w-full" disabled={isFull || isClosed} asChild={!isFull && !isClosed}>
            {isFull || isClosed ? (
              'Registration Closed'
            ) : (
              <Link to={`/marathons/${marathon.id}/packages`}>View & Join Waitlist</Link>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
