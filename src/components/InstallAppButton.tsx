import { useState } from 'react'
import { DownloadIcon, Share2Icon, SquarePlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInstallPromptStore } from '@/lib/install-prompt-store'

const userAgent = window.navigator.userAgent
const isIOS = /iphone|ipad|ipod/i.test(userAgent)
const isIOSSafari = isIOS && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent)

export function InstallAppButton() {
  const deferredEvent = useInstallPromptStore((state) => state.deferredEvent)
  const isInstalled = useInstallPromptStore((state) => state.isInstalled)
  const setDeferredEvent = useInstallPromptStore((state) => state.setDeferredEvent)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  if (isInstalled || (!deferredEvent && !isIOS)) return null

  async function handleClick() {
    if (deferredEvent) {
      await deferredEvent.prompt()
      await deferredEvent.userChoice
      setDeferredEvent(null)
      return
    }
    setShowIOSHelp(true)
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Install app">
        <DownloadIcon />
      </Button>

      <Dialog open={showIOSHelp} onOpenChange={setShowIOSHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install ARS Dream</DialogTitle>
            <DialogDescription>
              {isIOSSafari
                ? 'Add ARS Dream to your Home Screen for quick, app-like access.'
                : 'Open this page in Safari to install it, then follow these steps.'}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full font-medium">
                1
              </span>
              <span className="flex items-center gap-1.5">
                Tap the Share icon <Share2Icon className="size-4" /> in Safari's toolbar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full font-medium">
                2
              </span>
              <span className="flex items-center gap-1.5">
                Select "Add to Home Screen" <SquarePlusIcon className="size-4" />
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full font-medium">
                3
              </span>
              <span>Tap "Add" to confirm</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
