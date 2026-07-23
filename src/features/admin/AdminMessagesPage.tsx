import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import {
  createAnnouncement,
  deleteAnnouncement,
  markPersonalThreadRead,
  sendPersonalMessage,
} from '@/features/messages/api'
import { ThreadView } from '@/features/messages/ThreadView'
import { useAllPersonalThreads, useAnnouncements, usePersonalThreadMessages } from '@/features/messages/use-messages'
import type { PersonalThread } from '@/types'

function formatThreadTime(timestamp: PersonalThread['lastMessageAt']) {
  if (!timestamp) return '—'
  return timestamp.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function PersonalThreadDialog({ thread, adminUid }: { thread: PersonalThread; adminUid: string }) {
  const [open, setOpen] = useState(false)
  const { messages, isLoading } = usePersonalThreadMessages(thread.userId)
  const profiles = useUserProfilesByIds([thread.userId])
  const userName = formatUserName(profiles[thread.userId])

  useEffect(() => {
    if (open) void markPersonalThreadRead(thread.userId, 'admin')
  }, [open, thread.userId])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {thread.unreadByAdmin ? 'Reply (new)' : 'Reply'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{userName}</DialogTitle>
          <DialogDescription>Private support thread with this user.</DialogDescription>
        </DialogHeader>
        <ThreadView
          messages={messages}
          isLoading={isLoading}
          currentUserId={adminUid}
          getSenderLabel={(message) => (message.senderRole === 'admin' ? 'You' : userName)}
          placeholder="Reply to this user…"
          onSend={(text) => sendPersonalMessage(thread.userId, adminUid, 'admin', text)}
        />
      </DialogContent>
    </Dialog>
  )
}

function SupportInboxTab() {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const { threads, isLoading } = useAllPersonalThreads()
  const profiles = useUserProfilesByIds(threads.map((t) => t.userId))

  if (!adminUid) return null
  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>
  if (threads.length === 0) return <p className="text-muted-foreground text-sm">No support conversations yet.</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Last message</TableHead>
          <TableHead>When</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {threads.map((thread) => (
          <TableRow key={thread.userId}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {formatUserName(profiles[thread.userId])}
                {thread.unreadByAdmin && <Badge variant="success">New</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-xs truncate">{thread.lastMessageText ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground">{formatThreadTime(thread.lastMessageAt)}</TableCell>
            <TableCell className="text-right">
              <PersonalThreadDialog thread={thread} adminUid={adminUid} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AnnouncementsTab() {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const { announcements, isLoading } = useAnnouncements()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!adminUid) return

    setIsSubmitting(true)
    try {
      await createAnnouncement(adminUid, title.trim(), body.trim())
      setTitle('')
      setBody('')
      toast.success('Announcement posted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(announcementId: string) {
    try {
      await deleteAnnouncement(announcementId)
      toast.success('Announcement removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="announcement-title">Title</Label>
          <Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="announcement-body">Message</Label>
          <Textarea id="announcement-body" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <Button type="submit" className="self-start" disabled={isSubmitting}>
          Post announcement
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : announcements.length === 0 ? (
        <p className="text-muted-foreground text-sm">No announcements posted yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-4">
              <div>
                <h3 className="font-medium">{announcement.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{announcement.body}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(announcement.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminMessagesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Messages</h1>
        <p className="text-muted-foreground mt-1">Reply to user support threads and post announcements.</p>
      </div>

      <Tabs defaultValue="support">
        <TabsList>
          <TabsTrigger value="support">Support inbox</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="support">
          <SupportInboxTab />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
