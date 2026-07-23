import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { arrayUnion, doc, updateDoc } from 'firebase/firestore'

import { app, db } from './config'

export async function registerPushNotifications(uid: string) {
  if (!(await isSupported())) return
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const registration = await navigator.serviceWorker.ready
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (token) {
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
  }
}
