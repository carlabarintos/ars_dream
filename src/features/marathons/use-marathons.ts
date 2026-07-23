import { useEffect, useState } from 'react'

import type { Marathon } from '@/types'

import { subscribeToAllMarathons, subscribeToMarathon, subscribeToPublishedMarathons } from './api'

export function usePublishedMarathons() {
  const [marathons, setMarathons] = useState<Marathon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToPublishedMarathons((data) => {
      setMarathons(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { marathons, isLoading }
}

export function useAllMarathons() {
  const [marathons, setMarathons] = useState<Marathon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAllMarathons((data) => {
      setMarathons(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { marathons, isLoading }
}

/** Subscribes to a set of marathons by id individually, so a non-admin can read events that are no longer 'published' (e.g. closed) as long as they hold a direct reference to each one — unlike a broad collection query, which Firestore rejects unless every possible result is provably readable. */
export function useMarathonsByIds(marathonIds: string[]) {
  const [marathons, setMarathons] = useState<Record<string, Marathon>>({})
  const idsKey = Array.from(new Set(marathonIds)).sort().join(',')

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) {
      setMarathons({})
      return
    }
    const unsubscribes = ids.map((id) =>
      subscribeToMarathon(id, (marathon) => {
        setMarathons((prev) => {
          if (!marathon) {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          }
          return { ...prev, [id]: marathon }
        })
      }),
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return marathons
}

export function useMarathon(marathonId: string | undefined) {
  const [marathon, setMarathon] = useState<Marathon | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!marathonId) {
      setMarathon(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const unsubscribe = subscribeToMarathon(marathonId, (data) => {
      setMarathon(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [marathonId])

  return { marathon, isLoading }
}
