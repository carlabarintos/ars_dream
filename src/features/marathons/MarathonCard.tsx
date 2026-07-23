import { CalendarIcon, MapPinIcon } from 'lucide-react'
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
      <Link to={`/marathons/${marathon.id}/packages`} className="relative block h-40 w-full bg-cover bg-center" style={{ backgroundImage: `url(${marathon.bannerImageUrl})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <Badge variant={statusPill.variant} className="absolute top-3 right-3">
          {statusPill.label}
        </Badge>
        <div className="absolute bottom-3 left-4 font-display text-4xl tracking-wide text-white drop-shadow">
          {formatDate(eventDate)}
        </div>
      </Link>

      <CardContent className="flex flex-col gap-3 pt-5">
        <div>
          <Link to={`/marathons/${marathon.id}/packages`}>
            <h3 className="font-display text-xl tracking-wide leading-tight hover:underline">
              {marathon.title}
            </h3>
          </Link>
          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-3.5" />
            {marathon.location}
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

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <CalendarIcon className="size-3.5" />
          Registration closes {formatDate(closesAt)}
        </div>
      </CardContent>

      <CardFooter className="mt-4 pt-4 border-t border-border">
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
