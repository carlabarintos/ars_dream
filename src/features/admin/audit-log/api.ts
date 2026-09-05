import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'

import { db } from '@/firebase/config'
import type { AuditAction, AuditLogEntry, AuditTargetType } from '@/types'

const auditLogsRef = collection(db, 'auditLogs')

export function subscribeToAuditLog(onData: (entries: AuditLogEntry[]) => void) {
  const q = query(auditLogsRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry))
  })
}

interface LogAdminActionInput {
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  targetLabel?: string
  metadata?: Record<string, string | number>
}

/**
 * Client-side counterpart to functions/src/audit-log.ts's logAuditEntry, for the
 * few admin actions (marathon publish/close, role changes) that are plain client
 * updateDoc calls rather than a Cloud Functions callable. Failures are swallowed
 * so a logging hiccup never blocks the action it's recording.
 */
export async function logAdminAction(input: LogAdminActionInput) {
  try {
    await addDoc(auditLogsRef, {
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      metadata: input.metadata ?? null,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to write audit log entry', error)
  }
}
