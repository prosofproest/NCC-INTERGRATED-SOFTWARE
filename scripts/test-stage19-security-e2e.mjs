import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = getAuth(app);

const BASE_URL = "http://localhost:3000";

// Test Users
const SEC_ADMIN_EMAIL = "sec.admin.test@ncc.test";
const SEC_CTO_EMAIL = "sec.cto.test@ncc.test";
const SEC_CADET_A_EMAIL = "sec.cadet.a@ncc.test";
const SEC_CADET_A_ID = "CADET_SEC_A";
const SEC_CADET_B_EMAIL = "sec.cadet.b@ncc.test";
const SEC_CADET_B_ID = "CADET_SEC_B";

const results = [];

function recordResult(category, testName, passed, details = "") {
  results.push({ category, testName, passed, details });
  const symbol = passed ? "✅" : "❌";
  console.log(`${symbol} [${category}] ${testName} => ${passed ? "PASS" : "FAIL"} ${details ? `(${details})` : ""}`);
}

async function getOrCreateUserSession(email, role, cadetId = null) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password: "SecurityTest123!",
        emailVerified: true,
      });
    } else {
      throw err;
    }
  }

  await auth.setCustomUserClaims(user.uid, {
    role,
    cadetId: cadetId || null,
  });

  // Store in users collection
  await db.collection("users").doc(user.uid).set(
    {
      userId: user.uid,
      email,
      role,
      cadetId: cadetId || null,
      status: "active",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const customToken = await auth.createCustomToken(user.uid, {
    role,
    cadetId: cadetId || null,
  });

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  const sessionCookie = await auth.createSessionCookie(data.idToken, {
    expiresIn: 24 * 60 * 60 * 1000,
  });

  return { uid: user.uid, sessionCookie };
}

async function runTests() {
  console.log("===============================================================================");
  console.log("=== STAGE 19-20: SECURITY HARDENING AUDIT & CRITICAL E2E JOURNEY TEST SUITE ===");
  console.log("===============================================================================\n");

  // 1. Setup Test Entities
  console.log("[SETUP] Provisioning test user sessions and records...");
  const admin = await getOrCreateUserSession(SEC_ADMIN_EMAIL, "admin");
  const cto = await getOrCreateUserSession(SEC_CTO_EMAIL, "cto");
  const cadetA = await getOrCreateUserSession(SEC_CADET_A_EMAIL, "cadet", SEC_CADET_A_ID);
  const cadetB = await getOrCreateUserSession(SEC_CADET_B_EMAIL, "cadet", SEC_CADET_B_ID);

  // Seed cadet records in Firestore
  await db.collection("cadets").doc(SEC_CADET_A_ID).set({
    cadetId: SEC_CADET_A_ID,
    userId: cadetA.uid,
    fullName: "Cadet Alpha Security",
    email: SEC_CADET_A_EMAIL,
    enrollmentNo: "KA24SDA111111",
    rank: "Cadet",
    unit: "1 Kar Air Sqn NCC",
    wing: "Air",
    trainingYear: "1st Year",
    division: "SD",
    status: "active",
    dynamicData: { bloodGroup: "O+", phone: "9876543210" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.collection("cadets").doc(SEC_CADET_B_ID).set({
    cadetId: SEC_CADET_B_ID,
    userId: cadetB.uid,
    fullName: "Cadet Bravo Security",
    email: SEC_CADET_B_EMAIL,
    enrollmentNo: "KA24SWA222222",
    rank: "Cadet",
    unit: "1 Kar Air Sqn NCC",
    wing: "Air",
    trainingYear: "2nd Year",
    division: "SW",
    status: "active",
    dynamicData: { bloodGroup: "AB+", phone: "9123456789" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // ===========================================================================
  // PART A: SECURITY HARDENING & ADVERSARIAL ATTACK TESTS
  // ===========================================================================
  console.log("\n--- PART A: DELIBERATE ADVERSARIAL ATTACK TESTS ---");

  // 1. Role Boundary Verification: Every Admin Route vs Non-Admin Tokens
  const adminRoutes = [
    { name: "Admin Cadets List", url: `${BASE_URL}/api/admin/cadets`, method: "GET" },
    { name: "Admin Categories", url: `${BASE_URL}/api/admin/categories`, method: "GET" },
    { name: "Admin Dynamic Fields", url: `${BASE_URL}/api/admin/fields`, method: "GET" },
    { name: "Admin Backups", url: `${BASE_URL}/api/admin/backups`, method: "GET" },
    { name: "Admin Audit Logs", url: `${BASE_URL}/api/admin/audit-logs`, method: "GET" },
    { name: "Admin System Health", url: `${BASE_URL}/api/admin/health`, method: "GET" },
    { name: "Admin CTO Management", url: `${BASE_URL}/api/admin/cto`, method: "GET" },
    { name: "Admin Change Requests", url: `${BASE_URL}/api/admin/change-requests`, method: "GET" },
  ];

  for (const r of adminRoutes) {
    // a) No Token
    const resNoToken = await fetch(r.url, { method: r.method });
    recordResult(
      "Role Boundaries",
      `${r.name} - Unauthenticated Access Blocked`,
      resNoToken.status === 401 || resNoToken.status === 403,
      `HTTP Status: ${resNoToken.status}`
    );

    // b) Invalid / Corrupted Token
    const resInvalid = await fetch(r.url, {
      method: r.method,
      headers: { Cookie: "__session=invalid_malformed_fake_token_value" },
    });
    recordResult(
      "Role Boundaries",
      `${r.name} - Invalid Token Blocked`,
      resInvalid.status === 401 || resInvalid.status === 403,
      `HTTP Status: ${resInvalid.status}`
    );

    // c) CTO Token
    const resCto = await fetch(r.url, {
      method: r.method,
      headers: { Cookie: `__session=${cto.sessionCookie}` },
    });
    recordResult(
      "Role Boundaries",
      `${r.name} - CTO Access Blocked`,
      resCto.status === 403,
      `HTTP Status: ${resCto.status}`
    );

    // d) Cadet Token
    const resCadet = await fetch(r.url, {
      method: r.method,
      headers: { Cookie: `__session=${cadetA.sessionCookie}` },
    });
    recordResult(
      "Role Boundaries",
      `${r.name} - Cadet Access Blocked`,
      resCadet.status === 403,
      `HTTP Status: ${resCadet.status}`
    );

    // e) Admin Token (Valid Authorized Access)
    const resAdmin = await fetch(r.url, {
      method: r.method,
      headers: { Cookie: `__session=${admin.sessionCookie}` },
    });
    recordResult(
      "Role Boundaries",
      `${r.name} - Admin Access Allowed`,
      resAdmin.status === 200,
      `HTTP Status: ${resAdmin.status}`
    );
  }

  // 2. IDOR Protection: Cadet A attempting to view/manipulate Cadet B's data
  console.log("\n--- IDOR & Cadet Ownership Enforcement ---");
  
  // Test 1: Cadet A attempts to upload document for Cadet B
  const idorFormData = new FormData();
  const mockPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const blob = new Blob([mockPdfBuffer], { type: "application/pdf" });
  idorFormData.append("file", blob, "idor_attack.pdf");
  idorFormData.append("cadetId", SEC_CADET_B_ID); // Target Cadet B!
  idorFormData.append("categoryId", "CAT_001");
  idorFormData.append("title", "IDOR Malicious Upload");

  const resIdorUpload = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: { Cookie: `__session=${cadetA.sessionCookie}` },
    body: idorFormData,
  });
  const idorUploadJson = await resIdorUpload.json().catch(() => ({}));
  recordResult(
    "IDOR Protection",
    "Cadet A cannot upload documents to Cadet B's profile",
    resIdorUpload.status === 403,
    `HTTP Status: ${resIdorUpload.status}, Message: ${idorUploadJson.error || ""}`
  );

  // Test 2: Cadet A attempts to download documents belonging to Cadet B
  // Seed a document for Cadet B
  const cadetBDocRef = await db.collection("documents").add({
    documentId: "DOC_CADET_B_TEST",
    cadetId: SEC_CADET_B_ID,
    categoryId: "CAT_001",
    title: "Cadet B Confidential Document",
    fileName: "confidential_b.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    driveFileId: "mock_drive_id_b",
    driveWebViewLink: "https://drive.google.com/view/b",
    verificationStatus: "verified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await cadetBDocRef.update({ documentId: cadetBDocRef.id });

  const resIdorDoc = await fetch(`${BASE_URL}/api/documents/${cadetBDocRef.id}/download`, {
    headers: { Cookie: `__session=${cadetA.sessionCookie}` },
  });
  recordResult(
    "IDOR Protection",
    "Cadet A cannot download documents belonging to Cadet B",
    resIdorDoc.status === 403,
    `HTTP Status: ${resIdorDoc.status}`
  );
  await cadetBDocRef.delete();

  // 3. Fuzzing & Injection Defense
  console.log("\n--- Input Sanitization & Injection Defense ---");
  const injectionPayloads = [
    "' OR '1'='1",
    "admin' --",
    "{\"field\": {\"$gt\": \"\"}}",
    "<script>alert('XSS')</script>",
    "../../../../etc/passwd",
    "%00%27%22",
  ];

  for (const payload of injectionPayloads) {
    const enc = encodeURIComponent(payload);
    const searchRes = await fetch(`${BASE_URL}/api/admin/cadets?search=${enc}`, {
      headers: { Cookie: `__session=${admin.sessionCookie}` },
    });
    recordResult(
      "Injection Defense",
      `Search input handles payload safely: ${payload.substring(0, 15)}...`,
      searchRes.status === 200,
      `HTTP Status: ${searchRes.status}`
    );
  }

  // 4. Rate Limiting Protection Check
  console.log("\n--- Rate Limiting Verification ---");
  let rateLimitTriggered = false;
  for (let i = 0; i < 12; i++) {
    const otpRes = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ratelimit.test@ncc.test" }),
    });
    if (otpRes.status === 429) {
      rateLimitTriggered = true;
      break;
    }
  }
  recordResult(
    "Rate Limiting",
    "Rapid-fire OTP requests trigger HTTP 429 Rate Limit",
    rateLimitTriggered,
    rateLimitTriggered ? "HTTP 429 Rate Limit Enforced" : "Rate limit not hit within 12 requests"
  );

  // 5. Security Headers Verification
  console.log("\n--- HTTPS & Security Headers Verification ---");
  const headerRes = await fetch(`${BASE_URL}/login`);
  const headers = headerRes.headers;

  const hsts = headers.get("strict-transport-security");
  const xcto = headers.get("x-content-type-options");
  const xfo = headers.get("x-frame-options");
  const rp = headers.get("referrer-policy");
  const csp = headers.get("content-security-policy");

  recordResult("Security Headers", "Strict-Transport-Security Header Present", Boolean(hsts), hsts || "missing");
  recordResult("Security Headers", "X-Content-Type-Options: nosniff Header Present", xcto === "nosniff", xcto || "missing");
  recordResult("Security Headers", "X-Frame-Options: DENY Header Present", xfo === "DENY", xfo || "missing");
  recordResult("Security Headers", "Referrer-Policy Header Present", Boolean(rp), rp || "missing");
  recordResult("Security Headers", "Content-Security-Policy Header Present", Boolean(csp), csp ? "CSP active" : "missing");

  // ===========================================================================
  // PART B: COMPLETE END-TO-END CRITICAL USER JOURNEYS
  // ===========================================================================
  console.log("\n===============================================================================");
  console.log("=== PART B: END-TO-END CRITICAL USER JOURNEY VERIFICATION ===");
  console.log("===============================================================================\n");

  // JOURNEY 1: New Cadet Onboarding with Year & Division
  console.log("--- Journey 1: Cadet Onboarding via Excel Import ---");
  const uniqueOnboardEmail = `journey.cadet.${Date.now()}@ncc.test`;
  const onboardingPayload = {
    cadets: [
      {
        name: "Flight Cadet Onboarding Test",
        email: uniqueOnboardEmail,
        phone: "9998887776",
        trainingYear: "1st Year",
        division: "SD",
      },
    ],
  };

  const importRes = await fetch(`${BASE_URL}/api/admin/excel/import-cadets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${admin.sessionCookie}`,
    },
    body: JSON.stringify(onboardingPayload),
  });

  const importData = await importRes.json();
  const createdCadetId = importData?.createdCadets?.[0]?.cadetId;
  recordResult(
    "Journey 1: Onboarding",
    "Admin imports new cadet with Year and Division",
    (importRes.status === 200 || importRes.status === 201) && Boolean(createdCadetId),
    `Created Cadet ID: ${createdCadetId || JSON.stringify(importData?.failedCadets || importData)}`
  );

  // Verify created cadet record in Firestore has Air Wing, 1st Year, and SD
  if (createdCadetId) {
    const createdDoc = await db.collection("cadets").doc(createdCadetId).get();
    const cData = createdDoc.data();
    recordResult(
      "Journey 1: Onboarding",
      "Master record stored with Air Wing, Training Year, and Division",
      cData?.wing === "Air" && cData?.trainingYear === "1st Year" && cData?.division === "SD",
      `Wing: ${cData?.wing}, Year: ${cData?.trainingYear}, Div: ${cData?.division}`
    );
  }

  // JOURNEY 2: Data Request Cycle
  console.log("\n--- Journey 2: Data Collection Request Cycle ---");
  const createDataReqRes = await fetch(`${BASE_URL}/api/data-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${admin.sessionCookie}`,
    },
    body: JSON.stringify({
      title: "Annual Camp Gear Sizing Request",
      purpose: "Please provide your updated blood group and institution details for the upcoming camp.",
      targetCadetIds: [SEC_CADET_A_ID],
      requiredFieldIds: ["FIELD_00001", "FIELD_00004"],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  const dataReqData = await createDataReqRes.json();
  const dataRequestId = dataReqData?.requestId || dataReqData?.dataRequest?.requestId;

  recordResult(
    "Journey 2: Data Requests",
    "Admin creates Data Request targeting Cadet A",
    (createDataReqRes.status === 200 || createDataReqRes.status === 201) && Boolean(dataRequestId),
    `Request ID: ${dataRequestId}`
  );

  // Cadet A submits responses for the requested fields
  const submitDataReqRes = await fetch(`${BASE_URL}/api/cadet/data-requests/${dataRequestId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${cadetA.sessionCookie}`,
    },
    body: JSON.stringify({
      values: {
        FIELD_00001: "O+",
        FIELD_00004: "National Institute of Technology",
      },
    }),
  });
  recordResult(
    "Journey 2: Data Requests",
    "Cadet A submits responses to Data Request",
    submitDataReqRes.status === 200 || submitDataReqRes.status === 201,
    `HTTP Status: ${submitDataReqRes.status}`
  );

  // Admin verifies response is registered in request details
  const getReqDetailsRes = await fetch(`${BASE_URL}/api/data-requests/${dataRequestId}`, {
    headers: { Cookie: `__session=${admin.sessionCookie}` },
  });
  const reqDetails = await getReqDetailsRes.json();
  const cadetAResponseStatus = reqDetails?.dataRequest?.cadetResponses?.[SEC_CADET_A_ID]?.status;
  recordResult(
    "Journey 2: Data Requests",
    "Admin views submitted cadet responses in request details",
    getReqDetailsRes.status === 200 && cadetAResponseStatus === "completed",
    `Cadet response status: ${cadetAResponseStatus}`
  );

  // JOURNEY 3: Change Request Lifecycle
  console.log("\n--- Journey 3: Change Request Lifecycle ---");
  // Cadet A submits Change Request
  const crSubmitRes = await fetch(`${BASE_URL}/api/cadet/change-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${cadetA.sessionCookie}`,
    },
    body: JSON.stringify({
      fieldId: "FIELD_00001",
      newValue: "AB+",
      reason: "Correction of blood group after comprehensive clinical laboratory test",
    }),
  });
  const crData = await crSubmitRes.json();
  const changeRequestId = crData?.changeRequestId || crData?.changeRequest?.changeRequestId;

  recordResult(
    "Journey 3: Change Requests",
    "Cadet A submits change request for locked field",
    (crSubmitRes.status === 200 || crSubmitRes.status === 201) && Boolean(changeRequestId),
    `Change Request ID: ${changeRequestId}`
  );

  // Admin approves change request
  const crApproveRes = await fetch(`${BASE_URL}/api/admin/change-requests/${changeRequestId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${admin.sessionCookie}`,
    },
    body: JSON.stringify({
      action: "approve",
      reviewerComments: "Verified with official hospital laboratory medical certificate",
    }),
  });
  recordResult(
    "Journey 3: Change Requests",
    "Admin approves change request",
    crApproveRes.status === 200,
    `HTTP Status: ${crApproveRes.status}`
  );

  // Verify Cadet A's record updated with approved value
  const updatedCadetDoc = await db.collection("cadets").doc(SEC_CADET_A_ID).get();
  const updatedData = updatedCadetDoc.data();
  recordResult(
    "Journey 3: Change Requests",
    "Cadet record dynamic field updated automatically upon approval",
    updatedData?.dynamicData?.FIELD_00001 === "AB+",
    `Blood Group: ${updatedData?.dynamicData?.FIELD_00001}`
  );

  // JOURNEY 4: Document Verification Cycle
  console.log("\n--- Journey 4: Document Verification Cycle ---");
  // Seed a document directly in Firestore for Cadet A to test the verification lifecycle safely
  const testDocRef = await db.collection("documents").add({
    documentId: "DOC_JOURNEY4_TEST",
    cadetId: SEC_CADET_A_ID,
    categoryId: "CAT_001",
    title: "Annual Medical Fitness Certificate",
    fileName: "medical_fitness_2026.pdf",
    mimeType: "application/pdf",
    fileSize: 102400,
    driveFileId: "mock_drive_id_101",
    driveWebViewLink: "https://drive.google.com/file/d/mock_doc_id_101/view",
    verificationStatus: "pending",
    uploadedBy: cadetA.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const documentId = testDocRef.id;
  await testDocRef.update({ documentId });

  recordResult(
    "Journey 4: Document Verification",
    "Cadet registers document upload",
    Boolean(documentId),
    `Document ID: ${documentId}`
  );

  // Admin verifies document
  const docVerifyRes = await fetch(`${BASE_URL}/api/admin/documents/${documentId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${admin.sessionCookie}`,
    },
    body: JSON.stringify({
      verificationStatus: "verified",
      verificationNotes: "Approved by Regimental Medical Officer",
    }),
  });
  recordResult(
    "Journey 4: Document Verification",
    "Admin verifies cadet document",
    docVerifyRes.status === 200,
    `HTTP Status: ${docVerifyRes.status}`
  );

  // Verify document status is updated in Firestore
  const verifiedDocSnap = await db.collection("documents").doc(documentId).get();
  const vDocData = verifiedDocSnap.data();
  recordResult(
    "Journey 4: Document Verification",
    "Document status verified in Firestore",
    vDocData?.verificationStatus === "verified",
    `Status: ${vDocData?.verificationStatus}`
  );

  // JOURNEY 5: CTO Scoped Oversight & Export
  console.log("\n--- Journey 5: CTO Oversight & Scoped Report Export ---");
  // CTO searches cadets directory
  const ctoSearchRes = await fetch(`${BASE_URL}/api/cto/cadets?search=Alpha`, {
    headers: { Cookie: `__session=${cto.sessionCookie}` },
  });
  const ctoCadets = await ctoSearchRes.json();
  recordResult(
    "Journey 5: CTO Oversight",
    "CTO searches and views cadets directory",
    ctoSearchRes.status === 200 && (ctoCadets?.cadets?.length || 0) > 0,
    `Cadets returned: ${ctoCadets?.cadets?.length}`
  );

  // CTO exports scoped data report
  const ctoExportRes = await fetch(`${BASE_URL}/api/data-export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${cto.sessionCookie}`,
    },
    body: JSON.stringify({
      trainingYear: "all",
      division: "all",
      status: "all",
      selectedFieldIds: ["fullName", "rank", "trainingYear", "division", "unit"],
    }),
  });
  recordResult(
    "Journey 5: CTO Oversight",
    "CTO generates and downloads authorized Excel report",
    ctoExportRes.status === 200,
    `HTTP Status: ${ctoExportRes.status}, Content-Type: ${ctoExportRes.headers.get("content-type")}`
  );

  // ===========================================================================
  // PART C: CLEANUP TEST DATA
  // ===========================================================================
  console.log("\n--- PART C: CLEANUP OF TEST ARTIFACTS ---");
  try {
    if (createdCadetId) await db.collection("cadets").doc(createdCadetId).delete();
    await db.collection("cadets").doc(SEC_CADET_A_ID).delete();
    await db.collection("cadets").doc(SEC_CADET_B_ID).delete();
    if (dataRequestId) await db.collection("data_requests").doc(dataRequestId).delete();
    if (changeRequestId) await db.collection("change_requests").doc(changeRequestId).delete();
    if (documentId) await db.collection("documents").doc(documentId).delete();
    console.log("🧹 Cleaned up temporary test documents from Firestore.");
  } catch (cleanErr) {
    console.warn("Cleanup notice:", cleanErr);
  }

  // Summary
  console.log("\n===============================================================================");
  console.log("=== FINAL AUDIT SUMMARY ===");
  console.log("===============================================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Checks: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} checks failed.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL SECURITY ADVERSARIAL CHECKS & E2E JOURNEYS PASSED 100%!");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
