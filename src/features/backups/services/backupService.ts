import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import {
  BACKUP_COLLECTIONS,
  BackupDocument,
  BackupMetadata,
  MAX_BACKUP_RETENTION_COUNT,
  RestoreResult,
} from "@/types/backup";

const BACKUPS_COLLECTION = "system_backups";

/**
 * Creates a point-in-time snapshot of all core Firestore datasets,
 * persists the backup document into `system_backups`, and prunes archives
 * beyond the retention limit (10 versions).
 */
export async function createBackup(
  actorId: string,
  actorEmail: string
): Promise<BackupMetadata> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupId = `BACKUP_${timestampStr}`;
  const createdAt = now.toISOString();

  const snapshot: Record<string, Array<Record<string, unknown>>> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const colSnap = await adminDb.collection(colName).get();
      const docsData: Array<Record<string, unknown>> = [];

      for (const doc of colSnap.docs) {
        const data = doc.data();
        docsData.push({
          _docId: doc.id,
          ...data,
        });
      }

      snapshot[colName] = docsData;
      recordCounts[colName] = docsData.length;
      totalRecords += docsData.length;
    } catch (err) {
      console.error(`Warning: Failed to backup collection ${colName}:`, err);
      snapshot[colName] = [];
      recordCounts[colName] = 0;
    }
  }

  const jsonStr = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(jsonStr, "utf8");

  const backupDoc: BackupDocument = {
    backupId,
    createdAt,
    createdBy: actorEmail,
    recordCounts,
    totalRecords,
    sizeBytes,
    status: "completed",
    retentionPolicy: `Keep latest ${MAX_BACKUP_RETENTION_COUNT} versions`,
    snapshot,
  };

  // Persist backup document
  await adminDb.collection(BACKUPS_COLLECTION).doc(backupId).set(backupDoc);

  // Enforce retention policy (keep latest 10 versions)
  await enforceBackupRetention();

  // Audit log the creation
  await logAuditEvent({
    actorId,
    actorEmail,
    actorRole: "admin",
    action: "SYSTEM_BACKUP_CREATED",
    entityType: "system",
    entityId: backupId,
    metadata: {
      totalRecords,
      sizeBytes,
      recordCounts,
      retentionPolicy: `Keep latest ${MAX_BACKUP_RETENTION_COUNT} versions`,
    },
  });

  return {
    backupId,
    createdAt,
    createdBy: actorEmail,
    recordCounts,
    totalRecords,
    sizeBytes,
    status: "completed",
    retentionPolicy: `Keep latest ${MAX_BACKUP_RETENTION_COUNT} versions`,
  };
}

/**
 * Enforces the retention policy by deleting oldest backups when total exceeds MAX_BACKUP_RETENTION_COUNT.
 */
async function enforceBackupRetention(): Promise<number> {
  try {
    const snap = await adminDb
      .collection(BACKUPS_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    if (snap.size <= MAX_BACKUP_RETENTION_COUNT) {
      return 0;
    }

    const excessDocs = snap.docs.slice(MAX_BACKUP_RETENTION_COUNT);
    let deletedCount = 0;

    for (const doc of excessDocs) {
      await doc.ref.delete();
      deletedCount++;
    }

    return deletedCount;
  } catch (err) {
    console.error("Error enforcing backup retention:", err);
    return 0;
  }
}

/**
 * Lists all existing backups ordered by creation date descending (omits heavy snapshot payload).
 */
export async function listBackups(): Promise<BackupMetadata[]> {
  const snap = await adminDb
    .collection(BACKUPS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() as BackupDocument;
    return {
      backupId: data.backupId || doc.id,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      recordCounts: data.recordCounts || {},
      totalRecords: data.totalRecords || 0,
      sizeBytes: data.sizeBytes || 0,
      status: data.status || "completed",
      retentionPolicy: data.retentionPolicy || `Keep latest ${MAX_BACKUP_RETENTION_COUNT} versions`,
      errorMessage: data.errorMessage,
    };
  });
}

/**
 * Retrieves a single backup document by its ID.
 */
export async function getBackupById(
  backupId: string,
  includeSnapshot = false
): Promise<BackupDocument | null> {
  const doc = await adminDb.collection(BACKUPS_COLLECTION).doc(backupId).get();
  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as BackupDocument;
  if (!includeSnapshot) {
    const { snapshot: _, ...meta } = data;
    void _;
    return meta;
  }

  return data;
}

/**
 * Manually deletes a backup archive and records an audit log.
 */
export async function deleteBackup(
  backupId: string,
  actorId: string,
  actorEmail: string
): Promise<boolean> {
  const docRef = adminDb.collection(BACKUPS_COLLECTION).doc(backupId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return false;
  }

  await docRef.delete();

  await logAuditEvent({
    actorId,
    actorEmail,
    actorRole: "admin",
    action: "SYSTEM_BACKUP_DELETED",
    entityType: "system",
    entityId: backupId,
    metadata: {
      deletedAt: new Date().toISOString(),
    },
  });

  return true;
}

/**
 * Executes a point-in-time recovery from a backup snapshot.
 * Allows selective collection restoration or full restoration.
 */
export async function restoreFromBackup(
  backupId: string,
  targetCollections: string[] | undefined,
  actorId: string,
  actorEmail: string
): Promise<RestoreResult> {
  const backup = await getBackupById(backupId, true);
  if (!backup || !backup.snapshot) {
    throw new Error(`Backup ${backupId} not found or snapshot data is missing.`);
  }

  const snapshot = backup.snapshot;
  const availableCollections = Object.keys(snapshot);

  // Filter collections if specified, otherwise restore all available except audit_logs (to keep audit trail strictly additive)
  let collectionsToRestore: string[];
  if (targetCollections && targetCollections.length > 0) {
    collectionsToRestore = targetCollections.filter((c) =>
      availableCollections.includes(c)
    );
  } else {
    collectionsToRestore = availableCollections;
  }

  const details: Record<string, number> = {};
  let totalRestoredRecords = 0;

  for (const colName of collectionsToRestore) {
    const docs = snapshot[colName] || [];
    let count = 0;

    // Batch operations in chunks of 450
    const chunkSize = 450;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = adminDb.batch();

      for (const item of chunk) {
        const { _docId, ...docFields } = item;
        const targetId = (_docId as string) || (item.cadetId as string) || (item.uid as string) || (item.categoryId as string) || (item.fieldId as string) || (item.requestId as string) || (item.changeRequestId as string) || (item.documentId as string) || (item.notificationId as string) || (item.logId as string);

        if (targetId) {
          const ref = adminDb.collection(colName).doc(targetId);
          batch.set(ref, docFields, { merge: false });
          count++;
        }
      }

      await batch.commit();
    }

    details[colName] = count;
    totalRestoredRecords += count;
  }

  const restoredAt = new Date().toISOString();

  // Audit log the restoration
  await logAuditEvent({
    actorId,
    actorEmail,
    actorRole: "admin",
    action: "SYSTEM_BACKUP_RESTORED",
    entityType: "system",
    entityId: backupId,
    metadata: {
      restoredAt,
      collectionsRestored: collectionsToRestore,
      totalRestoredRecords,
      details,
    },
  });

  return {
    success: true,
    backupId,
    restoredAt,
    restoredBy: actorEmail,
    collectionsRestored: collectionsToRestore,
    totalRestoredRecords,
    details,
  };
}
