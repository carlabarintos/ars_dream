import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function getIsStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

interface InstallPromptState {
  deferredEvent: BeforeInstallPromptEvent | null
  isInstalled: boolean
  setDeferredEvent: (event: BeforeInstallPromptEvent | null) => void
  setInstalled: (installed: boolean) => void
}

export const useInstallPromptStore = create<InstallPromptState>((set) => ({
  deferredEvent: null,
  isInstalled: getIsStandalone(),
  setDeferredEvent: (deferredEvent) => set({ deferredEvent }),
  setInstalled: (isInstalled) => set({ isInstalled }),
}))

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  useInstallPromptStore.getState().setDeferredEvent(event as BeforeInstallPromptEvent)
})

window.addEventListener('appinstalled', () => {
  useInstallPromptStore.getState().setDeferredEvent(null)
  useInstallPromptStore.getState().setInstalled(true)
})
