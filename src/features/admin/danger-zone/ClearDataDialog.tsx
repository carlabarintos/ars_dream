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

import { clearOperationalData, type ClearOperationalDataResult } from './clear-data-api'

const CONFIRM_PHRASE = 'CLEAR DATA'

export function ClearDataDialog() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [result, setResult] = useState<ClearOperationalDataResult | null>(null)

  function reset() {
    setConfirmText('')
    setResult(null)
  }

  async function handleConfirm() {
    setIsBusy(true)
    try {
      const summary = await clearOperationalData()
      setResult(summary)
      toast.success('Data cleared.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Clear failed.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Clear Data…</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clear operational data</DialogTitle>
          <DialogDescription>This cannot be undone. Export a backup first if you might need this data again.</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            <ul className="list-inside list-disc text-sm">
              <li>All marathons, plus their banner and package images</li>
              <li>All announcements and their banner images</li>
              <li>All questionnaire templates</li>
              <li>Every non-staff user, their Firebase Auth account, and their personal support thread</li>
              <li>Every registration belonging to a cleared marathon or a cleared user — proof-of-payment images included</li>
            </ul>
            <div className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-xs">
              Group chat messages are never touched. Admin and finance accounts, and any registration that
              somehow belongs to neither a cleared marathon nor a cleared user, are left exactly as they are.
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isBusy}
                autoComplete="off"
              />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                loading={isBusy}
                disabled={confirmText !== CONFIRM_PHRASE}
              >
                Clear Data
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="text-sm">
              <li>{result.marathonsDeleted} marathon(s) deleted</li>
              <li>{result.announcementsDeleted} announcement(s) deleted</li>
              <li>{result.questionnaireTemplatesDeleted} questionnaire template(s) deleted</li>
              <li>{result.usersDeleted} user(s) deleted</li>
              <li>{result.personalThreadsDeleted} personal thread(s) deleted</li>
              <li>{result.registrationsDeleted} registration(s) deleted</li>
            </ul>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
