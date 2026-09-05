import { useEffect, useState } from 'react'

import type { LegalContent, LegalPageId } from '@/types'

import { subscribeToLegalContent } from './api'

export function useLegalContent(id: LegalPageId) {
  const [content, setContent] = useState<LegalContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const unsubscribe = subscribeToLegalContent(id, (data) => {
      setContent(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [id])

  return { content, isLoading }
}
