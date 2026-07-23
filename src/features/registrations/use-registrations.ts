import { useEffect, useState } from 'react'

import type { Registration } from '@/types'

import { subscribeToMarathonRegistrations, subscribeToUserRegistrations } from './api'

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

export function useMarathonRegistrations(
  marathonId: string | undefined,
  status: Registration['status'] | Registration['status'][],
) {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const statusKey = Array.isArray(status) ? status.join(',') : status

  useEffect(() => {
    if (!marathonId) {
      setRegistrations([])
      setIsLoading(false)
      return
    }
    const unsubscribe = subscribeToMarathonRegistrations(marathonId, status, (data) => {
      setRegistrations(data)
      setIsLoading(false)
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marathonId, statusKey])

  return { registrations, isLoading }
}
