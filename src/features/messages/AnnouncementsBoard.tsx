import { useRef, useState } from 'react'
import { MegaphoneIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Announcement } from '@/types'

function formatShortDate(timestamp: Announcement['createdAt']) {
  if (!timestamp) return 'Now'
  return timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(timestamp?: Announcement['createdAt']) {
  if (!timestamp) return 'Just now'
  return timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Sits inside the hero as a translucent board rather than a bolted-on card list below it —
 * a swipeable strip of one-line announcements, each opening its full detail in a popup on click.
 */
export function AnnouncementsBoard({ announcements }: { announcements: Announcement[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected] = useState<Announcement | null>(null)

  function handleScroll() {
    const scroller = scrollerRef.current
    if (!scroller) return
    const slideWidth = scroller.clientWidth
    if (slideWidth === 0) return
    setActiveIndex(Math.round(scroller.scrollLeft / slideWidth))
  }

  if (announcements.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-2.5">
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
        <span className="text-[11px] font-semibold tracking-[0.16em] text-white/70 uppercase">Announcements</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {announcements.map((announcement) => (
          <button
            key={announcement.id}
            type="button"
            onClick={() => setSelected(announcement)}
            className="flex w-full shrink-0 snap-center items-center gap-3.5 px-4 py-3.5 text-left"
          >
            <span className="shrink-0 border-r border-dashed border-white/20 pr-3.5 font-mono text-[11px] whitespace-nowrap text-white/50">
              {formatShortDate(announcement.createdAt)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-semibold text-white">{announcement.title}</span>
              <span className="truncate text-[12.5px] text-white/60">{announcement.body}</span>
            </span>
          </button>
        ))}
      </div>

      {announcements.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {announcements.map((announcement, index) => (
            <span
              key={announcement.id}
              className={cn(
                'h-1 rounded-full bg-white/25 transition-all',
                index === activeIndex ? 'w-3.5 bg-white' : 'w-1',
              )}
            />
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          {selected?.bannerImageUrl && (
            <div
              className="relative h-40 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${selected.bannerImageUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          )}
          <div className="flex flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-xl leading-tight">{selected?.title}</DialogTitle>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <MegaphoneIcon className="size-3" />
                Announcement
              </Badge>
            </div>
            <DialogDescription className="sr-only">Announcement details</DialogDescription>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">{selected?.body}</p>
            <span className="text-muted-foreground text-xs">{formatFullDate(selected?.createdAt)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
