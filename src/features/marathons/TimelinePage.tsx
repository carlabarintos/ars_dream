import { useAuthStore } from '@/features/auth/auth-store'
import { useUserRegistrations } from '@/features/registrations/use-registrations'

import { MarathonCard } from './MarathonCard'
import { usePublishedMarathons } from './use-marathons'

export function TimelinePage() {
  const { marathons, isLoading } = usePublishedMarathons()
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const { registrations } = useUserRegistrations(uid)

  const registrationByMarathon = new Map(registrations.map((r) => [r.marathonId, r]))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Upcoming Marathons</h1>
        <p className="text-muted-foreground mt-1">Browse tours and join the queue to reserve your spot.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : marathons.length === 0 ? (
        <p className="text-muted-foreground">No marathons published yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {marathons.map((marathon) => (
            <MarathonCard
              key={marathon.id}
              marathon={marathon}
              myRegistration={registrationByMarathon.get(marathon.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
