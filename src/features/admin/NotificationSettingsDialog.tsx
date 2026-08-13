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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { getNotificationCcEmails, saveNotificationCcEmails } from './notification-settings-api'

function parseEmails(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,]/)
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  )
}

export function NotificationSettingsDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [ccText, setCcText] = useState('')

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    setIsLoading(true)
    try {
      const ccEmails = await getNotificationCcEmails()
      setCcText(ccEmails.join('\n'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load settings.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveNotificationCcEmails(parseEmails(ccText))
      toast.success('Notification settings saved.')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Email Settings</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Email notification settings</DialogTitle>
          <DialogDescription>
            These addresses are CC'd on every registration email (accepted, rejected, confirmed,
            payment rejected) across all tour packages.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ccEmails">CC addresses</Label>
          <Textarea
            id="ccEmails"
            placeholder="ops@arsdreamph.com, staff2@arsdreamph.com"
            value={ccText}
            onChange={(e) => setCcText(e.target.value)}
            disabled={isLoading || isSaving}
            rows={5}
          />
          <p className="text-muted-foreground text-xs">One per line, or comma-separated. Leave blank for none.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
