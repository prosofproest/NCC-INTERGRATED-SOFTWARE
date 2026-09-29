import { adminDb } from "@/lib/firebase/admin";
import {
  type AuditLogEntry,
  type AuditLogQueryParams,
  type PaginatedAuditLogsResponse,
  ALL_ENTITY_TYPES,
  COMMON_ACTION_TYPES,
} from "@/types/audit";

export { ALL_ENTITY_TYPES, COMMON_ACTION_TYPES };

const AUDIT_COLLECTION = "audit_logs";

/**
 * Server-side audit log query service.
 * Supports cursor-based pagination and flexible multi-criteria filtering.
 */
export async function getPaginatedAuditLogs(
  params: AuditLogQueryParams = {}
): Promise<PaginatedAuditLogsResponse> {
  const limit = Math.min(Math.max(params.limit || 25, 1), 100);
  const cursor = params.cursor?.trim() || null;
  const actorSearch = params.actor?.trim().toLowerCase() || null;
  const actorRole = params.actorRole && params.actorRole !== "all" ? params.actorRole : null;
  const action = params.action && params.action !== "all" ? params.action : null;
  const entityType = params.entityType && params.entityType !== "all" ? params.entityType : null;
  const startDate = params.startDate ? new Date(params.startDate + "T00:00:00.000Z").toISOString() : null;
  const endDate = params.endDate ? new Date(params.endDate + "T23:59:59.999Z").toISOString() : null;

  try {
    // Attempt indexed Firestore query first
    let query: FirebaseFirestore.Query = adminDb.collection(AUDIT_COLLECTION);

    if (entityType) {
      query = query.where("entityType", "==", entityType);
    }
    if (action) {
      query = query.where("action", "==", action);
    }
    if (actorRole) {
      query = query.where("actorRole", "==", actorRole);
    }
    if (startDate) {
      query = query.where("timestamp", ">=", startDate);
    }
    if (endDate) {
      query = query.where("timestamp", "<=", endDate);
    }

    query = query.orderBy("timestamp", "desc");

    if (cursor) {
      const cursorDoc = await adminDb.collection(AUDIT_COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Fetch limit + 1 to determine if next page exists
    const snapshot = await query.limit(limit + 1).get();
    let entries = snapshot.docs.map((doc) => {
      const data = doc.data() as AuditLogEntry;
      return {
        ...data,
        logId: data.logId || doc.id,
      };
    });

    // Apply partial text search for actor email / UID in memory if specified
    if (actorSearch) {
      entries = entries.filter(
        (e) =>
          (e.actorEmail && e.actorEmail.toLowerCase().includes(actorSearch)) ||
          (e.actorId && e.actorId.toLowerCase().includes(actorSearch))
      );
    }

    const hasMore = entries.length > limit;
    const pageEntries = entries.slice(0, limit);
    const nextCursor = hasMore && pageEntries.length > 0 ? pageEntries[pageEntries.length - 1].logId : null;

    return {
      logs: pageEntries,
      nextCursor,
      hasMore,
    };
  } catch (err: unknown) {
    const error = err as { message?: string; code?: number };
    // Graceful fallback if Firestore composite index is missing or building
    const isIndexError =
      error.message?.includes("index") ||
      error.message?.includes("FAILED_PRECONDITION") ||
      error.code === 9;

    if (isIndexError || actorSearch) {
      console.warn("Falling back to client-filtered query due to index or partial search:", error.message);
      return getFilteredAuditLogsFallback(params, limit, cursor);
    }

    console.error("Error executing audit query:", error);
    throw new Error(error.message || "Failed to retrieve audit log entries.");
  }
}

/**
 * Resilient fallback query when Firestore composite indexes are not yet fully active.
 * Fetches matching subset and performs in-memory sort and cursor slice.
 */
async function getFilteredAuditLogsFallback(
  params: AuditLogQueryParams,
  limit: number,
  cursor: string | null
): Promise<PaginatedAuditLogsResponse> {
  const actorSearch = params.actor?.trim().toLowerCase() || null;
  const actorRole = params.actorRole && params.actorRole !== "all" ? params.actorRole : null;
  const action = params.action && params.action !== "all" ? params.action : null;
  const entityType = params.entityType && params.entityType !== "all" ? params.entityType : null;
  const startDate = params.startDate ? new Date(params.startDate + "T00:00:00.000Z").toISOString() : null;
  const endDate = params.endDate ? new Date(params.endDate + "T23:59:59.999Z").toISOString() : null;

  let query: FirebaseFirestore.Query = adminDb.collection(AUDIT_COLLECTION);

  if (entityType) {
    query = query.where("entityType", "==", entityType);
  } else if (action) {
    query = query.where("action", "==", action);
  } else if (actorRole) {
    query = query.where("actorRole", "==", actorRole);
  }

  // Retrieve up to 300 entries for in-memory sorting & pagination
  const snapshot = await query.limit(300).get();
  let entries = snapshot.docs.map((doc) => {
    const data = doc.data() as AuditLogEntry;
    return {
      ...data,
      logId: data.logId || doc.id,
    };
  });

  // Apply filters in memory
  if (action && !entityType) {
    entries = entries.filter((e) => e.action === action);
  }
  if (actorRole) {
    entries = entries.filter((e) => e.actorRole === actorRole);
  }
  if (startDate) {
    entries = entries.filter((e) => e.timestamp >= startDate);
  }
  if (endDate) {
    entries = entries.filter((e) => e.timestamp <= endDate);
  }
  if (actorSearch) {
    entries = entries.filter(
      (e) =>
        (e.actorEmail && e.actorEmail.toLowerCase().includes(actorSearch)) ||
        (e.actorId && e.actorId.toLowerCase().includes(actorSearch))
    );
  }

  // Sort newest first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIdx = entries.findIndex((e) => e.logId === cursor);
    if (cursorIdx !== -1) {
      startIndex = cursorIdx + 1;
    }
  }

  const pageEntries = entries.slice(startIndex, startIndex + limit);
  const hasMore = entries.length > startIndex + limit;
  const nextCursor = hasMore && pageEntries.length > 0 ? pageEntries[pageEntries.length - 1].logId : null;

  return {
    logs: pageEntries,
    nextCursor,
    hasMore,
    totalEstimate: entries.length,
  };
}

/**
 * Returns overall statistics for Audit Log header metrics.
 */
export async function getAuditStats() {
  try {
    const [totalSnap, cadetSnap, docSnap, ctoSnap] = await Promise.all([
      adminDb.collection(AUDIT_COLLECTION).count().get(),
      adminDb.collection(AUDIT_COLLECTION).where("entityType", "==", "cadet").count().get(),
      adminDb.collection(AUDIT_COLLECTION).where("entityType", "==", "document").count().get(),
      adminDb.collection(AUDIT_COLLECTION).where("entityType", "==", "user").count().get(),
    ]);

    return {
      totalLogs: totalSnap.data().count,
      cadetLogs: cadetSnap.data().count,
      documentLogs: docSnap.data().count,
      userLogs: ctoSnap.data().count,
    };
  } catch (error) {
    console.error("Failed to fetch audit stats:", error);
    return {
      totalLogs: 0,
      cadetLogs: 0,
      documentLogs: 0,
      userLogs: 0,
    };
  }
}
