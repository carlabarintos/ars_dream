import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/auth-store'
import { formatUserName } from '@/features/auth/use-user-profiles'
import { formatMessageTime } from '@/features/messages/ThreadView'
import { addInternalNote, deleteInternalNote } from '@/features/registrations/api'
import type { InternalNote } from '@/types'

/** Staff-only notes on a booking. They live in a subcollection because the registrant can read the registration doc itself. */
export function InternalNotes({
  addRegistrationId,
  notes,
}: {
  /** New notes go on this booking; the list may combine several of a package's bookings. */
  addRegistrationId: string
  notes: { registrationId: string; note: InternalNote; label?: string }[]
}) {
  const profile = useAuthStore((state) => state.profile)
  const [text, setText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!profile || !text.trim()) return
    setIsSaving(true)
    try {
      await addInternalNote(addRegistrationId, profile.uid, formatUserName(profile), text.trim())
      setText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(item: { registrationId: string; note: InternalNote }) {
    if (!window.confirm('Delete this note?')) return
    try {
      await deleteInternalNote(item.registrationId, item.note.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">Only admins can see these.</p>
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a note…"
          aria-label="New internal note"
          rows={3}
        />
        <Button type="submit" size="sm" variant="outline" disabled={isSaving || !text.trim()}>
          Add note
        </Button>
      </form>
      <ul className="flex flex-col gap-2">
        {notes.map(({ registrationId, note, label }) => (
          <li key={registrationId + note.id} className="bg-muted rounded-md p-2 text-sm">
            {label && <p className="text-muted-foreground mb-1 text-xs">{label}</p>}
            <p className="break-words whitespace-pre-wrap">{note.text}</p>
            <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
              <span>
                {note.authorName} · {formatMessageTime(note.createdAt)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Delete note"
                onClick={() => handleDelete({ registrationId, note })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
