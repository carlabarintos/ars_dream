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
export function BookingChatDialog({
  registration,
  marathonTitle,
  viewerId,
  viewerRole,
  otherPartyLabel,
  onClose,
}: {
  registration: Registration
  marathonTitle: string
  viewerId: string
  viewerRole: MessageSenderRole
  otherPartyLabel: string
  onClose: () => void
}) {
  const { messages, isLoading } = usePersonalThreadMessages(registration.userId)
  const bookingMessages = messages.filter((message) => message.registrationId === registration.id)

  useEffect(() => {
    void markPersonalThreadRead(registration.userId, viewerRole)
  }, [registration.userId, viewerRole, bookingMessages.length])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{marathonTitle}</DialogTitle>
          <DialogDescription>
            Messages about this booking, along with its full status history.
          </DialogDescription>
        </DialogHeader>
        <ThreadView
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
      </DialogContent>
    </Dialog>
  )
}
