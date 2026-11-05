import { useState } from 'react'
import { BellRingIcon, XIcon } from 'lucide-react'

import { InstallAppButton } from '@/components/InstallAppButton'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth-store'
import { enablePushNotifications, usePushStatus } from '@/firebase/messaging'
import { isIOS, useInstallPromptStore } from '@/lib/install-prompt-store'

const DISMISSED_KEY = 'notification-prompt-dismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Stays up until acted on or dismissed; the bell menu still offers the same action afterwards. */
export function NotificationPrompt() {
  const uid = useAuthStore((state) => state.firebaseUser?.uid)
  const status = usePushStatus((state) => state.status)
  const isInstalled = useInstallPromptStore((state) => state.isInstalled)
  const [dismissed, setDismissed] = useState(wasDismissed)

  // iPhones and iPads only support web push once the app is on the Home Screen.
  const needsInstall = status === 'unsupported' && isIOS && !isInstalled
  if (!uid || dismissed || (status !== 'off' && !needsInstall)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Private mode: it just comes back next visit.
    }
  }

  return (
    <div className="border-border bg-primary/10 border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <BellRingIcon className="text-primary size-5 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          {needsInstall
            ? 'Add ARS Dream to your Home Screen to get booking and message alerts.'
            : 'Get booking and message alerts on this device.'}
        </p>
        {needsInstall ? (
          <InstallAppButton label="Show me how" />
        ) : (
          <Button size="sm" onClick={() => void enablePushNotifications(uid)}>
            Turn on
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8" onClick={dismiss} aria-label="Dismiss">
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
