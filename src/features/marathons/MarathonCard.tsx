import { MapPinIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Marathon, Registration } from '@/types'

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MarathonCard({
  marathon,
  myRegistration,
}: {
  marathon: Marathon
  myRegistration?: Registration
}) {
  const eventDate = marathon.eventDate.toDate()
  const spotsLeft = Math.max(marathon.capacity - marathon.confirmedCount, 0)
  const percentFull = marathon.capacity > 0 ? (marathon.confirmedCount / marathon.capacity) * 100 : 0
  const isFull = spotsLeft <= 0
  const closesAt = marathon.registrationClosesAt.toDate()
  const isClosed = new Date() > closesAt

  const statusPill = isFull || isClosed
    ? { label: 'Closed', variant: 'secondary' as const }
    : percentFull >= 75
      ? { label: 'Filling Up', variant: 'warning' as const }
      : { label: 'Open', variant: 'success' as const }

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <Link to={`/marathons/${marathon.id}/packages`} className="relative block h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${marathon.bannerImageUrl})` }}>
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

      {/* Die-cut seam — a small nod to the tour-ticket feel of a travel booking, not just a race signup. */}
      <div className="relative h-[18px] shrink-0">
        <div className="border-border absolute inset-x-[22px] top-1/2 border-t-2 border-dashed" />
        <span className="bg-background absolute top-1/2 -left-[9px] size-[18px] -translate-y-1/2 rounded-full" />
        <span className="bg-background absolute top-1/2 -right-[9px] size-[18px] -translate-y-1/2 rounded-full" />
      </div>

      <CardContent className="flex flex-col gap-3.5 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Marathon Date
            </div>
            <div className="text-sm font-semibold tabular-nums">{formatDate(eventDate)}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Registration Closes
            </div>
            <div className="text-sm font-semibold tabular-nums">{formatDate(closesAt)}</div>
          </div>
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
        {myRegistration ? (
          myRegistration.status === 'queued' ? (
            <div className="flex w-full items-center justify-between text-sm">
              <span className="text-muted-foreground">You're in the waiting list</span>
              <Badge variant="secondary">
                {myRegistration.queuePosition != null
                  ? `#${myRegistration.queuePosition} in line`
                  : 'Joining…'}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">You're registered for this event.</span>
          )
        ) : (
          <Button className="w-full" disabled={isFull || isClosed} asChild={!isFull && !isClosed}>
            {isFull || isClosed ? (
              'Registration Closed'
            ) : (
              <Link to={`/marathons/${marathon.id}/packages`}>View Packages</Link>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
