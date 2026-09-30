export type AuditActorRole = "admin" | "cto" | "cadet" | "system";

export type AuditEntityType =
  | "cadet"
  | "field"
  | "category"
  | "document"
  | "data_request"
  | "change_request"
  | "notification"
  | "user"
  | "system";

export type AuditActionType =
  | "CADET_CREATED"
  | "CADET_UPDATED"
  | "CADET_STATUS_CHANGED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "FIELD_CREATED"
  | "FIELD_UPDATED"
  | "FIELD_DEACTIVATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERIFIED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_ARCHIVED"
  | "DATA_REQUEST_CREATED"
  | "DATA_REQUEST_UPDATED"
  | "DATA_REQUEST_RESPONDED"
  | "CHANGE_REQUEST_SUBMITTED"
  | "CHANGE_REQUEST_APPROVED"
  | "CHANGE_REQUEST_REJECTED"
  | "DATA_EXPORTED"
  | "BATCH_CADETS_IMPORTED"
  | "ADMIN_CLAIM_ASSIGNED"
  | "USER_PASSWORD_RESET"
  | "NOTIFICATION_SENT"
  | "BROADCAST_NOTIFICATION_SENT"
  | "CTO_ACCOUNT_CREATED"
  | "CTO_ACCOUNT_DEACTIVATED"
  | "CTO_ACCOUNT_REACTIVATED"
  | "SYSTEM_SECURITY_INITIALIZED"
  | "SYSTEM_HEALTH_CHECK_FAILED"
  | "SYSTEM_HEALTH_RECOVERED"
  | "SYSTEM_BACKUP_CREATED"
  | "SYSTEM_BACKUP_RESTORED"
  | "SYSTEM_BACKUP_DELETED";

export const ALL_ENTITY_TYPES: AuditEntityType[] = [
  "cadet",
  "field",
  "category",
  "document",
  "data_request",
  "change_request",
  "notification",
  "user",
  "system",
];

export const COMMON_ACTION_TYPES: AuditActionType[] = [
  "CADET_CREATED",
  "CADET_UPDATED",
  "CADET_STATUS_CHANGED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "FIELD_CREATED",
  "FIELD_UPDATED",
  "FIELD_DEACTIVATED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "DOCUMENT_REJECTED",
  "DATA_REQUEST_CREATED",
  "DATA_REQUEST_RESPONDED",
  "CHANGE_REQUEST_SUBMITTED",
  "CHANGE_REQUEST_APPROVED",
  "CHANGE_REQUEST_REJECTED",
  "DATA_EXPORTED",
  "BATCH_CADETS_IMPORTED",
  "NOTIFICATION_SENT",
  "BROADCAST_NOTIFICATION_SENT",
  "CTO_ACCOUNT_CREATED",
  "CTO_ACCOUNT_DEACTIVATED",
  "CTO_ACCOUNT_REACTIVATED",
  "SYSTEM_SECURITY_INITIALIZED",
];

export interface AuditLogEntry {
  logId: string; // Permanent ID, e.g. LOG_0000001
  actorId: string; // Firebase Auth UID or "system"
  actorEmail: string;
  actorRole: AuditActorRole;
  action: AuditActionType | string;
  entityType: AuditEntityType;
  entityId: string; // Primary ID of affected resource
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string; // ISO 8601
}

export interface AuditLogQueryParams {
  limit?: number;
  cursor?: string; // document logId
  actor?: string; // email or UID search
  actorRole?: AuditActorRole | "all";
  action?: string | "all";
  entityType?: AuditEntityType | "all";
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface PaginatedAuditLogsResponse {
  logs: AuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  totalEstimate?: number;
}
