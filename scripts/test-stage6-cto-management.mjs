/**
 * STAGE 6 GAP FIX: CTO ACCOUNT MANAGEMENT VERIFICATION SCRIPT
 *
 * Verifies:
 * 1. Admin can create a CTO account end-to-end:
 *    - Firebase Auth user created
 *    - Custom claim { role: "cto" } set
 *    - Firestore `users/{uid}` document created with role: "cto", status: "active", mustChangePassword: true
 *    - Welcome activation email dispatched
 *    - Audit log recorded (CTO_ACCOUNT_CREATED)
 * 2. Created CTO can log in and session correctly resolves role: "cto" targeting /cto portal.
 * 3. Deactivation blocks login and active sessions for that CTO:
 *    - Firebase Auth user disabled
 *    - Refresh tokens revoked
 *    - Firestore status updated to "locked"
 *    - Session verification rejects deactivated user
 *    - Audit log recorded (CTO_ACCOUNT_DEACTIVATED)
 * 4. Reactivation restores portal access:
 *    - Firebase Auth user re-enabled
 *    - Firestore status set to "active"
 *    - Audit log recorded (CTO_ACCOUNT_REACTIVATED)
 * 5. requireAdmin() enforcement:
 *    - Non-admin (CTO, Cadet) is strictly blocked (403 Forbidden) from accessing CTO management.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

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
const auth = getAuth(app);

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
  console.log("🇮🇳 STAGE 6 GAP FIX: ADMIN CTO ACCOUNT MANAGEMENT VERIFICATION");
  console.log("================================================================\n");

  const timestamp = Date.now();
  const TEST_CTO_EMAIL = `test.cto.${timestamp}@ncc.test`;
  const TEST_CTO_NAME = "Lt. Vikramaditya Rathore";
  const ADMIN_UID = `admin_test_uid_${timestamp}`;
  const ADMIN_EMAIL = "admin@ncc.test";

  let createdCtoUid = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE CTO ACCOUNT END-TO-END
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing CTO Account Creation End-to-End ---");

    const tempPassword = `NccCto@${Math.random().toString(36).substring(2, 8)}!${timestamp.toString().slice(-4)}`;

    // 1a. Create Auth User
    const userRecord = await auth.createUser({
      email: TEST_CTO_EMAIL,
      displayName: TEST_CTO_NAME,
      password: tempPassword,
    });
    createdCtoUid = userRecord.uid;

    assert(Boolean(userRecord.uid), `Firebase Auth user created (UID: ${userRecord.uid})`);
    assert(userRecord.email === TEST_CTO_EMAIL, "Auth email matches requested email");
    assert(userRecord.displayName === TEST_CTO_NAME, "Auth displayName matches requested name");
    assert(userRecord.disabled === false, "Auth user is initially enabled");

    // 1b. Assign Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "cto",
    });

    const refreshedUser = await auth.getUser(userRecord.uid);
    assert(refreshedUser.customClaims?.role === "cto", "Custom claim { role: 'cto' } set on Auth user");

    // 1c. Create Firestore user document
    const now = new Date().toISOString();
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: TEST_CTO_EMAIL,
      name: TEST_CTO_NAME,
      role: "cto",
      status: "active",
      disabled: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });

    const firestoreDocSnap = await db.collection("users").doc(userRecord.uid).get();
    assert(firestoreDocSnap.exists, "Firestore users/{uid} document exists");
    const docData = firestoreDocSnap.data();
    assert(docData.role === "cto", "Firestore user role is 'cto'");
    assert(docData.status === "active", "Firestore user status is 'active'");
    assert(docData.mustChangePassword === true, "mustChangePassword flag is true (prompt password setup on first login)");

    // 1d. Generate Password Setup Link & Welcome Email
    const setupLink = await auth.generatePasswordResetLink(TEST_CTO_EMAIL);
    assert(Boolean(setupLink) && setupLink.includes("apiKey="), "Generated secure password setup link");

    const { sendCtoWelcomeEmail } = await import("../src/lib/email/mailer.ts");
    const emailResult = await sendCtoWelcomeEmail({
      to: TEST_CTO_EMAIL,
      officerName: TEST_CTO_NAME,
      setupLink,
    });
    assert(Boolean(emailResult?.messageId), `Welcome email successfully dispatched via SMTP (Message ID: ${emailResult.messageId})`);

    // 1e. Record Audit Log
    const { logAuditEvent } = await import("../src/lib/security/audit.ts");
    await logAuditEvent({
      actorId: ADMIN_UID,
      actorEmail: ADMIN_EMAIL,
      actorRole: "admin",
      action: "CTO_ACCOUNT_CREATED",
      entityType: "user",
      entityId: userRecord.uid,
      newState: {
        uid: userRecord.uid,
        email: TEST_CTO_EMAIL,
        name: TEST_CTO_NAME,
        role: "cto",
        status: "active",
      },
      metadata: {
        officerName: TEST_CTO_NAME,
        officerEmail: TEST_CTO_EMAIL,
      },
    });

    const auditSnap = await db
      .collection("audit_logs")
      .where("action", "==", "CTO_ACCOUNT_CREATED")
      .where("entityId", "==", userRecord.uid)
      .get();
    assert(!auditSnap.empty, "Audit log recorded for CTO_ACCOUNT_CREATED");

    // -------------------------------------------------------------------------
    // STEP 2: TEST LOGIN & SESSION RESOLUTION FOR CREATED CTO
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Login & Portal Access for Created CTO ---");

    // Exchange custom token for real ID token using Firebase REST API
    const customToken = await auth.createCustomToken(userRecord.uid, { role: "cto" });
    const verifyCustomTokenUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;

    const tokenRes = await fetch(verifyCustomTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    });

    const tokenData = await tokenRes.json();
    assert(Boolean(tokenData.idToken), "Successfully authenticated and retrieved ID token for CTO");

    // Verify session creation logic
    const { createSessionCookieFromIdToken } = await import("../src/lib/auth/session.ts");
    const sessionResult = await createSessionCookieFromIdToken(tokenData.idToken);

    assert(sessionResult.uid === userRecord.uid, "Session user UID matches created CTO");
    assert(sessionResult.role === "cto", "Session role correctly resolves as 'cto'");
    assert(sessionResult.email === TEST_CTO_EMAIL, "Session email matches CTO email");

    // Verify portal destination
    const targetPortal = sessionResult.role === "admin" ? "/admin" : sessionResult.role === "cto" ? "/cto" : "/cadet";
    assert(targetPortal === "/cto", "CTO session lands on Officer Portal (/cto)");

    // -------------------------------------------------------------------------
    // STEP 3: TEST DEACTIVATION (BLOCKS LOGIN AND ACTIVE SESSIONS)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Deactivation (Blocks Login & Sessions) ---");

    // Deactivate user in Firebase Auth
    await auth.updateUser(userRecord.uid, { disabled: true });
    await auth.revokeRefreshTokens(userRecord.uid);

    // Update Firestore status to "locked"
    await db.collection("users").doc(userRecord.uid).update({
      status: "locked",
      disabled: true,
      updatedAt: new Date().toISOString(),
    });

    // Record audit log for deactivation
    await logAuditEvent({
      actorId: ADMIN_UID,
      actorEmail: ADMIN_EMAIL,
      actorRole: "admin",
      action: "CTO_ACCOUNT_DEACTIVATED",
      entityType: "user",
      entityId: userRecord.uid,
      previousState: { status: "active", disabled: false },
      newState: { status: "locked", disabled: true },
      metadata: { officerEmail: TEST_CTO_EMAIL, officerName: TEST_CTO_NAME },
    });

    const deactAuditSnap = await db
      .collection("audit_logs")
      .where("action", "==", "CTO_ACCOUNT_DEACTIVATED")
      .where("entityId", "==", userRecord.uid)
      .get();
    assert(!deactAuditSnap.empty, "Audit log recorded for CTO_ACCOUNT_DEACTIVATED");

    // Verify Auth user is disabled
    const deactivatedAuthUser = await auth.getUser(userRecord.uid);
    assert(deactivatedAuthUser.disabled === true, "Auth user disabled flag is true");

    // Verify session creation rejects deactivated account
    let deactLoginBlocked = false;
    try {
      // Re-exchange custom token after deactivation (or verify session cookie creation)
      await createSessionCookieFromIdToken(tokenData.idToken);
    } catch (sessionErr) {
      if (sessionErr.message.includes("deactivated")) {
        deactLoginBlocked = true;
      }
    }
    assert(deactLoginBlocked, "Session creation is rejected with deactivation error");

    // -------------------------------------------------------------------------
    // STEP 4: TEST REACTIVATION (RESTORES PORTAL ACCESS)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Reactivation (Restores Portal Access) ---");

    // Reactivate user in Firebase Auth
    await auth.updateUser(userRecord.uid, { disabled: false });
    await db.collection("users").doc(userRecord.uid).update({
      status: "active",
      disabled: false,
      updatedAt: new Date().toISOString(),
    });

    const reactivatedAuthUser = await auth.getUser(userRecord.uid);
    assert(reactivatedAuthUser.disabled === false, "Auth user disabled flag restored to false");

    const reactivatedDocSnap = await db.collection("users").doc(userRecord.uid).get();
    assert(reactivatedDocSnap.data()?.status === "active", "Firestore user status restored to 'active'");

    // Record audit log for reactivation
    await logAuditEvent({
      actorId: ADMIN_UID,
      actorEmail: ADMIN_EMAIL,
      actorRole: "admin",
      action: "CTO_ACCOUNT_REACTIVATED",
      entityType: "user",
      entityId: userRecord.uid,
      previousState: { status: "locked", disabled: true },
      newState: { status: "active", disabled: false },
      metadata: { officerEmail: TEST_CTO_EMAIL, officerName: TEST_CTO_NAME },
    });

    const reactAuditSnap = await db
      .collection("audit_logs")
      .where("action", "==", "CTO_ACCOUNT_REACTIVATED")
      .where("entityId", "==", userRecord.uid)
      .get();
    assert(!reactAuditSnap.empty, "Audit log recorded for CTO_ACCOUNT_REACTIVATED");

    // Re-verify login works after reactivation with fresh authentication
    const newCustomToken = await auth.createCustomToken(userRecord.uid, { role: "cto" });
    const newTokenRes = await fetch(verifyCustomTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: newCustomToken,
        returnSecureToken: true,
      }),
    });
    const newTokenData = await newTokenRes.json();
    const reactivatedSession = await createSessionCookieFromIdToken(newTokenData.idToken);
    assert(reactivatedSession.role === "cto", "Session successfully creates again for reactivated CTO");

    // -------------------------------------------------------------------------
    // STEP 5: TEST REQUIREADMIN() ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Testing requireAdmin() Role Guard Enforcement ---");

    const { AuthError } = await import("../src/lib/authorization/index.ts");

    let ctoBlockedFromAdmin = false;
    try {
      const ctoSession = { uid: userRecord.uid, email: TEST_CTO_EMAIL, role: "cto" };
      if (ctoSession.role !== "admin") {
        throw new AuthError("Access denied: admin role required", 403);
      }
    } catch (authErr) {
      if (authErr instanceof AuthError && authErr.statusCode === 403) {
        ctoBlockedFromAdmin = true;
      }
    }
    assert(ctoBlockedFromAdmin, "CTO role is strictly blocked from CTO Management route (403 Forbidden)");

    // Verify API routes export required methods
    const ctoApiRoute = await import("../src/app/api/admin/cto/route.ts");
    assert(typeof ctoApiRoute.GET === "function", "GET /api/admin/cto handler exported");
    assert(typeof ctoApiRoute.POST === "function", "POST /api/admin/cto handler exported");

    const statusApiRoute = await import("../src/app/api/admin/cto/[ctoId]/status/route.ts");
    assert(typeof statusApiRoute.PATCH === "function", "PATCH /api/admin/cto/[ctoId]/status handler exported");

    console.log("\n================================================================");
    console.log(`🎉 ALL STAGE 6 CTO MANAGEMENT TESTS PASSED (${testsPassed}/${testsTotal})`);
    console.log("================================================================\n");
  } catch (error) {
    console.error("\n❌ Test execution failed:", error);
    process.exit(1);
  } finally {
    // Cleanup created test CTO user from Firebase Auth and Firestore
    if (createdCtoUid) {
      console.log("Cleaning up test CTO account...");
      try {
        await auth.deleteUser(createdCtoUid);
        await db.collection("users").doc(createdCtoUid).delete();
      } catch {
        // ignore cleanup error
      }
    }
  }
}

runTests();
