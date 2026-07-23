import { create } from 'zustand'
import type { User } from 'firebase/auth'

import type { UserProfile } from '@/types'

interface AuthState {
  firebaseUser: User | null
  profile: UserProfile | null
  isLoading: boolean
  setFirebaseUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (isLoading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  isLoading: true,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}))

export const useIsAdmin = () => useAuthStore((state) => state.profile?.role === 'admin')
