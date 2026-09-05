import type { DocumentReference } from 'firebase-admin/firestore'
import { onCall, type CallableRequest } from 'firebase-functions/v2/https'

import { auth, db, storage } from './admin.js'
import { logAuditEntry } from './audit-log.js'
import { requireAdmin } from './require-admin.js'

// The Functions emulator has no real App Check backend to attest against
// (the local demo- project isn't a real Firebase project), so enforcement
// is skipped only there; every deployed environment enforces it.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

const BATCH_LIMIT = 400
const AUTH_DELETE_LIMIT = 1000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function deleteDocsInBatches(refs: DocumentReference[]) {
  for (const group of chunk(refs, BATCH_LIMIT)) {
    const batch = db.batch()
    group.forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function deleteStoragePrefix(prefix: string) {
  await storage.bucket().deleteFiles({ prefix, force: true })
}

/**
 * Resets the app between registration seasons. Marathons, announcements, and
 * questionnaire templates are wiped wholesale (with their banner/package
 * images in Storage). Users are wiped except staff (admin/finance) — including
 * their Auth accounts, so a cleared account can't sign back in and get a fresh
 * profile doc silently recreated. Registrations and personal threads are only
 * removed when they belong to a cleared marathon or a cleared user, so
 * nothing keeps a reference to something that no longer exists; their
 * proof-of-payment images go with them. groupMessages is a running public
 * log and is never touched here.
 */
export const clearOperationalData = onCall({ enforceAppCheck, timeoutSeconds: 300 }, async (request: CallableRequest) => {
  const uid = await requireAdmin(request)

  const [usersSnap, marathonsSnap, registrationsSnap, announcementsSnap, templatesSnap, threadsSnap] =
    await Promise.all([
      db.collection('users').get(),
      db.collection('marathons').get(),
      db.collection('registrations').get(),
      db.collection('announcements').get(),
      db.collection('questionnaireTemplates').get(),
      db.collection('personalThreads').get(),
    ])

  // Staff accounts (admin and finance) are never wiped, only registrant accounts.
  const deleteUserIds = usersSnap.docs
    .filter((doc) => !['admin', 'finance'].includes(doc.data().role))
    .map((doc) => doc.id)
  const deleteUserIdSet = new Set(deleteUserIds)
  const marathonIdSet = new Set(marathonsSnap.docs.map((doc) => doc.id))

  const registrationsToDelete = registrationsSnap.docs.filter((doc) => {
    const data = doc.data()
    return marathonIdSet.has(data.marathonId) || deleteUserIdSet.has(data.userId)
  })
  const threadsToDelete = threadsSnap.docs.filter((doc) => deleteUserIdSet.has(doc.id))

  await deleteDocsInBatches(marathonsSnap.docs.map((d) => d.ref))
  await deleteDocsInBatches(announcementsSnap.docs.map((d) => d.ref))
  await deleteDocsInBatches(templatesSnap.docs.map((d) => d.ref))
  await deleteDocsInBatches(registrationsToDelete.map((d) => d.ref))
  await deleteDocsInBatches(deleteUserIds.map((uid) => db.collection('users').doc(uid)))

  // personalThreads/{userId}/messages is a subcollection — recursiveDelete
  // removes the thread doc and every message under it in one call.
  for (const threadDoc of threadsToDelete) {
    await db.recursiveDelete(threadDoc.ref)
  }

  // Every marathon/announcement is gone, so their whole Storage folders can
  // go wholesale; proof-of-payment is only cleared per deleted registration,
  // since a kept registration's receipt must survive.
  await Promise.all([
    deleteStoragePrefix('marathon-banners/'),
    deleteStoragePrefix('marathon-packages/'),
    deleteStoragePrefix('announcement-banners/'),
    ...registrationsToDelete.map((d) => deleteStoragePrefix(`proof-of-payment/${d.id}/`)),
  ])

  for (const group of chunk(deleteUserIds, AUTH_DELETE_LIMIT)) {
    await auth.deleteUsers(group)
  }

  // Logged last so it isn't itself deleted by this same wipe — auditLogs
  // isn't one of the collections cleared above, but writing after keeps the
  // ordering obviously safe if that ever changes.
  await logAuditEntry({
    actorId: uid,
    action: 'operational_data_cleared',
    targetType: 'system',
    targetId: 'operational-data',
    metadata: {
      usersDeleted: deleteUserIds.length,
      marathonsDeleted: marathonsSnap.size,
      registrationsDeleted: registrationsToDelete.length,
    },
  })

  return {
    usersDeleted: deleteUserIds.length,
    marathonsDeleted: marathonsSnap.size,
    registrationsDeleted: registrationsToDelete.length,
    announcementsDeleted: announcementsSnap.size,
    questionnaireTemplatesDeleted: templatesSnap.size,
    personalThreadsDeleted: threadsToDelete.length,
  }
})
