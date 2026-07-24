import { useEffect } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'

import { markPersonalThreadRead, sendGroupMessage, sendPersonalMessage } from './api'
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

function AnnouncementsTab() {
  const { announcements, isLoading } = useAnnouncements()

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (announcements.length === 0) {
    return <p className="text-muted-foreground text-sm">No announcements yet.</p>
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {announcements.map((announcement) => (
        <div key={announcement.id} className="rounded-md border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium">{announcement.title}</h3>
            <span className="text-muted-foreground shrink-0 text-xs">{formatAnnouncementDate(announcement.createdAt)}</span>
          </div>
          <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{announcement.body}</p>
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Messages</h1>
        <p className="text-muted-foreground mt-1">Chat with our team, catch up on announcements, or say hi to other travelers.</p>
      </div>

      <Tabs defaultValue={role === 'admin' ? 'announcements' : 'support'}>
        <TabsList>
          {role !== 'admin' && <TabsTrigger value="support">Support</TabsTrigger>}
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>
        {role !== 'admin' && (
          <TabsContent value="support">
            <SupportTab uid={uid} />
          </TabsContent>
        )}
        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
        <TabsContent value="community">
          <CommunityTab uid={uid} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
