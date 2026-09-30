export interface BackupMetadata {
  backupId: string;
  createdAt: string;
  createdBy: string;
  recordCounts: Record<string, number>;
  totalRecords: number;
  sizeBytes: number;
  status: "completed" | "failed";
  retentionPolicy: string;
  errorMessage?: string;
}

export interface BackupDocument extends BackupMetadata {
  snapshot?: Record<string, Array<Record<string, unknown>>>;
}

export interface RestoreRequest {
  confirmation: "RESTORE";
  collections?: string[];
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  restoredAt: string;
  restoredBy: string;
  collectionsRestored: string[];
  totalRestoredRecords: number;
  details: Record<string, number>;
}

export const BACKUP_COLLECTIONS = [
  "cadets",
  "categories",
  "fields",
  "data_requests",
  "change_requests",
  "documents",
  "users",
  "notifications",
  "system_counters",
  "audit_logs",
] as const;

export type BackupCollectionName = (typeof BACKUP_COLLECTIONS)[number];

export const MAX_BACKUP_RETENTION_COUNT = 10;
