import { getAllUsersOnce } from '@/features/auth/api'
import { getAllMarathonsOnce } from '@/features/marathons/api'
import { getAllRegistrationsOnce } from '@/features/registrations/api'
import type { Registration, UserProfile } from '@/types'

import { downloadTextFile, toCsv } from './csv'
import {
  MARATHON_COLUMNS,
  QUEUE_ROW_COLUMNS,
  REGISTRATION_COLUMNS,
  USER_COLUMNS,
  marathonToRow,
  queueRowFromJoin,
  registrationToRow,
  userToRow,
} from './serialize'

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

/** Full-database backup: fetches all three collections once, serializes each to CSV, bundles them into a single .zip, and downloads it. Dynamically imports jszip so it never adds to the main app bundle. */
export async function exportFullDatabase() {
  const [marathons, registrations, users] = await Promise.all([
    getAllMarathonsOnce(),
    getAllRegistrationsOnce(),
    getAllUsersOnce(),
  ])

  const marathonsCsv = toCsv(marathons.map(marathonToRow), [...MARATHON_COLUMNS])
  const registrationsCsv = toCsv(registrations.map(registrationToRow), [...REGISTRATION_COLUMNS])
  const usersCsv = toCsv(users.map(userToRow), [...USER_COLUMNS])

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('marathons.csv', marathonsCsv)
  zip.file('registrations.csv', registrationsCsv)
  zip.file('users.csv', usersCsv)
  const blob = await zip.generateAsync({ type: 'blob' })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ars-dream-backup-${dateStamp()}.zip`
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Per-marathon queue export: builds a single CSV from registrations + registrant profiles already loaded on the Queue Review page — no new Firestore reads. */
export function exportQueueCsv(
  marathonId: string,
  registrations: Registration[],
  profiles: Record<string, UserProfile | undefined>,
) {
  const rows = registrations.map((registration) => queueRowFromJoin(registration, profiles[registration.userId]))
  const csv = toCsv(rows, [...QUEUE_ROW_COLUMNS])
  downloadTextFile(`queue-${marathonId}-${dateStamp()}.csv`, csv, 'text/csv')
}
