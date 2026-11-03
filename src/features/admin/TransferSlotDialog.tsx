import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatUserName, useAllUsers } from '@/features/auth/use-user-profiles'
import { transferRegistration } from '@/features/registrations/api'
import type { Registration } from '@/types'

// Mirrors TRANSFERABLE_STATUSES in functions/src/transfer-registration.ts.
export const TRANSFERABLE_STATUSES: Registration['status'][] = [
  'accepted',
  'terms_accepted',
  'payment_rejected',
  'deposit_paid',
  'final_invoiced',
  'confirmed',
]

/** Moves the slot, with its deposit, invoices and payment history, to another person by email. */
export function TransferSlotDialog({
  registration,
  registrantName,
  onClose,
}: {
  registration: Registration
  registrantName: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { profiles } = useAllUsers()
  const normalized = email.trim().toLowerCase()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  // Preview only — the server decides (an Auth account without a profile is still found there, not re-created).
  const existing = isEmail ? profiles.find((p) => p.email?.toLowerCase() === normalized) : undefined
  const isCurrentHolder = existing?.uid === registration.userId

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const { invited } = await transferRegistration(registration.id, email)
      toast.success(invited ? 'Slot transferred — an account invite was sent.' : 'Slot transferred.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Transfer Slot</DialogTitle>
            <DialogDescription>
              {registrantName}'s booking — package, payments and invoices — moves to the person below. They accept the
              terms & conditions and give their own passport and questionnaire; {registrantName}'s stay on this booking,
              which ends as transferred. You can still change the package or amend invoices afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-email">New holder's email</Label>
            <Input
              id="transfer-email"
              type="email"
              required
              autoFocus
              placeholder="runner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p role="status" className={isCurrentHolder ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
              {!isEmail
                ? 'Enter the email of an existing user, or a new one to create their account.'
                : isCurrentHolder
                  ? 'This email already holds this booking.'
                  : existing
                    ? `Existing user: ${formatUserName(existing)}.`
                    : "No account with this email — one will be created and they'll be emailed an invite to set their password."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isEmail || isCurrentHolder}>
              {isEmail && !existing ? 'Create User & Transfer' : 'Transfer Slot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
