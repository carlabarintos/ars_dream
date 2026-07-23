import { useEffect, useState } from 'react'

import type { QuestionnaireTemplate } from '@/types'

import { subscribeToQuestionnaireTemplate, subscribeToQuestionnaireTemplates } from './api'

export function useQuestionnaireTemplates() {
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToQuestionnaireTemplates((data) => {
      setTemplates(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { templates, isLoading }
}

export function useQuestionnaireTemplate(templateId: string | null | undefined) {
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!templateId) {
      setTemplate(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const unsubscribe = subscribeToQuestionnaireTemplate(templateId, (data) => {
      setTemplate(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [templateId])

  return { template, isLoading }
}
