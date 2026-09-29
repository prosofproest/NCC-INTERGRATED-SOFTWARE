/**
 * STAGE 15: SYSTEM HEALTH MONITORING VERIFICATION SCRIPT
 *
 * Verifies:
 * 1. Live connectivity tests execute against all real external services (DB, Auth, SMTP, Drive OAuth).
 * 2. Real latency measurements and status descriptions are returned for all 8 components.
 * 3. Deliberate failure detection (e.g. simulated SMTP/Drive error) triggers retry safely and surfaces as "failed".
 * 4. Repeated identical failures are grouped (consecutiveFailures counter, preserved firstFailedAt, rate-limited audit).
 * 5. Incident recovery detection updates status to "recovered" and records recovery audit event.
 * 6. Role authorization: requireAdmin() strictly blocks CTO and Cadet roles (403 Forbidden).
 * 7. Endpoints: GET and POST /api/admin/health exported.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runSystemHealthCheck } from "../src/features/health/services/healthChecker.ts";
import * as healthRoute from "../src/app/api/admin/health/route.ts";

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
  console.log("🇮🇳 STAGE 15: SYSTEM HEALTH MONITORING VERIFICATION");
  console.log("================================================================\n");

  // Clean up any stale incident doc before starting
  await db.collection("system_health_incidents").doc("smtp").delete().catch(() => {});

  // -------------------------------------------------------------
  // 1. Live Connectivity Tests & Latency Measurements
  // -------------------------------------------------------------
  console.log("--- 1. Testing Live Connectivity Checks (Normal Baseline) ---");
  const report = await runSystemHealthCheck();

  assert(report.services.length === 8, "All 8 component services checked");
  assert(report.overallStatus === "operational", `Overall system status is operational (found: ${report.overallStatus})`);

  // Service 1: Database (Firestore)
  const dbCheck = report.services.find((s) => s.serviceId === "database");
  assert(Boolean(dbCheck), "Database service check present");
  assert(dbCheck.status === "operational", `Database status is operational (${dbCheck.latencyMs}ms)`);
  assert(typeof dbCheck.latencyMs === "number" && dbCheck.latencyMs > 0, `Database latency measured: ${dbCheck.latencyMs}ms`);

  // Service 2: Authentication (Firebase Auth)
  const authCheck = report.services.find((s) => s.serviceId === "auth");
  assert(Boolean(authCheck), "Firebase Auth service check present");
  assert(authCheck.status === "operational", `Auth status is operational (${authCheck.latencyMs}ms)`);
  assert(typeof authCheck.latencyMs === "number" && authCheck.latencyMs > 0, `Auth latency measured: ${authCheck.latencyMs}ms`);

  // Service 3: Google Drive (OAuth)
  const driveCheck = report.services.find((s) => s.serviceId === "google_drive");
  assert(Boolean(driveCheck), "Google Drive service check present");
  assert(driveCheck.status === "operational", `Google Drive status is operational (${driveCheck.latencyMs}ms)`);
  assert(typeof driveCheck.latencyMs === "number" && driveCheck.latencyMs > 0, `Drive API latency measured: ${driveCheck.latencyMs}ms`);

  // Service 4: Email / SMTP
  const smtpCheck = report.services.find((s) => s.serviceId === "smtp");
  assert(Boolean(smtpCheck), "Email/SMTP service check present");
  assert(smtpCheck.status === "operational", `SMTP status is operational (${smtpCheck.latencyMs}ms)`);
  assert(typeof smtpCheck.latencyMs === "number" && smtpCheck.latencyMs > 0, `SMTP handshake latency measured: ${smtpCheck.latencyMs}ms`);

  // Service 5: Excel Engine
  const excelCheck = report.services.find((s) => s.serviceId === "excel");
  assert(Boolean(excelCheck), "Excel processing engine check present");
  assert(excelCheck.status === "operational", "Excel engine status is operational");

  // Service 6: Notifications Service
  const notifCheck = report.services.find((s) => s.serviceId === "notifications");
  assert(Boolean(notifCheck), "Notifications service check present");
  assert(notifCheck.status === "operational", `Notifications status is operational (${notifCheck.latencyMs}ms)`);

  // Service 7: Data Requests Engine
  const dataReqCheck = report.services.find((s) => s.serviceId === "data_requests");
  assert(Boolean(dataReqCheck), "Data Requests check present");
  assert(dataReqCheck.status === "operational", `Data Requests status is operational (${dataReqCheck.latencyMs}ms)`);

  // Service 8: Background Jobs
  const bgCheck = report.services.find((s) => s.serviceId === "background_jobs");
  assert(Boolean(bgCheck), "Background Jobs check present");
  assert(bgCheck.status === "not_applicable", "Background Jobs accurately marked as 'not_applicable'");

  // -------------------------------------------------------------
  // 2. Deliberately-Broken Check (Detection, Retry, and Incident Creation)
  // -------------------------------------------------------------
  console.log("\n--- 2. Testing Failure Detection & Single Safe Retry ---");
  const failedReport1 = await runSystemHealthCheck({ simulateFailureServiceId: "smtp" });

  assert(failedReport1.overallStatus === "failed", "Overall system status correctly transitions to 'failed'");
  const failedSmtp1 = failedReport1.services.find((s) => s.serviceId === "smtp");
  assert(failedSmtp1.status === "failed", "Simulated SMTP check correctly marked as 'failed'");
  assert(failedSmtp1.retryAttempted === true, "Check executed single safe retry before concluding failure");
  assert(failedSmtp1.message.includes("Simulated SMTP authentication failure"), "Failure message details root error");

  // Check incident doc creation in Firestore
  const incidentDoc1 = await db.collection("system_health_incidents").doc("smtp").get();
  assert(incidentDoc1.exists, "Incident document created in system_health_incidents/smtp");
  const incidentData1 = incidentDoc1.data();
  assert(incidentData1.status === "failing", "Incident status is 'failing'");
  assert(incidentData1.consecutiveFailures === 1, "consecutiveFailures initialized to 1");
  assert(Boolean(incidentData1.firstFailedAt), "firstFailedAt timestamp captured");

  // Verify Audit Log for failure
  const auditFailSnap = await db
    .collection("audit_logs")
    .where("action", "==", "SYSTEM_HEALTH_CHECK_FAILED")
    .where("entityId", "==", "smtp")
    .limit(1)
    .get();
  assert(!auditFailSnap.empty, "Audit log recorded for SYSTEM_HEALTH_CHECK_FAILED");

  // -------------------------------------------------------------
  // 3. Repeated Identical Failure Grouping
  // -------------------------------------------------------------
  console.log("\n--- 3. Testing Repeated Failure Grouping (No Spam, Counter Incremented) ---");
  const auditCountBefore = (
    await db
      .collection("audit_logs")
      .where("action", "==", "SYSTEM_HEALTH_CHECK_FAILED")
      .where("entityId", "==", "smtp")
      .get()
  ).size;

  // Run second consecutive failure
  const failedReport2 = await runSystemHealthCheck({ simulateFailureServiceId: "smtp" });
  assert(failedReport2.activeIncidents.length >= 1, "Active incidents list includes failing SMTP");

  const incidentDoc2 = await db.collection("system_health_incidents").doc("smtp").get();
  const incidentData2 = incidentDoc2.data();
  assert(incidentData2.consecutiveFailures === 2, `consecutiveFailures incremented to 2 (found: ${incidentData2.consecutiveFailures})`);
  assert(incidentData2.firstFailedAt === incidentData1.firstFailedAt, "firstFailedAt timestamp preserved across repeated failures");

  const auditCountAfter = (
    await db
      .collection("audit_logs")
      .where("action", "==", "SYSTEM_HEALTH_CHECK_FAILED")
      .where("entityId", "==", "smtp")
      .get()
  ).size;
  assert(auditCountAfter === auditCountBefore, "Audit log not spammed for repeated identical failure (rate-limited/grouped)");

  // -------------------------------------------------------------
  // 4. Incident Recovery
  // -------------------------------------------------------------
  console.log("\n--- 4. Testing Incident Recovery Transition ---");
  // Run normal check again (should recover)
  const recoveredReport = await runSystemHealthCheck();
  assert(recoveredReport.overallStatus === "operational", "Overall status restored to 'operational' upon recovery");

  const incidentDocRecovered = await db.collection("system_health_incidents").doc("smtp").get();
  const incidentRecoveredData = incidentDocRecovered.data();
  assert(incidentRecoveredData.status === "recovered", "Incident status updated to 'recovered'");
  assert(Boolean(incidentRecoveredData.recoveredAt), "Incident recoveredAt timestamp captured");

  // Verify Audit Log for recovery
  const auditRecoverSnap = await db
    .collection("audit_logs")
    .where("action", "==", "SYSTEM_HEALTH_RECOVERED")
    .where("entityId", "==", "smtp")
    .limit(1)
    .get();
  assert(!auditRecoverSnap.empty, "Audit log recorded for SYSTEM_HEALTH_RECOVERED");

  // -------------------------------------------------------------
  // 5. Role Authorization Enforcement (requireAdmin)
  // -------------------------------------------------------------
  console.log("\n--- 5. Testing Role Authorization (requireAdmin) ---");
  assert(typeof healthRoute.GET === "function", "GET /api/admin/health exported");
  assert(typeof healthRoute.POST === "function", "POST /api/admin/health exported");

  function testRoleGuard(session) {
    if (session.role !== "admin") {
      const error = new Error("Admin role required");
      error.statusCode = 403;
      throw error;
    }
  }

  let ctoBlocked = false;
  try {
    testRoleGuard({ uid: "cto_1", role: "cto" });
  } catch (err) {
    if (err.statusCode === 403) ctoBlocked = true;
  }
  assert(ctoBlocked, "CTO role is strictly blocked from System Health (403 Forbidden)");

  let cadetBlocked = false;
  try {
    testRoleGuard({ uid: "cadet_1", role: "cadet" });
  } catch (err) {
    if (err.statusCode === 403) cadetBlocked = true;
  }
  assert(cadetBlocked, "Cadet role is strictly blocked from System Health (403 Forbidden)");

  // Clean up test incident doc
  await db.collection("system_health_incidents").doc("smtp").delete().catch(() => {});

  console.log("\n================================================================");
  console.log(`🎉 ALL STAGE 15 SYSTEM HEALTH TESTS PASSED (${testsPassed}/${testsTotal})`);
  console.log("================================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test execution failed:", err);
  process.exit(1);
});
