import { useEffect, useState } from 'react'

import type { Registration } from '@/types'

import { subscribeToConfirmedRegistrations, subscribeToMarathonRegistrations, subscribeToUserRegistrations } from './api'

export function useUserRegistrations(userId: string | undefined) {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setRegistrations([])
      setIsLoading(false)
      return
    }
    const unsubscribe = subscribeToUserRegistrations(userId, (data) => {
      setRegistrations(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [userId])

  return { registrations, isLoading }
}

/** Every confirmed registration across every marathon, for the revenue report. */
export function useConfirmedRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToConfirmedRegistrations((data) => {
      setRegistrations(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { registrations, isLoading }
}

/**
 * `cycle` scopes results to a single registration round (see Marathon.cycle) — filtered
 * in-app rather than as a query clause, since old registrations that predate the cycle
 * field have no `cycle` value for Firestore to match against. Pass undefined to skip
 * cycle scoping (e.g. while the marathon itself hasn't loaded yet).
 */
export function useMarathonRegistrations(
  marathonId: string | undefined,
  cycle: number | undefined,
  status: Registration['status'] | Registration['status'][],
) {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const statusKey = Array.isArray(status) ? status.join(',') : status

  useEffect(() => {
    if (!marathonId || cycle == null) {
      setRegistrations([])
      setIsLoading(false)
      return
    }
    const unsubscribe = subscribeToMarathonRegistrations(marathonId, status, (data) => {
      setRegistrations(data.filter((r) => (r.cycle ?? 1) === cycle))
      setIsLoading(false)
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marathonId, cycle, statusKey])

  return { registrations, isLoading }
}
