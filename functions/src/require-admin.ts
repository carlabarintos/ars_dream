import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

import { db } from './admin.js'

export async function requireAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.')
  }

  const userDoc = await db.collection('users').doc(uid).get()
  if (userDoc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }

  return uid
}
