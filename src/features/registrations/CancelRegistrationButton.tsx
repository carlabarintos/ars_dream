import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import type { Registration } from '@/types'

import { cancelRegistration } from './api'
import { canCancelRegistration } from './registration-flow'

export function CancelRegistrationButton({ registration }: { registration: Registration }) {
  const [open, setOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  if (!canCancelRegistration(registration)) return null

  async function handleCancel() {
    setIsCancelling(true)
    try {
      await cancelRegistration(registration.id)
      toast.success('Your registration has been cancelled.')
      setOpen(false)
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'cancel'))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Cancel Registration
      </Button>
      <Dialog open={open} onOpenChange={(next) => !isCancelling && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this registration?</DialogTitle>
            <DialogDescription>
              {registration.status === 'confirmed'
                ? 'This will give up your confirmed spot for this event. You can register again later if space is still available.'
                : "This will withdraw your registration. You can register again later if you've changed your mind."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isCancelling}>
              Keep Registration
            </Button>
            <Button variant="destructive" loading={isCancelling} onClick={handleCancel}>
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
