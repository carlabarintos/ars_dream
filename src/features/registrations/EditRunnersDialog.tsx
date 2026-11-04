import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Marathon, Registration } from '@/types'

import { updateCompanionContacts } from './api'
import { getRunnerCount, isValidEmail } from './registration-flow'
import { CompanionFields } from './RegistrationWizard'

/**
 * Lets an admin or the lead registrant change the name/email of runners 2+ on a multi-runner booking (the email is
 * CC'd on its emails). onRegistrationStatusChange logs every change to the booking's chat, naming who made it.
 */
export function EditRunnersDialog({
  registration,
  marathon,
  editedBy,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  editedBy: 'user' | 'admin'
  onClose: () => void
}) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: getRunnerCount(registration, marathon) - 1 }, (_, i) => ({
      name: registration.companions?.[i]?.name ?? '',
      email: registration.companions?.[i]?.email ?? '',
    })),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isValid = rows.every((row) => row.name.trim() !== '' && isValidEmail(row.email))

  async function handleSave() {
    setIsSubmitting(true)
    try {
      await updateCompanionContacts(
        registration,
        rows.map((row) => ({ name: row.name.trim(), email: row.email.trim() })),
        editedBy,
      )
      toast.success('Runner details updated.')
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
          <DialogTitle>Edit Runner Details</DialogTitle>
          <DialogDescription>
            {editedBy === 'admin'
              ? 'Runner 1 is the account holder. These runners are copied on this booking\'s emails from now on.'
              : "They're copied on this booking's emails (invoices, T&C and passport reminders). Changes are noted in the booking's messages."}
          </DialogDescription>
        </DialogHeader>
        {rows.map((row, i) => (
          <CompanionFields
            key={i}
            runner={i + 1}
            value={row}
            hint={null}
            onChange={(field, value) =>
              setRows((current) => current.map((r, j) => (j === i ? { ...r, [field]: value } : r)))
            }
          />
        ))}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSubmitting} disabled={!isValid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
