import { useEffect, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth-store'
import { uploadMarathonPackageOffer } from '@/features/marathons/api'
import { sendPersonalMessage } from '@/features/messages/api'
import { decideQueueRegistration } from '@/features/registrations/api'
import type { Marathon, Registration } from '@/types'

function buildDefaultOfferMessage(marathonTitle: string, packageName: string) {
  return `Congratulations! Here's your standard offer for ${marathonTitle} — ${packageName}.`
}

/**
 * Opened from the Accept action in Queue Review. Lets the admin preview (and optionally swap,
 * just for this send) the package's standard offer image and edit a pre-filled message before
 * accepting the registration and sending both to the registrant via the personal chat thread.
 */
export function OfferChatDialog({
  registration,
  marathon,
  onClose,
}: {
  /** The registration being accepted; the dialog is open whenever this is non-null. */
  registration: Registration | null
  marathon: Marathon | null
  onClose: () => void
}) {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const open = registration != null
  const pkg = marathon?.packages?.find((p) => p.id === registration?.packageId)

  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Re-derive defaults each time the dialog opens for a (possibly different) registration —
  // depends only on primitive ids so it doesn't re-fire (and wipe in-progress edits) on every
  // unrelated onSnapshot re-render of `registration`/`marathon`.
  useEffect(() => {
    if (!open || !registration || !marathon) return
    setText(buildDefaultOfferMessage(marathon.title, pkg?.name ?? registration.packageName))
    setImageFile(null)
    setImagePreviewUrl(pkg?.offerImageUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registration?.id, marathon?.id])

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (imageFile) URL.revokeObjectURL(imagePreviewUrl!)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function handleResetImage() {
    if (imageFile) URL.revokeObjectURL(imagePreviewUrl!)
    setImageFile(null)
    setImagePreviewUrl(pkg?.offerImageUrl)
  }

  async function handleProceed() {
    if (!registration || !marathon || !adminUid) return
    setIsSubmitting(true)
    try {
      const finalImageUrl = imageFile ? await uploadMarathonPackageOffer(imageFile) : pkg?.offerImageUrl
      await decideQueueRegistration(registration.id, 'accepted', finalImageUrl)
      try {
        await sendPersonalMessage(registration.userId, adminUid, 'admin', text.trim(), finalImageUrl)
        toast.success('Registration accepted and offer sent.')
      } catch {
        toast.error('Registration accepted, but the offer message failed to send.')
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Standard Offer</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs">Offer image</Label>
          {imagePreviewUrl ? (
            <img
              src={imagePreviewUrl}
              alt=""
              className="max-h-56 w-full rounded-md border border-border object-contain"
            />
          ) : (
            <p className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-center text-xs">
              No offer image set for this package yet — upload one below to include it.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={handleImageFileChange} className="flex-1" />
            {imageFile && (
              <Button type="button" variant="ghost" size="sm" onClick={handleResetImage}>
                Use default
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offer-message" className="text-muted-foreground text-xs">
            Message
          </Label>
          <Textarea id="offer-message" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleProceed} disabled={!text.trim()} loading={isSubmitting}>
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
