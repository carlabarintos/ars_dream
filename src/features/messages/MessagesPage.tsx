import { useEffect } from 'react'

import { RouteLines } from '@/components/RouteLines'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useMarathonsByIds } from '@/features/marathons/use-marathons'
import { useUserRegistrations } from '@/features/registrations/use-registrations'

import { isAnnouncementVisibleTo, markPersonalThreadRead, sendGroupMessage, sendPersonalMessage } from './api'
import { ThreadView } from './ThreadView'
import { useAnnouncements, useGroupMessages, usePersonalThreadMessages } from './use-messages'

function formatAnnouncementDate(timestamp: { toDate: () => Date } | null) {
  if (!timestamp) return 'just now'
  return timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SupportTab({ uid }: { uid: string }) {
  const { messages, isLoading } = usePersonalThreadMessages(uid)

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      void markPersonalThreadRead(uid, 'user')
    }
  }, [uid, isLoading, messages.length])

  return (
    <ThreadView
      messages={messages}
      isLoading={isLoading}
      currentUserId={uid}
      getSenderLabel={(message) => (message.senderRole === 'admin' ? 'Support team' : 'You')}
      placeholder="Ask us anything about your booking…"
      emptyMessage="No messages yet — send us a question and our team will get back to you."
      onSend={(text) => sendPersonalMessage(uid, uid, 'user', text)}
    />
  )
}

function AnnouncementsTab({ uid }: { uid: string }) {
  const { announcements, isLoading } = useAnnouncements()
  const { registrations } = useUserRegistrations(uid)
  const marathonById = useMarathonsByIds(registrations.map((r) => r.marathonId))

  const visibleAnnouncements = announcements.filter((a) => isAnnouncementVisibleTo(a, uid, registrations, marathonById))

  if (isLoading) return (
    <div className="flex justify-center py-8">
      <Spinner />
    </div>
  )
  if (visibleAnnouncements.length === 0) {
    return <p className="text-muted-foreground text-sm">No announcements yet.</p>
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
        >
          {announcement.bannerImageUrl && (
            <div
              className="h-32 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${announcement.bannerImageUrl})` }}
            />
          )}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{announcement.title}</h3>
              <span className="text-muted-foreground shrink-0 text-xs">{formatAnnouncementDate(announcement.createdAt)}</span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{announcement.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommunityTab({ uid }: { uid: string }) {
  const { messages, isLoading } = useGroupMessages()
  const profiles = useUserProfilesByIds(messages.map((m) => m.senderId))
  const role = useAuthStore((state) => state.profile?.role)

  return (
    <ThreadView
      messages={messages}
      isLoading={isLoading}
      currentUserId={uid}
      getSenderLabel={(message) =>
        message.senderId === uid
          ? 'You'
          : formatUserName(profiles[message.senderId]) + (message.senderRole === 'admin' ? ' (Staff)' : '')
      }
      placeholder="Share something with the community…"
      emptyMessage="No messages yet — be the first to say hello."
      onSend={(text) => sendGroupMessage(uid, role === 'admin' ? 'admin' : 'user', text)}
    />
  )
}

export function MessagesPage() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const role = useAuthStore((state) => state.profile?.role)

  if (!uid) return null

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-4 pt-14 pb-24 sm:pt-20 sm:pb-28">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <svg
          className="pointer-events-none absolute top-1/2 right-[-8%] h-[min(52vw,420px)] w-[min(52vw,420px)] -translate-y-1/2 opacity-90 max-sm:top-auto max-sm:right-[-22%] max-sm:bottom-[-18%] max-sm:h-[70vw] max-sm:w-[70vw] max-sm:translate-y-0 max-sm:opacity-40"
          viewBox="0 0 300 300"
          aria-hidden="true"
        >
          <circle cx="150" cy="150" r="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="52" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="150" cy="150" rx="95" ry="130" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="20" y1="150" x2="280" y2="150" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="95" x2="265" y2="95" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <line x1="35" y1="205" x2="265" y2="205" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/70 uppercase before:h-px before:w-6 before:bg-white/70 after:h-px after:w-6 after:bg-white/70">
            Inbox
          </span>
          <h1 className="font-display max-w-[14ch] text-5xl leading-[0.95] tracking-wide text-white sm:text-6xl">
            Let's Talk
          </h1>
          <p className="mt-5 max-w-[46ch] text-white/80">
            Chat with our team, catch up on announcements, or say hi to other travelers.
          </p>
        </div>
      </section>

      <Tabs defaultValue={role === 'admin' ? 'announcements' : 'support'}>
        <div className="relative z-10 mx-auto -mt-10 max-w-2xl px-4 sm:-mt-12">
          <TabsList className="border-border bg-card h-auto w-full gap-1 rounded-2xl border p-1.5 shadow-lg sm:p-2">
            {role !== 'admin' && (
              <TabsTrigger value="support" className="rounded-xl py-2">
                Support
              </TabsTrigger>
            )}
            <TabsTrigger value="announcements" className="rounded-xl py-2">
              Announcements
            </TabsTrigger>
            <TabsTrigger value="community" className="rounded-xl py-2">
              Community
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-8">
          {role !== 'admin' && (
            <TabsContent value="support">
              <SupportTab uid={uid} />
            </TabsContent>
          )}
          <TabsContent value="announcements">
            <AnnouncementsTab uid={uid} />
          </TabsContent>
          <TabsContent value="community">
            <CommunityTab uid={uid} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  )
}
