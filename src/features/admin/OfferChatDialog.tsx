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
import { cn } from '@/lib/utils'
import type { Marathon, Registration, UserProfile } from '@/types'

// Same template the onRegistrationStatusChange function sends, so the preview can't drift from the real email.
import { buildAcceptanceEmail } from '../../../functions/src/email-template'

function buildDefaultOfferMessage(marathonTitle: string, packageName: string) {
  return `Congratulations! Here's your standard offer for ${marathonTitle} — ${packageName}.`
}

/**
 * Opened from the Accept action in Queue Review. Two steps: first the admin previews (and optionally
 * swaps, just for this send) the package's standard offer image and edits a pre-filled chat message;
 * then they review the exact acceptance email the registrant will receive, and only from there can
 * accept — which sends the email (via onRegistrationStatusChange) and the chat message.
 */
export function OfferChatDialog({
  registration,
  marathon,
  profile,
  onClose,
}: {
  /** The registration being accepted; the dialog is open whenever this is non-null. */
  registration: Registration | null
  marathon: Marathon | null
  /** The registrant's profile, so the email preview greets them by name. */
  profile?: UserProfile
  onClose: () => void
}) {
  const adminUid = useAuthStore((state) => state.firebaseUser?.uid)
  const open = registration != null
  const pkg = marathon?.packages?.find((p) => p.id === registration?.packageId)

  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'compose' | 'preview'>('compose')

  // Re-derive defaults each time the dialog opens for a (possibly different) registration —
  // depends only on primitive ids so it doesn't re-fire (and wipe in-progress edits) on every
  // unrelated onSnapshot re-render of `registration`/`marathon`.
  useEffect(() => {
    if (!open || !registration || !marathon) return
    setText(buildDefaultOfferMessage(marathon.title, pkg?.name ?? registration.packageName))
    setImageFile(null)
    setImagePreviewUrl(pkg?.offerImageUrl)
    setStep('compose')
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isSubmitting && onClose()}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', step === 'preview' && 'sm:max-w-3xl')}>
        <DialogHeader>
          <DialogTitle>{step === 'compose' ? 'Send Standard Offer' : 'Review Acceptance Email'}</DialogTitle>
        </DialogHeader>

        {step === 'compose' ? (
          <>
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
          </>
        ) : (
          registration && (
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-sm">
                This is the email {profile?.email ?? 'the registrant'} will receive once you accept.
              </p>
              <iframe
                title="Acceptance email preview"
                className="h-[65vh] w-full rounded-md border border-border bg-white"
                srcDoc={
                  buildAcceptanceEmail({
                    marathon: marathon ? { ...marathon, eventDate: marathon.eventDate?.toDate() } : undefined,
                    pkg,
                    registration,
                    offerImageUrl: imagePreviewUrl,
                    recipient: profile,
                  }).html
                }
              />
            </div>
          )
        )}

        <DialogFooter>
          {step === 'compose' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep('preview')} disabled={!text.trim()}>
                Preview email
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('compose')} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleProceed} loading={isSubmitting}>
                {isSubmitting ? 'Accepting…' : 'Accept & send'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
