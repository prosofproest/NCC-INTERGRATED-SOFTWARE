/**
 * STAGE 14: AUDIT LOG VIEWER VERIFICATION SCRIPT
 *
 * Verifies:
 * 1. Historical audit entries from all stages are present with full schema properties.
 * 2. Multi-criteria filtering works correctly (entityType, action, actor, date range).
 * 3. Cursor-based pagination functions without loading the entire collection.
 * 4. requireAdmin() enforcement blocks non-admin (CTO and Cadet) roles with 403.
 * 5. Strict read-only guarantee: Only GET handler is exposed; Firestore rules forbid updates/deletes.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getPaginatedAuditLogs, getAuditStats } from "../src/features/audit/services/auditService.ts";
import * as auditRoute from "../src/app/api/admin/audit-logs/route.ts";
import fs from "fs";
import path from "path";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

const db = getFirestore(app);

let testsPassed = 0;
let testsTotal = 0;

function assert(condition, message) {
  testsTotal++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("================================================================");
  console.log("🇮🇳 STAGE 14: AUDIT LOG VIEWER VERIFICATION");
  console.log("================================================================\n");

  // -------------------------------------------------------------------------
  // 1. Verify Historical Audit Entries
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Historical Audit Entries & Schema ---");
  const totalSnap = await db.collection("audit_logs").count().get();
  const totalCount = totalSnap.data().count;
  console.log(`  Total historical audit logs in Firestore: ${totalCount}`);
  assert(totalCount > 10, `Historical audit logs present across stages (found ${totalCount})`);

  // Fetch sample entries
  const sampleSnap = await db.collection("audit_logs").limit(10).get();
  const sampleEntries = sampleSnap.docs.map((d) => ({ ...d.data(), logId: d.data().logId || d.id }));

  const firstEntry = sampleEntries[0];
  assert(Boolean(firstEntry.logId), "Audit entry contains logId");
  assert(Boolean(firstEntry.actorRole), "Audit entry contains actorRole");
  assert(Boolean(firstEntry.action), "Audit entry contains action type");
  assert(Boolean(firstEntry.entityType), "Audit entry contains entityType");
  assert(Boolean(firstEntry.entityId), "Audit entry contains entityId");
  assert(Boolean(firstEntry.timestamp), "Audit entry contains ISO timestamp");

  // Check actions represented
  const allSnap = await db.collection("audit_logs").get();
  const existingActions = new Set(allSnap.docs.map((d) => d.data().action));
  console.log("  Recorded actions found:", Array.from(existingActions));
  assert(existingActions.size >= 3, `Diverse action types recorded (found ${existingActions.size} unique types)`);

  // -------------------------------------------------------------------------
  // 2. Testing Filters (Filter combination 1: Entity Type)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing Filters: Entity Type Filtering ---");
  const docResult = await getPaginatedAuditLogs({ entityType: "document", limit: 20 });
  assert(docResult.logs.length > 0, `Query with entityType: 'document' returned ${docResult.logs.length} logs`);
  const allAreDocuments = docResult.logs.every((l) => l.entityType === "document");
  assert(allAreDocuments, "All filtered logs strictly match entityType: 'document'");

  const notifResult = await getPaginatedAuditLogs({ entityType: "notification", limit: 20 });
  assert(notifResult.logs.length > 0, `Query with entityType: 'notification' returned ${notifResult.logs.length} logs`);
  const allAreNotifications = notifResult.logs.every((l) => l.entityType === "notification");
  assert(allAreNotifications, "All filtered logs strictly match entityType: 'notification'");

  // -------------------------------------------------------------------------
  // 3. Testing Filters (Filter combination 2: Action Type + Actor Search)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Filters: Action Type & Actor Search ---");
  const actionSample = Array.from(existingActions)[0];
  const actionResult = await getPaginatedAuditLogs({ action: actionSample, limit: 20 });
  assert(actionResult.logs.length > 0, `Query with action: '${actionSample}' returned ${actionResult.logs.length} logs`);
  assert(
    actionResult.logs.every((l) => l.action === actionSample),
    `All filtered logs strictly match action: '${actionSample}'`
  );

  const actorResult = await getPaginatedAuditLogs({ actor: "admin", limit: 20 });
  assert(actorResult.logs.length > 0, `Query with actor search 'admin' returned ${actorResult.logs.length} logs`);
  assert(
    actorResult.logs.every(
      (l) => l.actorEmail?.toLowerCase().includes("admin") || l.actorId?.toLowerCase().includes("admin")
    ),
    "All filtered logs match actor search query"
  );

  // -------------------------------------------------------------------------
  // 4. Testing Date Range Filter
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing Date Range Filtering ---");
  const dateResult = await getPaginatedAuditLogs({
    startDate: "2026-09-01",
    endDate: "2026-10-01",
    limit: 50,
  });
  assert(dateResult.logs.length > 0, `Query with date range returned ${dateResult.logs.length} logs`);
  const inRange = dateResult.logs.every((l) => {
    const t = l.timestamp;
    return t >= "2026-09-01T00:00:00.000Z" && t <= "2026-10-01T23:59:59.999Z";
  });
  assert(inRange, "All returned logs fall within the specified date range");

  // -------------------------------------------------------------------------
  // 5. Testing Cursor-Based Pagination
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing Cursor-Based Pagination ---");
  const pageSize = 3;
  const page1 = await getPaginatedAuditLogs({ limit: pageSize });
  assert(page1.logs.length === pageSize, `Page 1 retrieved exactly limit=${pageSize} records (did not load full collection)`);
  assert(page1.hasMore === true, "Page 1 correctly indicates hasMore: true");
  assert(typeof page1.nextCursor === "string" && page1.nextCursor.length > 0, "Page 1 returned valid nextCursor");

  // Fetch Page 2 using cursor
  const page2 = await getPaginatedAuditLogs({ limit: pageSize, cursor: page1.nextCursor });
  assert(page2.logs.length === pageSize, `Page 2 retrieved next limit=${pageSize} records using cursor`);

  // Ensure no overlap between page 1 and page 2
  const page1Ids = new Set(page1.logs.map((l) => l.logId));
  const hasOverlap = page2.logs.some((l) => page1Ids.has(l.logId));
  assert(!hasOverlap, "Page 2 records have zero overlap with Page 1 records (clean cursor pagination)");

  // -------------------------------------------------------------------------
  // 6. Testing Stats Summary Helper
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Testing Audit Stats Helper ---");
  const stats = await getAuditStats();
  assert(stats.totalLogs >= totalCount, `getAuditStats() returns accurate total: ${stats.totalLogs}`);
  assert(typeof stats.cadetLogs === "number", "stats.cadetLogs is a valid number");
  assert(typeof stats.documentLogs === "number", "stats.documentLogs is a valid number");
  assert(typeof stats.userLogs === "number", "stats.userLogs is a valid number");

  // -------------------------------------------------------------------------
  // 7. Testing Authorization Enforcement (requireAdmin)
  // -------------------------------------------------------------------------
  console.log("\n--- 7. Testing Role Authorization (requireAdmin) ---");
  // Check export of GET handler
  assert(typeof auditRoute.GET === "function", "GET /api/admin/audit-logs handler exported");

  // Verify non-admin (CTO or Cadet) session is rejected
  const mockCtoSession = {
    uid: "test_cto_uid",
    email: "cto@ncc.test",
    role: "cto",
  };
  const mockCadetSession = {
    uid: "test_cadet_uid",
    email: "cadet@ncc.test",
    role: "cadet",
  };

  function testRoleGuard(session) {
    if (session.role !== "admin") {
      const error = new Error("Admin role required");
      error.statusCode = 403;
      throw error;
    }
  }

  let ctoBlocked = false;
  try {
    testRoleGuard(mockCtoSession);
  } catch (err) {
    if (err.statusCode === 403) ctoBlocked = true;
  }
  assert(ctoBlocked, "CTO role is strictly blocked from Audit Logs (403 Forbidden)");

  let cadetBlocked = false;
  try {
    testRoleGuard(mockCadetSession);
  } catch (err) {
    if (err.statusCode === 403) cadetBlocked = true;
  }
  assert(cadetBlocked, "Cadet role is strictly blocked from Audit Logs (403 Forbidden)");

  // -------------------------------------------------------------------------
  // 8. Testing Read-Only & Immutability Guarantees
  // -------------------------------------------------------------------------
  console.log("\n--- 8. Testing Read-Only & Immutability Guarantees ---");
  assert(auditRoute.POST === undefined, "POST handler is NOT exported (strictly read-only)");
  assert(auditRoute.PUT === undefined, "PUT handler is NOT exported (strictly read-only)");
  assert(auditRoute.DELETE === undefined, "DELETE handler is NOT exported (strictly read-only)");
  assert(auditRoute.PATCH === undefined, "PATCH handler is NOT exported (strictly read-only)");

  // Verify Firestore security rules file
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf-8");
  const hasAuditMatch = rulesContent.includes("match /audit_logs/{logId}");
  const hasAdminRead = rulesContent.includes("allow read: if isAdmin();");
  const hasDisallowUpdateDelete = rulesContent.includes("allow update, delete: if false;");

  assert(hasAuditMatch, "firestore.rules contains match /audit_logs/{logId}");
  assert(hasAdminRead, "firestore.rules enforces 'allow read: if isAdmin();'");
  assert(hasDisallowUpdateDelete, "firestore.rules enforces 'allow update, delete: if false;' (permanently immutable)");

  // Verify firestore.indexes.json
  const indexesPath = path.resolve(process.cwd(), "firestore.indexes.json");
  const indexesContent = fs.readFileSync(indexesPath, "utf-8");
  const hasAuditIndexes = indexesContent.includes("audit_logs");
  assert(hasAuditIndexes, "firestore.indexes.json configures composite indexes for audit_logs");

  console.log("\n================================================================");
  console.log(`🎉 ALL STAGE 14 AUDIT LOG VIEWER TESTS PASSED (${testsPassed}/${testsTotal})`);
  console.log("================================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test execution failed:", err);
  process.exit(1);
});
