import { useEffect, useState } from 'react'

import type { AuditLogEntry } from '@/types'

import { subscribeToAuditLog } from './api'

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAuditLog((data) => {
      setEntries(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { entries, isLoading }
}
