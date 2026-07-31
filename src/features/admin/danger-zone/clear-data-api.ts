import { httpsCallable } from 'firebase/functions'

import { functions } from '@/firebase/config'

export interface ClearOperationalDataResult {
  usersDeleted: number
  marathonsDeleted: number
  registrationsDeleted: number
  announcementsDeleted: number
  questionnaireTemplatesDeleted: number
  personalThreadsDeleted: number
}

const clearOperationalDataCallable = httpsCallable<undefined, ClearOperationalDataResult>(
  functions,
  'clearOperationalData',
)

/**
 * Resets the app between registration seasons — see clearOperationalData in
 * functions/src for exactly what is and isn't touched. groupMessages is
 * never cleared by this; everything else that survives (kept registrations,
 * for a marathon/user this run didn't clear) is left completely untouched.
 */
export async function clearOperationalData(): Promise<ClearOperationalDataResult> {
  const result = await clearOperationalDataCallable()
  return result.data
}
