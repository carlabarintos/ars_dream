import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { auth, db, functions } from '@/firebase/config'
import { unregisterPushNotifications } from '@/firebase/messaging'
import type { Gender, UserRole } from '@/types'

export interface SignUpProfileInput {
  firstName: string
  middleName?: string
  lastName: string
  contactNumber: string
  dateOfBirth: string
  gender: Gender
}

export async function signUpWithEmail(profile: SignUpProfileInput, email: string, password: string) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
  // Written directly here (rather than left for use-auth-listener.ts's fallback
  // creation) so the profile fields land atomically with sign-up instead of
  // depending on a separate, later Firestore listener event. merge:true so this
  // can safely race with that listener's own fallback write without either one
  // clobbering fields the other set.
  await setDoc(
    doc(db, 'users', credential.user.uid),
    {
      uid: credential.user.uid,
      displayName,
      email: credential.user.email,
      photoURL: credential.user.photoURL,
      role: 'user',
      fcmTokens: [],
      createdAt: serverTimestamp(),
      firstName: profile.firstName,
      middleName: profile.middleName ?? null,
      lastName: profile.lastName,
      contactNumber: profile.contactNumber,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
    },
    { merge: true },
  )
}

export async function updatePersonalInfo(uid: string, info: SignUpProfileInput) {
  const displayName = [info.firstName, info.lastName].filter(Boolean).join(' ')
  await updateDoc(doc(db, 'users', uid), {
    firstName: info.firstName,
    middleName: info.middleName || null,
    lastName: info.lastName,
    contactNumber: info.contactNumber,
    dateOfBirth: info.dateOfBirth,
    gender: info.gender,
    displayName,
  })
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName })
  }
}

/** Admin editing another user's profile — unlike updatePersonalInfo, never touches auth.currentUser, since that would rename the admin's own account instead of the target user's. */
export async function updateUserProfileAsAdmin(uid: string, info: SignUpProfileInput) {
  const displayName = [info.firstName, info.lastName].filter(Boolean).join(' ')
  await updateDoc(doc(db, 'users', uid), {
    firstName: info.firstName,
    middleName: info.middleName || null,
    lastName: info.lastName,
    contactNumber: info.contactNumber,
    dateOfBirth: info.dateOfBirth,
    gender: info.gender,
    displayName,
  })
}

/** Promotes/demotes a user. Firestore rules only let an existing admin update another user's `role`, so this will fail for non-admin callers. */
export async function updateUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, 'users', uid), { role })
}

const sendPasswordResetCallable = httpsCallable<{ email: string }, { ok: true }>(functions, 'sendPasswordReset')

/**
 * Emails a "reset your password" link (functions/src/send-password-reset.ts), sent through Resend
 * because Firebase's own mailer wasn't reaching inboxes. Used by the sign-in page's forgot-password
 * flow and by an admin resetting another user's password. Silently succeeds for unknown emails.
 */
export async function requestPasswordReset(email: string) {
  await sendPasswordResetCallable({ email })
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signOutUser() {
  if (auth.currentUser) await unregisterPushNotifications(auth.currentUser.uid)
  await signOut(auth)
}
