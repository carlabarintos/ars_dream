import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Marathon, Registration } from '@/types'

import { updateCompanionContacts } from './api'
import { getRunnerCount, hasRepeatedEmail, isLeadEmail, isValidEmail } from './registration-flow'
import { CompanionFields } from './RegistrationWizard'

/**
 * Lets an admin or the lead registrant name runners 2+ on a multi-runner booking, which gives each their own booking
 * (onRegistrationRunnersChange). onRegistrationStatusChange logs every change to the booking's chat, naming who made it.
 */
export function EditRunnersDialog({
  registration,
  marathon,
  leadEmail,
  editedBy,
  onClose,
}: {
  registration: Registration
  marathon: Marathon | undefined
  leadEmail: string | null | undefined
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
  const isValid =
    rows.every((row) => isValidEmail(row.email) && !isLeadEmail(row.email, leadEmail)) && !hasRepeatedEmail(rows)

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
              ? "Saving links these runners: a registered email gets their own booking on this package straight away, anyone else is emailed an invite to sign up and gets it once they do. A runner already booked as a single runner moves onto this package with their deposit and seat, unless they have a final invoice."
              : "Each runner gets their own booking with their own invoices, T&C and passport (we invite them to sign up if needed). Changes are noted in the booking's messages."}
          </DialogDescription>
        </DialogHeader>
        {rows.map((row, i) => (
          <CompanionFields
            key={i}
            runner={i + 1}
            value={row}
            leadEmail={leadEmail}
            hint={null}
            onChange={(email) => setRows((current) => current.map((r, j) => (j === i ? { name: '', email } : r)))}
          />
        ))}
        {hasRepeatedEmail(rows) && (
          <p className="text-destructive text-xs" role="alert">
            Each runner needs their own email.
          </p>
        )}
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
