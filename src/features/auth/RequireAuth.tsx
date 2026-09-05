import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { PageSpinner } from '@/components/ui/spinner'

import { useAuthStore } from './auth-store'

export function RequireAuth({ children }: { children: ReactNode }) {
  const firebaseUser = useAuthStore((state) => state.firebaseUser)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return <PageSpinner />
  if (!firebaseUser) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const profile = useAuthStore((state) => state.profile)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return <PageSpinner />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

/** Gates the revenue report — unlike RequireAdmin, also lets the lighter 'finance' role through. */
export function RequireFinanceAccess({ children }: { children: ReactNode }) {
  const profile = useAuthStore((state) => state.profile)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return <PageSpinner />
  if (profile?.role !== 'admin' && profile?.role !== 'finance') return <Navigate to="/" replace />
  return <>{children}</>
}
