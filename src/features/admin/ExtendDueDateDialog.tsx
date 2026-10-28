import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { extendDueDate } from '@/features/registrations/api'
import { toDateInputValue } from '@/lib/utils'
import type { Marathon, Registration } from '@/types'

import { getStepDueDate } from '../../../functions/src/email-template'

const STEP_LABEL = { accepted: 'Offer acceptance', terms_accepted: 'Deposit', final_invoiced: 'Balance' } as const
export const EXTENDABLE_STATUSES = Object.keys(STEP_LABEL) as (keyof typeof STEP_LABEL)[]

/** Lets an admin push back the pending step's due date; clears an overdue flag and notifies the registrant. */
export function ExtendDueDateDialog({
  registration,
  marathon,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  onClose: () => void
}) {
  const status = registration.status as keyof typeof STEP_LABEL
  const current = getStepDueDate(registration, marathon, status)
  const [dueDate, setDueDate] = useState(() => toDateInputValue(current && current > new Date() ? current : new Date()))
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSave() {
    setIsSubmitting(true)
    try {
      // End of the chosen day, local time, matching FinalInvoiceDialog.
      await extendDueDate(registration, new Date(`${dueDate}T23:59:59`))
      toast.success('Due date extended.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend Due Date</DialogTitle>
          <DialogDescription>
            {STEP_LABEL[status]} currently due{' '}
            {current ? current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}.
            The registrant is notified and the change is recorded in the booking's history.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="extend-due-date">New due date</Label>
          <Input
            id="extend-due-date"
            type="date"
            min={toDateInputValue(new Date())}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSubmitting} disabled={!dueDate}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
