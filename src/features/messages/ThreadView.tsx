import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Timestamp } from 'firebase/firestore'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { MessageSenderRole } from '@/types'

interface ThreadMessage {
  id: string
  senderId: string
  senderRole: MessageSenderRole
  text: string
  createdAt: Timestamp
}

function formatMessageTime(timestamp: Timestamp) {
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
}

export function ThreadView<TMessage extends ThreadMessage>({
  messages,
  isLoading,
  currentUserId,
  getSenderLabel,
  onSend,
  placeholder = 'Write a message…',
  emptyMessage = 'No messages yet — say hello.',
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
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-[60vh] flex-col gap-3">
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-border p-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === currentUserId
            return (
              <div key={message.id} className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-lg px-3 py-2 text-sm break-words',
                    isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
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

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
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
        <Button type="submit" size="icon" disabled={isSending || !text.trim()}>
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  )
}
