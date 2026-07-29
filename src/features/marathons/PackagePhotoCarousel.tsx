import { useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function PackagePhotoCarousel({ photoUrls }: { photoUrls: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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

  function showRelative(delta: number) {
    setLightboxIndex((current) => {
      if (current === null) return current
      return (current + delta + photoUrls.length) % photoUrls.length
    })
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
          <button
            key={index}
            type="button"
            aria-label={`View photo ${index + 1} full size`}
            onClick={() => setLightboxIndex(index)}
            className="group relative h-64 w-full shrink-0 snap-center sm:h-72"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
              <ExpandIcon className="size-6 text-white drop-shadow" />
            </span>
          </button>
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

      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)] border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:opacity-90">

          <DialogTitle className="sr-only">Package photo</DialogTitle>
          {lightboxIndex !== null && (
            <div className="relative">
              <img
                src={photoUrls[lightboxIndex]}
                alt=""
                className="max-h-[80vh] w-full rounded-lg object-contain"
              />

              {photoUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => showRelative(-1)}
                    className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                  >
                    <ChevronLeftIcon className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => showRelative(1)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                  >
                    <ChevronRightIcon className="size-5" />
                  </button>
                  <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {photoUrls.map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          index === lightboxIndex ? 'bg-white w-4' : 'bg-white/50 w-1.5',
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
