import { adminDb } from "@/lib/firebase/admin";
import { generateAuditLogId } from "@/lib/ids";
import type { AuditActionType, AuditActorRole, AuditEntityType, AuditLogEntry } from "@/types/audit";

export interface LogAuditParams {
  actorId: string;
  actorEmail: string;
  actorRole: AuditActorRole;
  action: AuditActionType | string;
  entityType: AuditEntityType;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const AUDIT_COLLECTION = "audit_logs";

/**
 * Persists an immutable audit log entry into Firestore.
 * Server-side only via Firebase Admin SDK.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<string | null> {
  try {
    const logId = await generateAuditLogId();
    const timestamp = new Date().toISOString();

    const entry: AuditLogEntry = {
      logId,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousState: params.previousState || null,
      newState: params.newState || null,
      metadata: params.metadata || {},
      ipAddress: params.ipAddress || "unknown",
      userAgent: params.userAgent || "unknown",
      timestamp,
    };

    await adminDb.collection(AUDIT_COLLECTION).doc(logId).set(entry);
    return logId;
  } catch (error) {
    // Non-blocking error handling to ensure primary user operations complete
    console.error("❌ Failed to persist audit log entry:", error);
    return null;
  }
}
