import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { auth, db } from '@/firebase/config'
import { registerPushNotifications } from '@/firebase/messaging'
import type { UserProfile } from '@/types'

import { useAuthStore } from './auth-store'

// Keeps the bib loading spinner on screen for at least this long, so it doesn't
// flash by unseen when auth resolves near-instantly (e.g. cached emulator session).
const MIN_SPINNER_MS = 500

export function useAuthListener() {
  const setFirebaseUser = useAuthStore((state) => state.setFirebaseUser)
  const setProfile = useAuthStore((state) => state.setProfile)
  const setLoading = useAuthStore((state) => state.setLoading)
  const hasFinishedInitialLoad = useRef(false)

  useEffect(() => {
    const startedAt = Date.now()
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let unsubscribeProfile: (() => void) | undefined

    const finishLoading = () => {
      if (hasFinishedInitialLoad.current) {
        setLoading(false)
        return
      }
      hasFinishedInitialLoad.current = true
      const remaining = MIN_SPINNER_MS - (Date.now() - startedAt)
      if (remaining > 0) {
        timeoutId = setTimeout(() => setLoading(false), remaining)
      } else {
        setLoading(false)
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      unsubscribeProfile?.()

      if (!user) {
        setProfile(null)
        finishLoading()
        return
      }

      const userRef = doc(db, 'users', user.uid)
      unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
        if (!snapshot.exists()) {
          // Fallback creation for accounts with no profile doc yet (e.g. Google
          // sign-in, which has no separate sign-up step). merge:true so this can't
          // clobber personal-info fields written by signUpWithEmail's own direct
          // write (auth-actions.ts) if the two happen to race.
          await setDoc(
            userRef,
            {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              role: 'user',
              fcmTokens: [],
              createdAt: serverTimestamp(),
            } satisfies Omit<UserProfile, 'createdAt'> & { createdAt: unknown },
            { merge: true },
          )
          return
        }
        setProfile(snapshot.data() as UserProfile)
        finishLoading()
        void registerPushNotifications(user.uid)
      })
    })

    return () => {
      unsubscribeAuth()
      unsubscribeProfile?.()
      clearTimeout(timeoutId)
    }
  }, [setFirebaseUser, setProfile, setLoading])
}
