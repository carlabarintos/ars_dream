import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

import { auth, db } from '@/firebase/config'
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

/**
 * Sends the standard Firebase "reset your password" email. Only meaningful for
 * email/password accounts (Google sign-in users have no password to reset),
 * and works without any elevated privileges — used both by the sign-in page's
 * forgot-password flow and by an admin resetting another user's password.
 *
 * `url` becomes the `continueUrl` query param on whatever page the reset link
 * lands on. In production, once Firebase Console → Authentication → Templates
 * → Password reset → action URL is pointed at ResetPasswordPage.tsx's route
 * (see CLAUDE.md), that page handles the reset itself and ignores this param;
 * it only matters as a "back to the app" link on Firebase's default hosted
 * page for any environment where the custom action URL isn't configured yet
 * (e.g. the local emulator, which always uses its own built-in action page).
 */
export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/sign-in` })
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signOutUser() {
  await signOut(auth)
}
