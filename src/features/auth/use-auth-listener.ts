import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { auth, db } from '@/firebase/config'
import { registerPushNotifications } from '@/firebase/messaging'
import type { UserProfile } from '@/types'

import { useAuthStore } from './auth-store'

export function useAuthListener() {
  const setFirebaseUser = useAuthStore((state) => state.setFirebaseUser)
  const setProfile = useAuthStore((state) => state.setProfile)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      unsubscribeProfile?.()

      if (!user) {
        setProfile(null)
        setLoading(false)
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
        setLoading(false)
        void registerPushNotifications(user.uid)
      })
    })

    return () => {
      unsubscribeAuth()
      unsubscribeProfile?.()
    }
  }, [setFirebaseUser, setProfile, setLoading])
}
