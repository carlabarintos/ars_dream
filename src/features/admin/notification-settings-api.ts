import { doc, getDoc, setDoc } from 'firebase/firestore'

import { db } from '@/firebase/config'

const SETTINGS_DOC = doc(db, 'settings', 'notifications')

/** Global CC list applied to every registration status-change email, regardless of tour package. */
export async function getNotificationCcEmails(): Promise<string[]> {
  const snapshot = await getDoc(SETTINGS_DOC)
  return snapshot.data()?.ccEmails ?? []
}

export async function saveNotificationCcEmails(ccEmails: string[]): Promise<void> {
  await setDoc(SETTINGS_DOC, { ccEmails }, { merge: true })
}
