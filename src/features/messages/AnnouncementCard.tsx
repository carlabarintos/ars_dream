import { MegaphoneIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Announcement } from '@/types'

function formatAnnouncementDate(timestamp: Announcement['createdAt']) {
  if (!timestamp) return 'Just now'
  return timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <Card className="overflow-hidden py-0 gap-0">
      {announcement.bannerImageUrl && (
        <div
          className="relative h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${announcement.bannerImageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <Badge variant="secondary" className="absolute top-3 right-3 gap-1">
            <MegaphoneIcon className="size-3" />
            Announcement
          </Badge>
        </div>
      )}

      <CardContent className="flex flex-col gap-2 py-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl tracking-wide leading-tight">{announcement.title}</h3>
          {!announcement.bannerImageUrl && (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <MegaphoneIcon className="size-3" />
              Announcement
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{announcement.body}</p>
        <span className="text-muted-foreground text-xs">{formatAnnouncementDate(announcement.createdAt)}</span>
      </CardContent>
    </Card>
  )
}
