import { collection, doc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore'

import { db } from '@/firebase/config'
import type { UserProfile } from '@/types'
import { userRestorePatchToUpdateDoc, type UserRestorePatch } from '@/features/admin/export-import/serialize'

export function subscribeToUserProfile(uid: string, onData: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    onData(snapshot.exists() ? (snapshot.data() as UserProfile) : null)
  })
}

/** Admin-only: the users collection's security rule doesn't depend on any document's data (only on the requester's own admin status), so unlike marathons/registrations this collection can be queried broadly rather than by known ids. */
export function subscribeToAllUsers(onData: (profiles: UserProfile[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    onData(snapshot.docs.map((d) => d.data() as UserProfile))
  })
}

/** One-shot read of every user profile, for admin data export. */
export async function getAllUsersOnce(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

/**
 * Restore-from-backup only: updates fields on an *existing* user doc, matched by
 * uid. Never recreates a missing user doc (no client path to create a Firebase
 * Auth account) — the caller is responsible for checking the doc exists first
 * and reporting a skip otherwise. fcmTokens is never part of the patch — device
 * push tokens regenerate on next sign-in and have no restore value.
 */
export async function restoreUserProfileFields(uid: string, patch: UserRestorePatch) {
  await updateDoc(doc(db, 'users', uid), userRestorePatchToUpdateDoc(patch))
}
