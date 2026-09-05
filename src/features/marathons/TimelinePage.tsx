import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/auth-store'
import { AnnouncementCarousel } from '@/features/messages/AnnouncementCarousel'
import { isAnnouncementVisibleTo } from '@/features/messages/api'
import { useAnnouncements } from '@/features/messages/use-messages'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import { usePaginatedSearch } from '@/lib/use-paginated-search'
import type { Marathon } from '@/types'

import { MarathonCard } from './MarathonCard'
import { useMarathonsByIds, usePublishedMarathons } from './use-marathons'

function matchesQuery(marathon: Marathon, query: string) {
  return marathon.title.toLowerCase().includes(query) || marathon.location.toLowerCase().includes(query)
}

/** Whether a feed item's optional `feedDeadline` hasn't passed yet — gates Home/Timeline visibility only, not any other view. */
function isBeforeFeedDeadline(item: { feedDeadline?: { toDate: () => Date } }) {
  return !item.feedDeadline || item.feedDeadline.toDate().getTime() >= Date.now()
}

export function TimelinePage() {
  const { marathons, isLoading: isLoadingMarathons } = usePublishedMarathons()
  const { announcements, isLoading: isLoadingAnnouncements } = useAnnouncements()
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)
  const marathonById = useMarathonsByIds(registrations.map((r) => r.marathonId))

  const isLoading = isLoadingMarathons || isLoadingAnnouncements
  const registrationByMarathon = new Map(registrations.map((r) => [r.marathonId, r]))

  const visibleMarathons = marathons
    .filter(isBeforeFeedDeadline)
    .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
  const visibleAnnouncements = announcements
    .filter((a) => isAnnouncementVisibleTo(a, uid, registrations, marathonById))
    .filter(isBeforeFeedDeadline)
    .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())

  const { query, setQuery, filtered, visible, hasMore, loadMore } = usePaginatedSearch(visibleMarathons, matchesQuery)

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 py-14 sm:py-20">
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
        <div className="relative mx-auto max-w-5xl">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70">
            2026 World Tour
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
      </section>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {!isLoadingAnnouncements && <AnnouncementCarousel announcements={visibleAnnouncements} />}

        {!isLoading && visibleMarathons.length > 0 && (
          <Input
            placeholder="Search by name or destination…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : visibleMarathons.length === 0 ? (
          <p className="text-muted-foreground">No marathons published yet. Check back soon.</p>
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
