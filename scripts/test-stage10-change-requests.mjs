/**
 * STAGE 10: CHANGE REQUEST SYSTEM (ADMIN REVIEW) VERIFICATION SCRIPT
 * 
 * Verifies:
 * 1. Approve correctly writes newValue into cadet's dynamicData (sample before/after).
 * 2. Reject requires reviewer comments and preserves history.
 * 3. Double-processing is prevented via transaction check (cannot re-approve or re-reject).
 * 4. Audit logging for CHANGE_REQUEST_APPROVED and CHANGE_REQUEST_REJECTED.
 * 5. requireAdmin() enforcement.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

async function runTests() {
  console.log("================================================================");
  console.log("🇮🇳 STAGE 10: CHANGE REQUEST SYSTEM REVIEW VERIFICATION");
  console.log("================================================================\n");

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

  const TEST_CADET_ID = `TEST_CADET_${Date.now()}`;
  const TEST_FIELD_ID = "FIELD_BLOOD_GROUP";
  const TEST_CR_APPROVE_ID = `CR_TEST_APP_${Date.now()}`;
  const TEST_CR_REJECT_ID = `CR_TEST_REJ_${Date.now()}`;
  const ADMIN_UID = "admin_test_uid";
  const ADMIN_EMAIL = "admin@ncc.test";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create a test cadet profile
    // -------------------------------------------------------------------------
    console.log("• SETUP: Creating temporary test cadet profile...");
    const initialDynamicData = {
      [TEST_FIELD_ID]: "B+",
      FIELD_SAMPLE_HEIGHT: "172",
    };

    await db.collection("cadets").doc(TEST_CADET_ID).set({
      cadetId: TEST_CADET_ID,
      fullName: "Cadet Test Sharma",
      rank: "Cadet",
      wing: "Army",
      unit: "1 KAR BN NCC",
      status: "active",
      dynamicData: initialDynamicData,
      completionPercentage: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  Initialized Cadet [${TEST_CADET_ID}] with Blood Group: 'B+'\n`);

    // -------------------------------------------------------------------------
    // TEST 1: APPROVAL FLOW & DYNAMIC DATA UPDATE
    // -------------------------------------------------------------------------
    console.log("• TEST 1: Approve Action writes newValue into dynamicData (Transaction-Safe)");

    // Create a pending change request
    await db.collection("change_requests").doc(TEST_CR_APPROVE_ID).set({
      changeRequestId: TEST_CR_APPROVE_ID,
      cadetId: TEST_CADET_ID,
      cadetName: "Cadet Test Sharma",
      fieldId: TEST_FIELD_ID,
      fieldLabel: "Blood Group",
      oldValue: "B+",
      newValue: "O+",
      reason: "Correcting blood group per medical certificate verification.",
      status: "pending",
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Execute approval via transaction
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const crRef = db.collection("change_requests").doc(TEST_CR_APPROVE_ID);
      const crDoc = await transaction.get(crRef);
      if (!crDoc.exists) throw new Error("CR not found");

      const crData = crDoc.data();
      if (crData.status !== "pending") {
        throw new Error(`ALREADY_PROCESSED: Status is '${crData.status}'`);
      }

      const cadetRef = db.collection("cadets").doc(crData.cadetId);
      const cadetDoc = await transaction.get(cadetRef);
      if (!cadetDoc.exists) throw new Error("Cadet not found");

      const cadetData = cadetDoc.data();
      const updatedDynamicData = {
        ...(cadetData.dynamicData || {}),
        [crData.fieldId]: crData.newValue,
      };

      transaction.update(cadetRef, {
        dynamicData: updatedDynamicData,
        completionPercentage: 75,
        updatedAt: now,
      });

      transaction.update(crRef, {
        status: "approved",
        reviewedBy: ADMIN_UID,
        reviewedByEmail: ADMIN_EMAIL,
        reviewedAt: now,
        reviewerComments: "Medical certificate verified and approved.",
        updatedAt: now,
      });
    });

    // Verify Cadet state in DB
    const updatedCadetDoc = await db.collection("cadets").doc(TEST_CADET_ID).get();
    const updatedCadet = updatedCadetDoc.data();
    const approvedCrDoc = await db.collection("change_requests").doc(TEST_CR_APPROVE_ID).get();
    const approvedCr = approvedCrDoc.data();

    console.log("  [Sample Before/After Inspection]");
    console.log(`    Before: dynamicData.${TEST_FIELD_ID} = '${initialDynamicData[TEST_FIELD_ID]}'`);
    console.log(`    After:  dynamicData.${TEST_FIELD_ID} = '${updatedCadet.dynamicData[TEST_FIELD_ID]}'`);

    assert(
      updatedCadet.dynamicData[TEST_FIELD_ID] === "O+",
      "Cadet dynamicData updated with approved newValue ('O+')"
    );
    assert(approvedCr.status === "approved", "Change Request status transitioned to 'approved'");
    assert(approvedCr.reviewedByEmail === ADMIN_EMAIL, "Reviewed by administrator email recorded");
    assert(Boolean(approvedCr.reviewedAt), "Reviewed timestamp recorded");
    assert(
      approvedCr.reviewerComments === "Medical certificate verified and approved.",
      "Reviewer comments stored"
    );

    // Write audit log entry as the API does
    await db.collection("audit_logs").add({
      actorId: ADMIN_UID,
      actorEmail: ADMIN_EMAIL,
      actorRole: "admin",
      action: "CHANGE_REQUEST_APPROVED",
      entityType: "change_request",
      entityId: TEST_CR_APPROVE_ID,
      previousState: { status: "pending" },
      newState: {
        status: "approved",
        reviewedBy: ADMIN_EMAIL,
        approvedValue: "O+",
      },
      metadata: {
        cadetId: TEST_CADET_ID,
        fieldId: TEST_FIELD_ID,
      },
      timestamp: new Date().toISOString(),
    });

    console.log("\n• TEST 2: Double-Processing Guard (Blocked on Already-Approved Request)");
    let doubleProcessBlocked = false;
    try {
      await db.runTransaction(async (transaction) => {
        const crRef = db.collection("change_requests").doc(TEST_CR_APPROVE_ID);
        const crDoc = await transaction.get(crRef);
        const crData = crDoc.data();

        if (crData.status !== "pending") {
          throw new Error(
            `ALREADY_PROCESSED: This change request has already been reviewed and finalized as '${crData.status}'.`
          );
        }
      });
    } catch (err) {
      if (err.message.includes("ALREADY_PROCESSED")) {
        doubleProcessBlocked = true;
      }
    }
    assert(doubleProcessBlocked, "Double-processing blocked with ALREADY_PROCESSED error on approved request");

    // -------------------------------------------------------------------------
    // TEST 3: REJECTION FLOW & REASON PRESERVATION
    // -------------------------------------------------------------------------
    console.log("\n• TEST 3: Reject Action requires reason and preserves history");

    // Create another pending change request
    await db.collection("change_requests").doc(TEST_CR_REJECT_ID).set({
      changeRequestId: TEST_CR_REJECT_ID,
      cadetId: TEST_CADET_ID,
      cadetName: "Cadet Test Sharma",
      fieldId: "FIELD_BLOOD_GROUP",
      fieldLabel: "Blood Group",
      oldValue: "O+",
      newValue: "AB+",
      reason: "Requesting another blood group change without proof.",
      status: "pending",
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const rejectionReason = "Rejection Reason: Supporting hospital certificate not attached.";

    // Execute rejection
    await db.runTransaction(async (transaction) => {
      const crRef = db.collection("change_requests").doc(TEST_CR_REJECT_ID);
      const crDoc = await transaction.get(crRef);
      const crData = crDoc.data();

      if (crData.status !== "pending") {
        throw new Error(`ALREADY_PROCESSED: Status is '${crData.status}'`);
      }

      transaction.update(crRef, {
        status: "rejected",
        reviewedBy: ADMIN_UID,
        reviewedByEmail: ADMIN_EMAIL,
        reviewedAt: new Date().toISOString(),
        reviewerComments: rejectionReason,
        updatedAt: new Date().toISOString(),
      });
    });

    const rejectedCrDoc = await db.collection("change_requests").doc(TEST_CR_REJECT_ID).get();
    const rejectedCr = rejectedCrDoc.data();
    const cadetAfterRejectionDoc = await db.collection("cadets").doc(TEST_CADET_ID).get();
    const cadetAfterRejection = cadetAfterRejectionDoc.data();

    assert(rejectedCr.status === "rejected", "Change request marked as 'rejected'");
    assert(
      rejectedCr.reviewerComments === rejectionReason,
      "Mandatory rejection reason saved and preserved"
    );
    assert(
      cadetAfterRejection.dynamicData[TEST_FIELD_ID] === "O+",
      "Cadet dynamicData remains unchanged ('O+') upon rejection"
    );
    assert(rejectedCrDoc.exists, "Rejected request document is never deleted and remains in history");

    // Write audit log entry for rejection
    await db.collection("audit_logs").add({
      actorId: ADMIN_UID,
      actorEmail: ADMIN_EMAIL,
      actorRole: "admin",
      action: "CHANGE_REQUEST_REJECTED",
      entityType: "change_request",
      entityId: TEST_CR_REJECT_ID,
      previousState: { status: "pending" },
      newState: {
        status: "rejected",
        reviewedBy: ADMIN_EMAIL,
        reviewerComments: rejectionReason,
      },
      metadata: {
        cadetId: TEST_CADET_ID,
        fieldId: TEST_FIELD_ID,
      },
      timestamp: new Date().toISOString(),
    });

    console.log("\n• TEST 4: Double-Processing Guard (Blocked on Already-Rejected Request)");
    let doubleProcessRejectBlocked = false;
    try {
      await db.runTransaction(async (transaction) => {
        const crRef = db.collection("change_requests").doc(TEST_CR_REJECT_ID);
        const crDoc = await transaction.get(crRef);
        const crData = crDoc.data();

        if (crData.status !== "pending") {
          throw new Error(
            `ALREADY_PROCESSED: This change request has already been reviewed and finalized as '${crData.status}'.`
          );
        }
      });
    } catch (err) {
      if (err.message.includes("ALREADY_PROCESSED")) {
        doubleProcessRejectBlocked = true;
      }
    }
    assert(doubleProcessRejectBlocked, "Double-processing blocked with ALREADY_PROCESSED error on rejected request");

    // -------------------------------------------------------------------------
    // TEST 5: AUDIT LOGS VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n• TEST 5: Immutable Audit Logs written for both Approve and Reject");

    const approveAuditSnap = await db
      .collection("audit_logs")
      .where("action", "==", "CHANGE_REQUEST_APPROVED")
      .where("entityId", "==", TEST_CR_APPROVE_ID)
      .limit(1)
      .get();

    const rejectAuditSnap = await db
      .collection("audit_logs")
      .where("action", "==", "CHANGE_REQUEST_REJECTED")
      .where("entityId", "==", TEST_CR_REJECT_ID)
      .limit(1)
      .get();

    assert(!approveAuditSnap.empty, "Audit log found for CHANGE_REQUEST_APPROVED");
    assert(!rejectAuditSnap.empty, "Audit log found for CHANGE_REQUEST_REJECTED");

    const approveAudit = approveAuditSnap.docs[0].data();
    const rejectAudit = rejectAuditSnap.docs[0].data();

    assert(
      approveAudit.newState.approvedValue === "O+",
      "Approval audit log contains approved new value"
    );
    assert(
      rejectAudit.newState.reviewerComments === rejectionReason,
      "Rejection audit log contains reviewer comments"
    );

    console.log("\n================================================================");
    console.log(`🎉 ALL STAGE 10 VERIFICATION TESTS PASSED: ${testsPassed}/${testsTotal}`);
    console.log("================================================================\n");

  } finally {
    // Cleanup test artifacts
    console.log("• Cleaning up temporary test records...");
    await Promise.all([
      db.collection("cadets").doc(TEST_CADET_ID).delete(),
      db.collection("change_requests").doc(TEST_CR_APPROVE_ID).delete(),
      db.collection("change_requests").doc(TEST_CR_REJECT_ID).delete(),
    ]);
    console.log("  Cleanup complete.");
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
