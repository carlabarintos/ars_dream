import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HistoryIcon, SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Timestamp } from 'firebase/firestore'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { cn } from '@/lib/utils'
import type { MessageSenderRole } from '@/types'

interface ThreadMessage {
  id: string
  senderId: string
  senderRole: MessageSenderRole | 'system'
  /** Shown on system entries in the full thread, so it's clear which booking they belong to. */
  registrationLabel?: string
  text: string
  imageUrl?: string
  createdAt: Timestamp | null
}

function formatMessageTime(timestamp: Timestamp | null) {
  if (!timestamp) return 'sending…'
  return timestamp.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface ThreadViewProps<TMessage extends ThreadMessage> {
  messages: TMessage[]
  isLoading: boolean
  currentUserId: string
  getSenderLabel: (message: TMessage) => string
  onSend: (text: string) => Promise<void>
  placeholder?: string
  emptyMessage?: string
  /** Prefix system entries with their booking — for full threads that mix several bookings. */
  showEventLabels?: boolean
}

export function ThreadView<TMessage extends ThreadMessage>({
  messages,
  isLoading,
  currentUserId,
  getSenderLabel,
  onSend,
  placeholder = 'Write a message…',
  emptyMessage = 'No messages yet — say hello.',
  showEventLabels = false,
}: ThreadViewProps<TMessage>) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    setIsSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'message'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-[60vh] flex-col gap-3">
      <div
        ref={scrollRef}
        className="border-border bg-card flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border p-3 shadow-sm [scrollbar-gutter:stable]"
      >
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          messages.map((message) => {
            if (message.senderRole === 'system') {
              return (
                <div key={message.id} className="flex flex-col items-center gap-0.5 py-1 text-center">
                  <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                    <HistoryIcon className="size-3.5 shrink-0" />
                    {message.text}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {showEventLabels && message.registrationLabel ? `${message.registrationLabel} · ` : ''}
                    {formatMessageTime(message.createdAt)}
                  </span>
                </div>
              )
            }
            const isOwn = message.senderId === currentUserId
            return (
              <div key={message.id} className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'flex max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm break-words',
                    isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {message.imageUrl && (
                    <img
                      src={message.imageUrl}
                      alt=""
                      className="max-h-64 w-full rounded-md object-contain"
                    />
                  )}
                  {message.text}
                </div>
                <span className="text-muted-foreground text-xs">
                  {getSenderLabel(message)} · {formatMessageTime(message.createdAt)}
                </span>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="min-h-16 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSubmit(e)
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!text.trim()} loading={isSending}>
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  )
}
