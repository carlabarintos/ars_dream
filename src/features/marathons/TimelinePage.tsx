import { useAuthStore } from '@/features/auth/auth-store'
import { AnnouncementCard } from '@/features/messages/AnnouncementCard'
import { isAnnouncementVisibleTo } from '@/features/messages/api'
import { useAnnouncements } from '@/features/messages/use-messages'
import { useUserRegistrations } from '@/features/registrations/use-registrations'
import type { Announcement, Marathon } from '@/types'

import { MarathonCard } from './MarathonCard'
import { usePublishedMarathons } from './use-marathons'

type FeedItem =
  | { kind: 'marathon'; date: Date; marathon: Marathon }
  | { kind: 'announcement'; date: Date; announcement: Announcement }

/** Whether a feed item's optional `feedDeadline` hasn't passed yet — gates Home/Timeline visibility only, not any other view. */
function isBeforeFeedDeadline(item: { feedDeadline?: { toDate: () => Date } }) {
  return !item.feedDeadline || item.feedDeadline.toDate().getTime() >= Date.now()
}

export function TimelinePage() {
  const { marathons, isLoading: isLoadingMarathons } = usePublishedMarathons()
  const { announcements, isLoading: isLoadingAnnouncements } = useAnnouncements()
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)

  const isLoading = isLoadingMarathons || isLoadingAnnouncements
  const registrationByMarathon = new Map(registrations.map((r) => [r.marathonId, r]))

  const visibleMarathons = marathons.filter(isBeforeFeedDeadline)
  const visibleAnnouncements = announcements
    .filter((a) => isAnnouncementVisibleTo(a, uid, registrations))
    .filter(isBeforeFeedDeadline)

  const feed: FeedItem[] = [
    ...visibleMarathons.map((marathon): FeedItem => ({ kind: 'marathon', date: marathon.createdAt.toDate(), marathon })),
    ...visibleAnnouncements.map((announcement): FeedItem => ({
      kind: 'announcement',
      date: announcement.createdAt.toDate(),
      announcement,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Upcoming Marathons</h1>
        <p className="text-muted-foreground mt-1">Browse tours and join the queue to reserve your spot.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : feed.length === 0 ? (
        <p className="text-muted-foreground">No marathons published yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map((item) =>
            item.kind === 'marathon' ? (
              <MarathonCard
                key={`marathon-${item.marathon.id}`}
                marathon={item.marathon}
                myRegistration={registrationByMarathon.get(item.marathon.id)}
              />
            ) : (
              <div key={`announcement-${item.announcement.id}`} className="sm:col-span-2 lg:col-span-3">
                <AnnouncementCard announcement={item.announcement} />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
