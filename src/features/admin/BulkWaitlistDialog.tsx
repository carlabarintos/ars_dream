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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { bulkWaitlist } from '@/features/registrations/api'

/** Paste an existing waitlist (one email per line, or comma-separated) — in order, first = front of the line. */
export function BulkWaitlistDialog({ marathonId }: { marathonId: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emails = text.split(/[\s,;]+/).filter(Boolean)

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      const { added, invited, alreadyListed } = await bulkWaitlist(marathonId, emails)
      toast.success(`Waitlisted ${added}, invited ${invited} to sign up, ${alreadyListed} already listed.`)
      setText('')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Import Waitlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Waitlist</DialogTitle>
          <DialogDescription>
            One email per line, in waitlist order. Registered users are added now; everyone else gets an email to
            create an account and is waitlisted as soon as they sign up. All of them are emailed that they're
            waitlisted.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          placeholder={'runner1@example.com\nrunner2@example.com'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || emails.length === 0}>
            {isSubmitting ? 'Importing…' : `Import ${emails.length} email${emails.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
