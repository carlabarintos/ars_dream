import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { XIcon } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName, useAllUsers, useUserProfilesByIds } from '@/features/auth/use-user-profiles'
import { useAllMarathons } from '@/features/marathons/use-marathons'
import {
  createAnnouncement,
  deleteAnnouncement,
  markPersonalThreadRead,
  sendPersonalMessage,
  uploadAnnouncementBanner,
  type AnnouncementInput,
} from '@/features/messages/api'
import { ThreadView } from '@/features/messages/ThreadView'
import { useAllPersonalThreads, useAnnouncements, usePersonalThreadMessages } from '@/features/messages/use-messages'
import type { AnnouncementAudience, PersonalThread } from '@/types'

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
          getSenderLabel={(message) =>
            (message.senderRole === 'admin' ? 'You' : userName) +
            (message.registrationLabel ? ` · re: ${message.registrationLabel}` : '')
          }
          showEventLabels
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

const AUDIENCE_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'marathon', label: 'Registrants of a marathon' },
  { value: 'marathon_confirmed', label: 'Confirmed registrants of a marathon' },
  { value: 'users', label: 'Specific users' },
]

function UserMultiSelect({
  selectedUserIds,
  onChange,
}: {
  selectedUserIds: string[]
  onChange: (userIds: string[]) => void
}) {
  const { profiles } = useAllUsers()
  const [search, setSearch] = useState('')
  const selectedProfiles = useUserProfilesByIds(selectedUserIds)

  const filteredProfiles = profiles
    .filter((profile) => !selectedUserIds.includes(profile.uid))
    .filter((profile) => {
      if (!search.trim()) return true
      const query = search.trim().toLowerCase()
      return (
        formatUserName(profile).toLowerCase().includes(query) ||
        (profile.email ?? '').toLowerCase().includes(query)
      )
    })

  function toggleUser(uid: string) {
    onChange([...selectedUserIds, uid])
  }

  function removeUser(uid: string) {
    onChange(selectedUserIds.filter((id) => id !== uid))
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedUserIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUserIds.map((uid) => (
            <Badge key={uid} variant="secondary" className="gap-1">
              {formatUserName(selectedProfiles[uid])}
              <button type="button" onClick={() => removeUser(uid)} aria-label="Remove user">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        placeholder="Search users by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto rounded-md border border-border">
        {filteredProfiles.length === 0 ? (
          <p className="text-muted-foreground p-3 text-center text-xs">No matching users.</p>
        ) : (
          filteredProfiles.map((profile) => (
            <button
              key={profile.uid}
              type="button"
              onClick={() => toggleUser(profile.uid)}
              className="hover:bg-secondary flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0"
            >
              <span>{formatUserName(profile)}</span>
              <span className="text-muted-foreground text-xs">{profile.email}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function AnnouncementsTab() {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const { announcements, isLoading } = useAnnouncements()
  const { marathons } = useAllMarathons()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState('')
  const [feedDeadline, setFeedDeadline] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('all')
  const [targetMarathonId, setTargetMarathonId] = useState('')
  const [targetUserIds, setTargetUserIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const marathonById = useMemo(() => new Map(marathons.map((m) => [m.id, m])), [marathons])

  function resetForm() {
    setTitle('')
    setBody('')
    setBannerFile(null)
    setBannerPreviewUrl('')
    setFeedDeadline('')
    setAudience('all')
    setTargetMarathonId('')
    setTargetUserIds([])
  }

  function handleBannerFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!adminUid) return
    if ((audience === 'marathon' || audience === 'marathon_confirmed') && !targetMarathonId) {
      toast.error('Choose a marathon to target.')
      return
    }
    if (audience === 'users' && targetUserIds.length === 0) {
      toast.error('Choose at least one user to target.')
      return
    }

    setIsSubmitting(true)
    try {
      const bannerImageUrl = bannerFile ? await uploadAnnouncementBanner(bannerFile) : undefined
      const input: AnnouncementInput = {
        title: title.trim(),
        body: body.trim(),
        audience,
        ...(bannerImageUrl ? { bannerImageUrl } : {}),
        ...(feedDeadline ? { feedDeadline: new Date(feedDeadline) } : {}),
        ...(audience === 'marathon' || audience === 'marathon_confirmed' ? { targetMarathonId } : {}),
        ...(audience === 'users' ? { targetUserIds } : {}),
      }
      await createAnnouncement(input, adminUid)
      resetForm()
      toast.success('Announcement posted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(announcementId: string) {
    setDeletingId(announcementId)
    try {
      await deleteAnnouncement(announcementId)
      toast.success('Announcement removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setDeletingId(null)
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="announcement-banner">Banner image (optional)</Label>
          {bannerPreviewUrl && (
            <img
              src={bannerPreviewUrl}
              alt=""
              className="h-32 w-full rounded-md border border-border object-cover"
            />
          )}
          <Input id="announcement-banner" type="file" accept="image/*" onChange={handleBannerFileChange} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="announcement-feed-deadline">Show in feed until (optional)</Label>
          <Input
            id="announcement-feed-deadline"
            type="date"
            value={feedDeadline}
            onChange={(e) => setFeedDeadline(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            After this date the announcement drops off the Home feed, but stays visible in Messages →
            Announcements. Leave blank to show indefinitely.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Send to</Label>
          <Select value={audience} onValueChange={(value) => setAudience(value as AnnouncementAudience)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(audience === 'marathon' || audience === 'marathon_confirmed') && (
          <div className="flex flex-col gap-1.5">
            <Label>Marathon</Label>
            <Select value={targetMarathonId} onValueChange={setTargetMarathonId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Choose a marathon…" />
              </SelectTrigger>
              <SelectContent>
                {marathons.map((marathon) => (
                  <SelectItem key={marathon.id} value={marathon.id}>
                    {marathon.title} ({marathon.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {audience === 'marathon_confirmed' && (
              <p className="text-muted-foreground text-xs">
                Only sent to registrants with a confirmed (payment-accepted) registration who have also uploaded
                their passport bio page and answered every required questionnaire item, if this marathon has one.
              </p>
            )}
          </div>
        )}

        {audience === 'users' && (
          <div className="flex flex-col gap-1.5">
            <Label>Users</Label>
            <UserMultiSelect selectedUserIds={targetUserIds} onChange={setTargetUserIds} />
          </div>
        )}

        <Button type="submit" className="self-start" loading={isSubmitting}>
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
              <div className="flex gap-3">
                {announcement.bannerImageUrl && (
                  <img
                    src={announcement.bannerImageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-md object-cover"
                  />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{announcement.title}</h3>
                    <Badge variant="secondary">
                      {announcement.audience === 'all'
                        ? 'All users'
                        : announcement.audience === 'marathon'
                          ? `Marathon: ${marathonById.get(announcement.targetMarathonId ?? '')?.title ?? 'Unknown'}`
                          : announcement.audience === 'marathon_confirmed'
                            ? `Confirmed: ${marathonById.get(announcement.targetMarathonId ?? '')?.title ?? 'Unknown'}`
                            : `${announcement.targetUserIds?.length ?? 0} ${announcement.targetUserIds?.length === 1 ? 'user' : 'users'}`}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{announcement.body}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={deletingId === announcement.id}
                onClick={() => handleDelete(announcement.id)}
              >
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
