import { db } from './admin.js'

// Kept in sync by hand with src/types/index.ts's AuditAction — functions/ is a
// separate package and can't import from src/.
export type AuditAction =
  | 'registration_accepted'
  | 'registration_rejected'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'marathon_reopened'
  | 'operational_data_cleared'

export type AuditTargetType = 'registration' | 'marathon' | 'user' | 'system'

interface LogAuditEntryInput {
  actorId: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  targetLabel?: string
  metadata?: Record<string, string | number>
}

/**
 * Best-effort — a logging failure must never roll back or block the admin action
 * it's recording, so every call site fires this after its own write has already
 * succeeded, and errors here are only logged, never thrown.
 */
export async function logAuditEntry(input: LogAuditEntryInput) {
  try {
    const actorSnap = await db.collection('users').doc(input.actorId).get()
    const actor = actorSnap.data()
    await db.collection('auditLogs').add({
      actorId: input.actorId,
      actorName: (actor?.displayName as string | undefined) ?? null,
      actorEmail: (actor?.email as string | undefined) ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('Failed to write audit log entry', error)
  }
}
