import { useEffect } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MessageSenderRole, Registration } from '@/types'

import { markPersonalThreadRead, sendPersonalMessage } from './api'
import { ThreadView } from './ThreadView'
import { usePersonalThreadMessages } from './use-messages'

/**
 * One booking's slice of the registrant's support thread — e.g. working out add-ons before the
 * final invoice. Messages are tagged with the registration, so they still show (with a "re:" tag)
 * in the full thread on the client's Messages page and the admin inbox.
 */
interface BookingChatProps {
  registration: Registration
  marathonTitle: string
  viewerId: string
  viewerRole: MessageSenderRole
  otherPartyLabel: string
  className?: string
}

export function BookingChatDialog({ onClose, ...props }: BookingChatProps & { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.marathonTitle}</DialogTitle>
          <DialogDescription>
            Messages about this booking, along with its full status history.
          </DialogDescription>
        </DialogHeader>
        <BookingChat {...props} />
      </DialogContent>
    </Dialog>
  )
}

/** The booking's chat + status history on its own, for embedding inline (e.g. on My Bookings, CRM-notes style). */
export function BookingChat({
  registration,
  marathonTitle,
  viewerId,
  viewerRole,
  otherPartyLabel,
  className,
}: BookingChatProps) {
  const { messages, isLoading } = usePersonalThreadMessages(registration.userId)
  const bookingMessages = messages.filter((message) => message.registrationId === registration.id)

  useEffect(() => {
    void markPersonalThreadRead(registration.userId, viewerRole)
  }, [registration.userId, viewerRole, bookingMessages.length])

  return (
    <ThreadView
      className={className}
      messages={bookingMessages}
      isLoading={isLoading}
      currentUserId={viewerId}
      getSenderLabel={(message) => (message.senderRole === viewerRole ? 'You' : otherPartyLabel)}
      emptyMessage="No messages or status updates for this booking yet."
      onSend={(text) =>
        sendPersonalMessage(registration.userId, viewerId, viewerRole, text, undefined, {
          registrationId: registration.id,
          registrationLabel: marathonTitle,
        })
      }
    />
  )
}
