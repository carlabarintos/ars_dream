import { useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { Announcement } from '@/types'

import { AnnouncementCard } from './AnnouncementCard'

export function AnnouncementCarousel({ announcements }: { announcements: Announcement[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  function handleScroll() {
    const scroller = scrollerRef.current
    if (!scroller) return
    const slideWidth = scroller.clientWidth
    if (slideWidth === 0) return
    setActiveIndex(Math.round(scroller.scrollLeft / slideWidth))
  }

  function scrollToIndex(index: number) {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ left: index * scroller.clientWidth, behavior: 'smooth' })
  }

  if (announcements.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {announcements.map((announcement) => (
          <div key={announcement.id} className="w-full shrink-0 snap-center">
            <AnnouncementCard announcement={announcement} />
          </div>
        ))}
      </div>

      {announcements.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {announcements.map((announcement, index) => (
            <button
              key={announcement.id}
              type="button"
              aria-label={`Go to announcement ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === activeIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30 w-1.5',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
