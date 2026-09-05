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
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Upcoming Marathons</h1>
        <p className="text-muted-foreground mt-1">Browse tours and join the queue to reserve your spot.</p>
      </div>

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
  )
}
