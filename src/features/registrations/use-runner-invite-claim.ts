import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAuthStore } from '@/features/auth/auth-store'

import { claimRunnerInvite } from './api'

/**
 * A runner invite link (?runnerInvite=...) is claimed once someone is signed in, however they got there: signing up,
 * signing in, or already signed in. Read during render, before any redirect can drop it from the URL.
 */
export function useRunnerInviteClaim() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('runnerInvite'))

  useEffect(() => {
    if (!uid || !token) return
    setToken(null)
    claimRunnerInvite(token)
      .then(({ runner }) => toast.success(`You're on the booking as Runner ${runner}. Find it under My Bookings.`))
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Something went wrong'))
  }, [uid, token])
}
