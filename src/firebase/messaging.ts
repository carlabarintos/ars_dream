import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'

import { app, db } from './config'

let setUpFor: string | null = null
let currentToken: string | null = null
let stopForegroundToasts: (() => void) | undefined

async function subscribe(uid: string) {
  const messaging = getMessaging(app)
  currentToken = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  })
  if (currentToken) {
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(currentToken) })
  }

  // The service worker hands pushes to the page instead of showing them while the app is on screen.
  stopForegroundToasts?.()
  stopForegroundToasts = onMessage(messaging, ({ notification, fcmOptions }) => {
    const link = fcmOptions?.link
    toast(notification?.title ?? 'ARS Dream', {
      description: notification?.body,
      action: link ? { label: 'Open', onClick: () => window.location.assign(link) } : undefined,
    })
  })
}

/**
 * Runs on every profile snapshot, so it only acts once per account. Safari (Mac, iPhone) ignores
 * Notification.requestPermission() outside a click, hence asking through the toast's button.
 */
export async function registerPushNotifications(uid: string) {
  if (setUpFor === uid) return
  setUpFor = uid
  if (!(await isSupported())) return
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return

  if (Notification.permission === 'granted') {
    await subscribe(uid)
  } else if (Notification.permission === 'default') {
    toast('Get notified about your bookings and messages on this device?', {
      duration: 15_000,
      action: {
        label: 'Turn on',
        onClick: () => {
          void Notification.requestPermission().then((permission) => {
            if (permission === 'granted') return subscribe(uid)
          })
        },
      },
    })
  }
}

/** Call while still signed in: a shared device must stop getting the previous account's notifications. */
export async function unregisterPushNotifications(uid: string) {
  stopForegroundToasts?.()
  setUpFor = null
  if (currentToken) {
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(currentToken) }).catch(() => {})
    currentToken = null
  }
}
