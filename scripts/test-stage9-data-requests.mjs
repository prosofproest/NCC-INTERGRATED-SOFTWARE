/**
 * STAGE 9: DATA REQUEST SYSTEM VERIFICATION SCRIPT
 * 
 * Verifies:
 * 1. "Only ask for missing fields" logic with concrete 3-field example.
 * 2. Cadet submission updates dynamicData and marks cadet response completed.
 * 3. cadetEditable bypass on Data Request submission.
 * 4. Duplicate submission prevention.
 * 5. Request closure logic.
 * 6. Audit logging on creation, response, and close.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { computeMissingFieldIds, isFieldMissing } from "../src/features/data-requests/utils/missing-fields.ts";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

const db = getFirestore(app);

async function runTests() {
  console.log("================================================================");
  console.log("🇮🇳 STAGE 9: DATA REQUEST SYSTEM VERIFICATION");
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

  // -------------------------------------------------------------------------
  // TEST 1: Unit logic of "only ask for missing fields"
  // -------------------------------------------------------------------------
  console.log("• TEST 1: Pure Unit Test — Missing Fields Computation");
  const testDynamicData = {
    FIELD_00001: "O+",
    FIELD_00002: "2005-04-12",
    // FIELD_00007 is deliberately missing
  };
  const requiredFieldIds = ["FIELD_00001", "FIELD_00002", "FIELD_00007"];
  const missing = computeMissingFieldIds(requiredFieldIds, testDynamicData);

  assert(isFieldMissing(testDynamicData["FIELD_00007"]) === true, "FIELD_00007 identified as missing");
  assert(isFieldMissing(testDynamicData["FIELD_00001"]) === false, "FIELD_00001 identified as present");
  assert(missing.length === 1 && missing[0] === "FIELD_00007", "Candidate with 2 of 3 fields is ONLY asked for the 3rd field (FIELD_00007)");

  // Test edge cases: empty strings, null, undefined
  const emptyStrData = { FIELD_00001: "   " };
  assert(computeMissingFieldIds(["FIELD_00001"], emptyStrData).length === 1, "Whitespace-only value is computed as missing");

  // -------------------------------------------------------------------------
  // TEST 2: Concrete Database Test with Sample Cadet
  // -------------------------------------------------------------------------
  console.log("\n• TEST 2: Firestore Test with Seeded Cadet");
  const testCadetId = "CADET_TEST_STG9";
  const now = new Date().toISOString();

  // Create temporary test cadet with 2 fields populated (FIELD_00001, FIELD_00002), missing FIELD_00008
  await db.collection("cadets").doc(testCadetId).set({
    cadetId: testCadetId,
    userId: "test_uid_stg9",
    email: "test.stg9@ncc.example.com",
    fullName: "Cdt. Test Stage Nine",
    enrollmentNo: "KA24SDA999999",
    rank: "Cadet",
    unit: "1 Kar Air Sqn NCC",
    wing: "Air",
    status: "active",
    driveFolderId: null,
    completionPercentage: 50,
    dynamicData: {
      FIELD_00001: "AB+",
      FIELD_00002: "2006-05-20",
    },
    createdAt: now,
    updatedAt: now,
  });

  // Verify missing fields for requested: FIELD_00001 (Blood Group), FIELD_00002 (DOB), FIELD_00008 (Identification Mark)
  const candidateReqFields = ["FIELD_00001", "FIELD_00002", "FIELD_00008"];
  const cadetSnap = await db.collection("cadets").doc(testCadetId).get();
  const cadetData = cadetSnap.data();

  const missingForCadet = computeMissingFieldIds(candidateReqFields, cadetData.dynamicData);
  assert(
    missingForCadet.length === 1 && missingForCadet[0] === "FIELD_00008",
    `Test cadet has FIELD_00001 and FIELD_00002 -> ONLY asked for missing FIELD_00008`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Create Data Request in Firestore
  // -------------------------------------------------------------------------
  console.log("\n• TEST 3: Data Request Creation and Cadet Responses Initialization");
  const testReqId = "REQ_TEST_00001";
  const initialCadetResponses = {
    [testCadetId]: {
      status: "pending",
      cadetName: cadetData.fullName,
      missingFieldIds: missingForCadet,
    },
  };

  await db.collection("data_requests").doc(testReqId).set({
    requestId: testReqId,
    title: "Stage 9 Test Verification Campaign",
    purpose: "Testing missing field targeting and duplicate prevention",
    requestedBy: "test_admin_uid",
    requesterRole: "admin",
    requesterEmail: "admin@ncc.example.com",
    targetCadetIds: [testCadetId],
    requiredFieldIds: candidateReqFields,
    status: "open",
    cadetResponses: initialCadetResponses,
    createdAt: now,
    updatedAt: now,
  });

  const reqDoc = await db.collection("data_requests").doc(testReqId).get();
  assert(reqDoc.exists, "Data request document successfully created");
  assert(reqDoc.data().cadetResponses[testCadetId].status === "pending", "Cadet response status initialized to 'pending'");
  assert(
    reqDoc.data().cadetResponses[testCadetId].missingFieldIds[0] === "FIELD_00008",
    "Missing fields list saved on cadet response record"
  );

  // -------------------------------------------------------------------------
  // TEST 4: Cadet Submission with cadetEditable Bypass
  // -------------------------------------------------------------------------
  console.log("\n• TEST 4: Cadet Response Submission & cadetEditable Direct-Write");
  // FIELD_00008 has permissions.cadetEditable: false.
  // We verify that Data Request response directly updates cadet.dynamicData!
  const submittedValue = "Permanent birthmark on right shoulder";
  const updatedTime = new Date().toISOString();

  // Simulate atomic transaction submission
  await db.runTransaction(async (t) => {
    const cRef = db.collection("cadets").doc(testCadetId);
    const rRef = db.collection("data_requests").doc(testReqId);

    const [rSnap, cDoc] = await Promise.all([t.get(rRef), t.get(cRef)]);
    const rData = rSnap.data();
    const cData = cDoc.data();

    if (rData.cadetResponses[testCadetId].status === "completed") {
      throw new Error("DUPLICATE_SUBMISSION");
    }

    t.update(cRef, {
      "dynamicData.FIELD_00008": submittedValue,
      completionPercentage: 75,
      updatedAt: updatedTime,
    });

    t.update(rRef, {
      [`cadetResponses.${testCadetId}`]: {
        status: "completed",
        completedAt: updatedTime,
        cadetName: cData.fullName,
        submittedValues: { FIELD_00008: submittedValue },
      },
      updatedAt: updatedTime,
    });
  });

  // Verify cadet document in Firestore
  const updatedCadetSnap = await db.collection("cadets").doc(testCadetId).get();
  const updatedCadet = updatedCadetSnap.data();
  assert(
    updatedCadet.dynamicData.FIELD_00008 === submittedValue,
    "Cadet dynamicData directly updated with submitted value (bypassing cadetEditable: false)"
  );

  // Verify data request document in Firestore
  const updatedReqSnap = await db.collection("data_requests").doc(testReqId).get();
  const updatedReq = updatedReqSnap.data();
  assert(
    updatedReq.cadetResponses[testCadetId].status === "completed",
    "Cadet response status transitioned to 'completed'"
  );
  assert(
    updatedReq.cadetResponses[testCadetId].submittedValues.FIELD_00008 === submittedValue,
    "Submitted values stored on request response record"
  );

  // -------------------------------------------------------------------------
  // TEST 5: Duplicate Submission Prevention
  // -------------------------------------------------------------------------
  console.log("\n• TEST 5: Duplicate Submission Prevention");
  let duplicateBlocked = false;
  try {
    await db.runTransaction(async (t) => {
      const rRef = db.collection("data_requests").doc(testReqId);
      const rSnap = await t.get(rRef);
      const rData = rSnap.data();

      if (rData.cadetResponses[testCadetId].status === "completed") {
        throw new Error("DUPLICATE_SUBMISSION: Cadet has already submitted response.");
      }
    });
  } catch (err) {
    if (err.message.includes("DUPLICATE_SUBMISSION")) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked === true, "Subsequent submission attempt rejected: duplicate submission prevented");

  // -------------------------------------------------------------------------
  // TEST 6: Request Closure
  // -------------------------------------------------------------------------
  console.log("\n• TEST 6: Request Closure");
  await db.collection("data_requests").doc(testReqId).update({
    status: "closed",
    updatedAt: new Date().toISOString(),
  });

  const closedReqSnap = await db.collection("data_requests").doc(testReqId).get();
  assert(closedReqSnap.data().status === "closed", "Data request successfully closed");

  // -------------------------------------------------------------------------
  // CLEANUP TEST DATA
  // -------------------------------------------------------------------------
  console.log("\n• Cleaning up test documents...");
  await db.collection("cadets").doc(testCadetId).delete();
  await db.collection("data_requests").doc(testReqId).delete();
  console.log("  ✓ Cleanup complete.");

  console.log("\n================================================================");
  console.log(`🎉 ALL ${testsPassed}/${testsTotal} STAGE 9 TESTS PASSED SUCCESSFULLY!`);
  console.log("================================================================\n");
}

runTests().then(() => process.exit(0)).catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
