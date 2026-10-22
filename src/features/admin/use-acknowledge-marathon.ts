import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect } from 'react'

import { useAuthStore } from '@/features/auth/auth-store'
import { db } from '@/firebase/config'
import type { Marathon, UserProfile } from '@/types'

export function hasUnseenActivity(marathon: Marathon, profile: UserProfile | null) {
  const seenAt = profile?.marathonsSeenAt?.[marathon.id]
  return !!marathon.lastActivityAt && (!seenAt || seenAt.toMillis() < marathon.lastActivityAt.toMillis())
}

/** Marks the marathon's activity as seen by the current admin — re-runs if new activity lands while the page is open. */
export function useAcknowledgeMarathon(marathon: Marathon | null | undefined) {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const profile = useAuthStore((state) => state.profile)
  const unseen = !!marathon && hasUnseenActivity(marathon, profile)

  useEffect(() => {
    if (!uid || !marathon || !unseen) return
    void updateDoc(doc(db, 'users', uid), { [`marathonsSeenAt.${marathon.id}`]: serverTimestamp() })
  }, [uid, marathon, unseen])
}
