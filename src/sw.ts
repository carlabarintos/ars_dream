/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope

// registerType 'autoUpdate' with injectManifest needs these, or a new deploy waits until every tab is closed.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// The SDK shows and handles clicks on every push that has a `notification` payload. Showing it here too would double it.
getMessaging(initializeApp(firebaseConfig))
