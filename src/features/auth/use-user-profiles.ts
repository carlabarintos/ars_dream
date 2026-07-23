import { useEffect, useState } from 'react'

import type { UserProfile } from '@/types'

import { subscribeToAllUsers, subscribeToUserProfile } from './api'

/** Subscribes to a set of user profiles by uid individually — mirrors useMarathonsByIds, since a broad `users` collection query would need every admin-only field in its own filter to satisfy the security rules. */
export function useUserProfilesByIds(userIds: string[]) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const idsKey = Array.from(new Set(userIds)).sort().join(',')

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) {
      setProfiles({})
      return
    }
    const unsubscribes = ids.map((id) =>
      subscribeToUserProfile(id, (profile) => {
        setProfiles((prev) => {
          if (!profile) {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          }
          return { ...prev, [id]: profile }
        })
      }),
    )
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return profiles
}

export function useAllUsers() {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAllUsers((data) => {
      setProfiles(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { profiles, isLoading }
}

/** Formats a user's full name as "First Middle Last", falling back to their Google display name, then email, for accounts without name fields (e.g. Google sign-in). */
export function formatUserName(profile: UserProfile | undefined) {
  if (!profile) return 'Unknown user'
  const nameParts = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean)
  if (nameParts.length > 0) return nameParts.join(' ')
  return profile.displayName ?? profile.email ?? 'Unknown user'
}
