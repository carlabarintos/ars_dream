import { useEffect, useState } from 'react'

import type { Announcement, GroupMessage, PersonalMessage, PersonalThread } from '@/types'

import {
  subscribeToAllPersonalThreads,
  subscribeToAnnouncements,
  subscribeToGroupMessages,
  subscribeToPersonalThreadMessages,
} from './api'

export function usePersonalThreadMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<PersonalMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setMessages([])
      setIsLoading(false)
      return
    }
    const unsubscribe = subscribeToPersonalThreadMessages(userId, (data) => {
      setMessages(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [userId])

  return { messages, isLoading }
}

export function useAllPersonalThreads() {
  const [threads, setThreads] = useState<PersonalThread[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAllPersonalThreads((data) => {
      setThreads(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { threads, isLoading }
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((data) => {
      setAnnouncements(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { announcements, isLoading }
}

export function useGroupMessages() {
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToGroupMessages((data) => {
      setMessages(data)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  return { messages, isLoading }
}
