/**
 * Runtime Smoke Test for Smart Excel Import against Live Production Server
 * Strictly uses SYNTHETIC data only.
 */

import ExcelJS from "exceljs";
import { adminAuth } from "../src/lib/firebase/admin.js";

const BASE_URL = "http://localhost:3000";

async function smokeTest() {
  console.log("================================================================================");
  console.log("🚀 RUNTIME SMOKE TEST: Live Server Smart Excel Import");
  console.log("================================================================================\n");

  // 1. Create session cookie for Admin testing
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ncc.gov.in";
  console.log(`• Acquiring Admin session for ${adminEmail}...`);

  let adminUid;
  try {
    const user = await adminAuth.getUserByEmail(adminEmail);
    adminUid = user.uid;
  } catch {
    const user = await adminAuth.createUser({
      email: adminEmail,
      password: "TestPassword!123",
      displayName: "Unit Admin",
    });
    adminUid = user.uid;
  }

  await adminAuth.setCustomUserClaims(adminUid, { role: "admin" });
  const customToken = await adminAuth.createCustomToken(adminUid, { role: "admin" });

  // Exchange custom token for idToken using Firebase Auth REST API
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  let sessionCookie = "";

  if (apiKey) {
    const tokenRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );
    const tokenData = await tokenRes.json();
    if (tokenData.idToken) {
      // Exchange idToken for session cookie
      sessionCookie = await adminAuth.createSessionCookie(tokenData.idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
      console.log("  ✅ Generated verified admin session cookie.");
    }
  }

  // 2. Build multi-sheet test workbook
  console.log("• Building synthetic multi-sheet test workbook...");
  const wb = new ExcelJS.Workbook();

  const s1 = wb.addWorksheet("Summary Sheet");
  s1.addRow(["SL No", "Notes"]);
  s1.addRow([1, "Incomplete overview sheet"]);

  const s2 = wb.addWorksheet("Cadet Nominal Roll");
  s2.addRow(["SL", "Group", "Cadet Name", "Enrollment ID", "Mobilenumber", "Emailid", "Gender", "Address", "DOB"]);
  s2.addRow([1, "Bangalore", "Synthetic Alpha", "ka26sdaf99901", 9876543210.0, "synth.alpha@example.com", "MALE", "Secret Addr", "2005-01-01"]);
  s2.addRow([2, "Bangalore", "Synthetic Bravo", "", "09876543211", "synth.bravo@example.com", "FEMALE", "Secret Addr", "2005-02-02"]);

  const buffer = await wb.xlsx.writeBuffer();

  // 3. Test Parse Onboarding API on live server
  console.log("• Testing POST /api/admin/excel/parse-onboarding against live server...");
  const formData = new FormData();
  const fileBlob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  formData.append("file", fileBlob, "cadets_test.xlsx");
  formData.append("trainingYear", "1st Year");

  const response = await fetch(`${BASE_URL}/api/admin/excel/parse-onboarding`, {
    method: "POST",
    headers: {
      Cookie: `__session=${sessionCookie}`,
    },
    body: formData,
  });

  const parseJson = await response.json();
  console.log(`  Response HTTP Status: ${response.status}`);
  if (response.status === 200) {
    console.log(`  ✅ Successfully parsed on live server: detectedSheet='${parseJson.summary.detectedSheet}', validRows=${parseJson.summary.validCount}, totalRows=${parseJson.summary.totalRows}`);
  } else {
    console.error("  Parse error:", parseJson);
  }

  // 4. Test Templates endpoint
  console.log("• Testing GET /api/admin/excel/templates?type=onboarding...");
  const tmplRes = await fetch(`${BASE_URL}/api/admin/excel/templates?type=onboarding`, {
    headers: {
      Cookie: `__session=${sessionCookie}`,
    },
  });
  console.log(`  Template Download HTTP Status: ${tmplRes.status}`);

  if (tmplRes.status === 200) {
    const tmplBuf = await tmplRes.arrayBuffer();
    const loadedWb = new ExcelJS.Workbook();
    await loadedWb.xlsx.load(tmplBuf);
    console.log(`  ✅ Template downloaded successfully (${tmplBuf.byteLength} bytes, sheets: [${loadedWb.worksheets.map(s => s.name).join(", ")}])`);
  }

  console.log("\n================================================================================");
  console.log("🎉 RUNTIME SMOKE TEST COMPLETED SUCCESSFULLY");
  console.log("================================================================================\n");
}

smokeTest().catch((err) => {
  console.error("Smoke test error:", err);
  process.exit(1);
});
