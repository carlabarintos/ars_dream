import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { create } from 'zustand'

import { app, db } from './config'

export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported'

/** This device's state; null until checked and after sign-out. */
export const usePushStatus = create<{ status: PushStatus | null }>(() => ({ status: null }))
const setStatus = (status: PushStatus | null) => usePushStatus.setState({ status })

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
 * Runs on every profile snapshot, so it only acts once per account. Never asks for permission
 * itself: Safari (Mac, iPhone) ignores that outside a click, hence NotificationPrompt's button.
 */
export async function registerPushNotifications(uid: string) {
  if (setUpFor === uid) return
  setUpFor = uid
  if (!(await isSupported()) || !import.meta.env.VITE_FIREBASE_VAPID_KEY) return setStatus('unsupported')
  if (Notification.permission === 'denied') return setStatus('blocked')
  if (Notification.permission === 'default') return setStatus('off')
  try {
    await subscribe(uid)
    setStatus('on')
  } catch (error) {
    console.error('Push subscribe failed', error)
    setStatus('off')
  }
}

/** Must run straight from a click: Safari ignores the permission request otherwise. */
export async function enablePushNotifications(uid: string) {
  const permission = await Notification.requestPermission()
  if (permission === 'denied') setStatus('blocked')
  if (permission !== 'granted') return
  try {
    await subscribe(uid)
    setStatus('on')
    toast.success('Notifications are on for this device.')
  } catch (error) {
    console.error('Push subscribe failed', error)
    setStatus('off')
    toast.error("Couldn't turn on notifications on this device. Please try again.")
  }
}

/** Call while still signed in: a shared device must stop getting the previous account's notifications. */
export async function unregisterPushNotifications(uid: string) {
  stopForegroundToasts?.()
  setUpFor = null
  setStatus(null)
  if (currentToken) {
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(currentToken) }).catch(() => {})
    currentToken = null
  }
}
