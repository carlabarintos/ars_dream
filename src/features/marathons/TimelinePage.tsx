import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/features/auth/auth-store'
import { AnnouncementsBoard } from '@/features/messages/AnnouncementsBoard'
import { isAnnouncementVisibleTo } from '@/features/messages/api'
import { useAnnouncements } from '@/features/messages/use-messages'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import { cn } from '@/lib/utils'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Marathon } from '@/types'

import { MarathonCard } from './MarathonCard'
import { getMarathonAvailability, type MarathonAvailability } from './marathon-status'
import { useMarathonsByIds, usePublishedMarathons } from './use-marathons'

function matchesQuery(marathon: Marathon, query: string) {
  return marathon.title.toLowerCase().includes(query) || marathon.location.toLowerCase().includes(query)
}

/** Whether a feed item's optional `feedDeadline` hasn't passed yet — gates Home/Timeline visibility only, not any other view. */
function isBeforeFeedDeadline(item: { feedDeadline?: { toDate: () => Date } }) {
  return !item.feedDeadline || item.feedDeadline.toDate().getTime() >= Date.now()
}

const AVAILABILITY_FILTERS: { label: string; value: MarathonAvailability | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Filling Up', value: 'filling' },
]

export function TimelinePage() {
  const { marathons, isLoading: isLoadingMarathons } = usePublishedMarathons()
  const { announcements, isLoading: isLoadingAnnouncements } = useAnnouncements()
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)
  const marathonById = useMarathonsByIds(registrations.map((r) => r.marathonId))
  const [availabilityFilter, setAvailabilityFilter] = useState<MarathonAvailability | 'all'>('all')

  const isLoading = isLoadingMarathons || isLoadingAnnouncements
  const registrationByMarathon = new Map(registrations.map((r) => [r.marathonId, r]))

  const visibleMarathons = marathons
    .filter(isBeforeFeedDeadline)
    .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
  const visibleAnnouncements = announcements
    .filter((a) => isAnnouncementVisibleTo(a, uid, registrations, marathonById))
    .filter(isBeforeFeedDeadline)
    .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())

  const openCount = visibleMarathons.filter((m) => getMarathonAvailability(m) === 'open').length
  const fillingCount = visibleMarathons.filter((m) => getMarathonAvailability(m) === 'filling').length
  const availableMarathons = visibleMarathons.filter(
    (m) => availabilityFilter === 'all' || getMarathonAvailability(m) === availabilityFilter,
  )

  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(availableMarathons, matchesQuery)

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 pt-14 pb-24 sm:pt-20 sm:pb-28">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 1200 500"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M -100 520 Q 400 300 1300 420" stroke="#fff" strokeWidth="1.5" fill="none" />
          <path d="M -100 460 Q 420 260 1300 360" stroke="#fff" strokeWidth="1.5" fill="none" />
          <path d="M -100 400 Q 440 220 1300 300" stroke="#fff" strokeWidth="1.5" fill="none" />
        </svg>
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

        <div className="relative mx-auto flex max-w-5xl flex-col gap-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70">
              World Tour
            </span>
            <h1 className="font-display max-w-[11ch] text-5xl leading-[0.95] tracking-wide text-white sm:text-6xl">
              Run the world.
              <br />
              One queue at a time.
            </h1>
            <p className="mt-5 max-w-[46ch] text-white/80">
              Reserve your spot on ARS Dream's next international marathon tour — limited slots per
              package, reviewed and confirmed by our team.
            </p>
          </div>

          {!isLoadingAnnouncements && <AnnouncementsBoard announcements={visibleAnnouncements} />}
        </div>
      </section>

      {!isLoading && visibleMarathons.length > 0 && (
        <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:-mt-12">
          <div className="border-border bg-card flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-lg sm:p-5">
            <Input
              placeholder="Search by name or destination…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[220px] flex-1 bg-transparent"
            />
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={availabilityFilter === filter.value}
                  onClick={() => setAvailabilityFilter(filter.value)}
                  className={cn(
                    'rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    availabilityFilter === filter.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 pb-8">
        {!isLoading && visibleMarathons.length > 0 && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">Marathons</span>
              <h2 className="font-display mt-1 text-3xl tracking-wide">Upcoming Marathons</h2>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {openCount} OPEN · {fillingCount} FILLING
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : visibleMarathons.length === 0 ? (
          <p className="text-muted-foreground">No marathons published yet. Check back soon.</p>
        ) : availableMarathons.length === 0 ? (
          <p className="text-muted-foreground">No marathons match this filter.</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No marathons match your search.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((marathon) => (
                <MarathonCard
                  key={marathon.id}
                  marathon={marathon}
                  myRegistration={registrationByMarathon.get(marathon.id)}
                />
              ))}
            </div>
            {hasMore && (
              <Button variant="outline" onClick={loadMore} className="self-center">
                Load more ({filtered.length - visible.length} remaining)
              </Button>
            )}
          </>
        )}
      </div>
    </>
  )
}
