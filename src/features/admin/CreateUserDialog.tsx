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
import { Input } from '@/components/ui/input'
import { createUser } from '@/features/registrations/api'

/** Creates an account from just an email; the person gets an invite to set their own password. */
export function CreateUserDialog({ existingEmails }: { existingEmails: string[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set when the server reports a duplicate the local list didn't know about (e.g. an Auth account with no profile yet).
  const [serverDuplicate, setServerDuplicate] = useState('')
  const normalized = email.trim().toLowerCase()
  const exists = existingEmails.some((e) => e.toLowerCase() === normalized) || serverDuplicate === normalized

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (exists) return
    setIsSubmitting(true)
    try {
      await createUser(email)
      toast.success(`Account created — invite sent to ${email}.`)
      setEmail('')
      setOpen(false)
    } catch (error) {
      if ((error as { code?: string })?.code === 'functions/already-exists') {
        setServerDuplicate(normalized)
        return
      }
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create User</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              They'll get an email invite to set their password, then fill in their own details.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            required
            autoFocus
            placeholder="runner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={exists}
            aria-describedby="create-user-email-warning"
          />
          {exists && (
            <p id="create-user-email-warning" role="alert" className="text-destructive text-sm">
              A user with this email already exists.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || exists}>
              {isSubmitting ? 'Creating…' : 'Create & Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
