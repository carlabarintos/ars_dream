import { useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export function PackagePhotoCarousel({ photoUrls }: { photoUrls: string[] }) {
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

  if (photoUrls.length === 0) return null

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photoUrls.map((url, index) => (
          <img
            key={index}
            src={url}
            alt=""
            className="h-40 w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {photoUrls.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {photoUrls.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to photo ${index + 1}`}
                onClick={() => scrollToIndex(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === activeIndex ? 'bg-white w-4' : 'bg-white/50 w-1.5',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
