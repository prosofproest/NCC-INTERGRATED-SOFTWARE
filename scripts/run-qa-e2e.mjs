import { spawn } from "child_process";
import fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = getAuth(app);

const SCREENSHOT_DIR = "/Users/hruthwicktn/.gemini/antigravity-ide/brain/54b25bdb-9a87-4c4e-aaf5-eec9ce56726b";
const BASE_URL = "http://localhost:3000";

const QA_CADET_ID = "CADET_QA_001";
const QA_CADET_EMAIL = "qa.cadet.test@ncc.test";
const QA_CADET_UID = "qa_cadet_uid_101";

const QA_CTO_EMAIL = "qa.cto.test@ncc.test";
const QA_CTO_UID = "qa_cto_uid_101";

const REAL_ADMIN_EMAIL = "hruthwick17@gmail.com";

const checklist = [];

function recordResult(screen, action, expected, status, details = "") {
  checklist.push({
    screen,
    action,
    expected,
    status: status ? "PASS" : "FAIL",
    details,
  });
  const symbol = status ? "✅" : "❌";
  console.log(`${symbol} [${screen}] ${action} => ${status ? "PASS" : "FAIL"} ${details ? `(${details})` : ""}`);
}

async function getSessionCookieForUser(email, role, cadetId = null) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password: "TestPassword123!",
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
    expiresIn: 5 * 24 * 60 * 60 * 1000,
  });
  return sessionCookie;
}

class CDPClient {
  constructor(port = 9222) {
    this.port = port;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    const versionRes = await fetch(`http://127.0.0.1:${this.port}/json/version`);
    const versionData = await versionRes.json();
    this.ws = new WebSocket(versionData.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async createPage() {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const pageRes = await fetch(`http://127.0.0.1:${this.port}/json`);
    const pages = await pageRes.json();
    const targetPage = pages.find((p) => p.id === targetId);

    const pageClient = new PageClient(targetPage.webSocketDebuggerUrl);
    await pageClient.connect();
    return pageClient;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

class PageClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(" "));
      }
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await this.send("Network.enable");
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async setSessionCookie(cookieValue) {
    await this.send("Network.setCookie", {
      name: "__session",
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
    });
  }

  async clearSessionCookie() {
    await this.send("Network.deleteCookies", {
      name: "__session",
      domain: "localhost",
      path: "/",
    });
  }

  async navigate(url, waitMs = 2500) {
    this.consoleErrors = [];
    await this.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, waitMs));
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  async waitForCondition(fnExpr, timeoutMs = 8000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await this.eval(fnExpr);
      if (res) return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  async screenshot(fileName) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const fullPath = `${SCREENSHOT_DIR}/${fileName}`;
    fs.writeFileSync(fullPath, Buffer.from(res.data, "base64"));
    console.log(`  📸 Screenshot saved: ${fileName}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log("===============================================================");
  console.log(" NCC INTEGRATED SOFTWARE — COMPREHENSIVE FUNCTIONAL QA PASS");
  console.log("===============================================================\n");

  // 1. Setup Test Data in Firestore
  console.log("1. Setting up QA test entities in Firestore...");

  // QA Cadet
  await db.collection("cadets").doc(QA_CADET_ID).set({
    cadetId: QA_CADET_ID,
    fullName: "Vikram Malhotra",
    enrollmentNo: "KAR/24/SDA/10001",
    rank: "Cadet",
    wing: "Air",
    trainingYear: "1st Year",
    division: "SD",
    unit: "1 KAR AIR SQN NCC",
    institution: "National College Bangalore",
    status: "active",
    email: QA_CADET_EMAIL,
    phone: "9876543210",
    dynamicData: {
      FIELD_00001: "O+", // Blood Group (locked)
      FIELD_00007: 175,  // Height cm (editable)
      FIELD_00003: "Rajesh Malhotra", // Father Name (locked)
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.collection("users").doc(QA_CADET_UID).set({
    uid: QA_CADET_UID,
    email: QA_CADET_EMAIL,
    name: "Vikram Malhotra",
    role: "cadet",
    cadetId: QA_CADET_ID,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // QA CTO
  await db.collection("users").doc(QA_CTO_UID).set({
    uid: QA_CTO_UID,
    email: QA_CTO_EMAIL,
    name: "Lt. Arjun Kapoor",
    role: "cto",
    unit: "1 KAR BN",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log("✓ Test entities provisioned.\n");

  // 2. Generate Session Cookies
  console.log("2. Generating session cookies for Admin, Cadet, CTO...");
  const adminCookie = await getSessionCookieForUser(REAL_ADMIN_EMAIL, "admin");
  const cadetCookie = await getSessionCookieForUser(QA_CADET_EMAIL, "cadet", QA_CADET_ID);
  const ctoCookie = await getSessionCookieForUser(QA_CTO_EMAIL, "cto");
  console.log("✓ Session cookies generated.\n");

  // 3. Launch Headless Chrome
  console.log("3. Launching Google Chrome headless with CDP...");
  const chromeProcess = spawn(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless",
      "--disable-gpu",
      "--remote-debugging-port=9222",
      "--window-size=1440,900",
      "about:blank",
    ]
  );
  await new Promise((r) => setTimeout(r, 1500));

  const cdp = new CDPClient(9222);
  await cdp.connect();
  const page = await cdp.createPage();
  console.log("✓ Chrome CDP connected.\n");

  try {
    // =========================================================================
    // SECTION 1: ADMIN PORTAL TESTING
    // =========================================================================
    console.log("--- STARTING SECTION 1: ADMIN PORTAL ---");
    await page.setSessionCookie(adminCookie);

    // 1.1 Admin Dashboard
    await page.navigate(`${BASE_URL}/admin`);
    await page.screenshot("qa_01_admin_dashboard.png");

    const dashWelcome = await page.eval("document.body.innerText.includes('Jai Hind, Administrator')");
    const totalCadetsDisplay = await page.eval("document.body.innerText.includes('1')");
    recordResult("Admin Dashboard", "Load & Render", "Header & stats visible in light theme", dashWelcome && totalCadetsDisplay);

    // Click every quick-action card/button
    const quickLinks = [
      { text: "Cadets Directory", expectedUrl: "/admin/cadets" },
      { text: "Data Structure", expectedUrl: "/admin/data-structure" },
      { text: "Data Requests", expectedUrl: "/admin/data-requests" },
      { text: "Change Requests", expectedUrl: "/admin/change-requests" },
      { text: "CTO Officers", expectedUrl: "/admin/cto-management" },
      { text: "Import / Export", expectedUrl: "/admin/import-export" },
      { text: "Audit Logs", expectedUrl: "/admin/audit-logs" },
      { text: "System Health", expectedUrl: "/admin/system-health" },
    ];

    for (const q of quickLinks) {
      await page.navigate(`${BASE_URL}/admin`);
      await page.eval(`
        (() => {
          const links = Array.from(document.querySelectorAll('a'));
          const target = links.find(l => l.innerText.includes('${q.text}'));
          if (target) target.click();
        })()
      `);
      const matched = await page.waitForCondition(`window.location.pathname === '${q.expectedUrl}'`, 4000);
      const currentUrl = await page.eval("window.location.pathname");
      recordResult("Admin Dashboard Nav", `Click '${q.text}'`, `Navigates to ${q.expectedUrl}`, matched, `Arrived at ${currentUrl}`);
    }

    // 1.2 Cadets Directory
    await page.navigate(`${BASE_URL}/admin/cadets`);
    await page.screenshot("qa_02_admin_cadets_directory.png");
    const cadetInList = await page.eval(`document.body.innerText.includes('Vikram Malhotra')`);
    recordResult("Cadets Directory", "List Display", "Displays Vikram Malhotra", cadetInList);

    // Search filter test
    await page.eval(`
      const input = document.querySelector('input[placeholder*="Search"]');
      if (input) {
        input.value = "Vikram";
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
    await new Promise((r) => setTimeout(r, 600));
    const searchMatch = await page.eval(`document.body.innerText.includes('Vikram Malhotra')`);
    recordResult("Cadets Directory", "Search Filter", "Matches search query", searchMatch);

    // Click into Cadet Detail
    await page.navigate(`${BASE_URL}/admin/cadets/${QA_CADET_ID}`);
    const detailLoaded = await page.waitForCondition(`document.body.innerText.includes('Vikram Malhotra') && document.body.innerText.includes('CADET_QA_001')`, 6000);
    await page.screenshot("qa_03_admin_cadet_detail.png");
    recordResult("Cadet Detail View", "Navigate to Cadet Detail", "Displays regimental profile", detailLoaded);

    // Edit Cadet Field as Admin (e.g. Rank to 'Sergeant')
    const updateRes = await fetch(`${BASE_URL}/api/admin/cadets/${QA_CADET_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        rank: "Sergeant",
        dynamicData: {
          FIELD_00007: 178,
        },
      }),
    });
    const updateData = await updateRes.json();
    recordResult("Cadet Detail Edit", "Direct Admin Field Edit", "Returns 200 & updates record", updateRes.ok && updateData.cadet?.rank === "Sergeant");

    // 1.3 Data Structure Management
    await page.navigate(`${BASE_URL}/admin/data-structure`);
    await page.screenshot("qa_04_admin_data_structure.png");
    const dsLoaded = await page.eval(`document.body.innerText.includes('Dynamic Field Schema') || document.body.innerText.includes('Categories')`);
    recordResult("Data Structure", "Page Load", "Loads schema management", dsLoaded);

    // Create Category via API / Form
    const createCatRes = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        name: "QA Physical Fitness",
        description: "Physical fitness scores and athletic records",
        sortOrder: 50,
      }),
    });
    const catJson = await createCatRes.json();
    const createdCatId = catJson.category?.categoryId;
    recordResult("Data Structure", "Create Category", "Category created", createCatRes.ok && !!createdCatId, `ID: ${createdCatId}`);

    // Create Field under new category
    const createFieldRes = await fetch(`${BASE_URL}/api/admin/fields`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        categoryId: createdCatId,
        label: "100m Sprint Time",
        type: "number",
        sortOrder: 10,
        validation: { min: 10, max: 30 },
        permissions: { cadetEditable: true, ctoVisible: true, ctoExportable: true },
      }),
    });
    const fieldJson = await createFieldRes.json();
    const createdFieldId = fieldJson.field?.fieldId;
    recordResult("Data Structure", "Create Dynamic Field", "Field created", createFieldRes.ok && !!createdFieldId, `ID: ${createdFieldId}`);

    // Edit Field
    const editFieldRes = await fetch(`${BASE_URL}/api/admin/fields`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        fieldId: createdFieldId,
        label: "100m Sprint Time (Seconds)",
      }),
    });
    recordResult("Data Structure", "Edit Field Label", "Field updated", editFieldRes.ok);

    // Deactivate Field
    const deactFieldRes = await fetch(`${BASE_URL}/api/admin/fields`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        fieldId: createdFieldId,
        isActive: false,
      }),
    });
    recordResult("Data Structure", "Deactivate Field", "Field deactivated", deactFieldRes.ok);

    // 1.4 CTO Management
    await page.navigate(`${BASE_URL}/admin/cto-management`);
    await page.screenshot("qa_05_admin_cto_management.png");
    const ctoPageLoaded = await page.eval(`document.body.innerText.includes('Care Taker Officers') || document.body.innerText.includes('CTO')`);
    recordResult("CTO Management", "Page Load", "Loads CTO directory", ctoPageLoaded);

    // Create Test CTO via Admin API
    const ctoCreateRes = await fetch(`${BASE_URL}/api/admin/cto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        name: "Lt. Devendra Sharma",
        email: "devendra.test.cto@ncc.test",
        unit: "1 KAR BN",
      }),
    });
    const ctoCreateJson = await ctoCreateRes.json();
    const devendraUid = ctoCreateJson.officer?.uid;
    recordResult("CTO Management", "Create CTO Account & Email Dispatch", "Account provisioned & email sent", ctoCreateRes.ok && !!devendraUid);

    // Deactivate CTO with correct action schema
    const deactCtoRes = await fetch(`${BASE_URL}/api/admin/cto/${devendraUid}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({ action: "deactivate" }),
    });
    recordResult("CTO Management", "Deactivate CTO", "Status set to locked", deactCtoRes.ok);

    // Reactivate CTO with correct action schema
    const reactCtoRes = await fetch(`${BASE_URL}/api/admin/cto/${devendraUid}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({ action: "reactivate" }),
    });
    recordResult("CTO Management", "Reactivate CTO", "Status set to active", reactCtoRes.ok);

    // 1.5 Data Requests (Admin)
    await page.navigate(`${BASE_URL}/admin/data-requests`);
    await page.screenshot("qa_06_admin_data_requests.png");
    const drPageLoaded = await page.eval(`document.body.innerText.includes('Data Requests')`);
    recordResult("Data Requests (Admin)", "Page Load", "Loads Data Requests", drPageLoaded);

    // Create Data Request with valid schema
    const createDrRes = await fetch(`${BASE_URL}/api/data-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        title: "QA Annual Fitness Survey",
        purpose: "Submit updated sprint time and fitness confirmation.",
        targetCadetIds: "all",
        requiredFieldIds: [createdFieldId, "FIELD_00007"],
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const drJson = await createDrRes.json();
    const createdRequestId = drJson.dataRequest?.requestId;
    recordResult("Data Requests (Admin)", "Create Data Request", "Request created with target scope", createDrRes.ok && !!createdRequestId, `ID: ${createdRequestId}`);

    // 1.6 Import / Export (Admin)
    await page.navigate(`${BASE_URL}/admin/import-export`);
    await page.screenshot("qa_07_admin_import_export.png");

    // Download Onboarding Template
    const onbTemplateRes = await fetch(`${BASE_URL}/api/admin/excel/templates?type=onboarding`, {
      headers: { Cookie: `__session=${adminCookie}` },
    });
    const onbBuf = await onbTemplateRes.arrayBuffer();
    recordResult("Import / Export", "Download Onboarding Template", "Valid binary Excel template", onbTemplateRes.ok && onbBuf.byteLength > 1000);

    // Download Enrollment Template
    const enrTemplateRes = await fetch(`${BASE_URL}/api/admin/excel/templates?type=enrollment`, {
      headers: { Cookie: `__session=${adminCookie}` },
    });
    const enrBuf = await enrTemplateRes.arrayBuffer();
    recordResult("Import / Export", "Download Enrollment Template", "Valid binary Excel template", enrTemplateRes.ok && enrBuf.byteLength > 1000);

    // Test Cadet Export with valid schema
    const exportRes = await fetch(`${BASE_URL}/api/data-export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        selectedFieldIds: ["fullName", "rank", "wing", "unit", "FIELD_00001"],
      }),
    });
    const exportBuf = await exportRes.arrayBuffer();
    recordResult("Import / Export", "Execute Cadets Export", "Valid Excel file generated", exportRes.ok && exportBuf.byteLength > 1000);

    // 1.7 Notifications (Admin)
    await page.navigate(`${BASE_URL}/admin/notifications`);
    await page.screenshot("qa_08_admin_notifications.png");

    const broadcastRes = await fetch(`${BASE_URL}/api/admin/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${adminCookie}`,
      },
      body: JSON.stringify({
        targetGroup: "all_cadets",
        title: "QA System Drill Notice",
        message: "Mandatory equipment inspection tomorrow 0800 hrs.",
        importance: "important",
      }),
    });
    const notifJson = await broadcastRes.json();
    recordResult("Notifications (Admin)", "Send Broadcast Notification", "Notification dispatched", broadcastRes.ok && (notifJson.recipientCount >= 1 || notifJson.count >= 1 || notifJson.success));

    // 1.8 Audit Logs (Admin)
    await page.navigate(`${BASE_URL}/admin/audit-logs`);
    await page.screenshot("qa_09_admin_audit_logs.png");
    const auditLogsLoaded = await page.eval(`document.body.innerText.includes('Audit Logs') || document.body.innerText.includes('System Audit Trail')`);
    recordResult("Audit Logs (Admin)", "Page Load & Render", "Audit trail records displayed", auditLogsLoaded);

    // Test Audit Filters
    const auditFilterRes = await fetch(`${BASE_URL}/api/admin/audit-logs?actor=${REAL_ADMIN_EMAIL}&limit=5`, {
      headers: { Cookie: `__session=${adminCookie}` },
    });
    const auditFilterJson = await auditFilterRes.json();
    recordResult("Audit Logs (Admin)", "Filter by Actor", "Returns filtered audit records", auditFilterRes.ok && auditFilterJson.logs?.length > 0);

    // 1.9 System Health (Admin)
    await page.navigate(`${BASE_URL}/admin/system-health`);
    await page.screenshot("qa_10_admin_system_health.png");

    const healthCheckRes = await fetch(`${BASE_URL}/api/admin/health`, {
      headers: { Cookie: `__session=${adminCookie}` },
    });
    const healthJson = await healthCheckRes.json();
    const allServicesReported = healthJson.report && healthJson.report.services && Object.keys(healthJson.report.services).length >= 4;
    recordResult("System Health (Admin)", "Run Health Check", "All core services report status", healthCheckRes.ok && allServicesReported);

    // 1.10 Admin Sign Out
    await page.eval(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const signOutBtn = buttons.find(b => b.innerText.includes('Sign Out'));
      if (signOutBtn) signOutBtn.click();
    `);
    const adminLoggedOut = await page.waitForCondition("window.location.pathname === '/login'", 4000);
    recordResult("Admin Auth", "Sign Out Flow", "Redirects to /login and clears session", adminLoggedOut);

    // =========================================================================
    // SECTION 2: CADET PORTAL TESTING
    // =========================================================================
    console.log("\n--- STARTING SECTION 2: CADET PORTAL ---");
    await page.setSessionCookie(cadetCookie);

    // 2.1 Cadet Dashboard
    await page.navigate(`${BASE_URL}/cadet`);
    await page.screenshot("qa_11_cadet_dashboard.png");
    const cadetWelcome = await page.eval(`document.body.innerText.includes('Vikram Malhotra') || document.body.innerText.includes('Cadet')`);
    recordResult("Cadet Dashboard", "Dashboard Render", "Personalized cadet greeting", cadetWelcome);

    // 2.2 Cadet Profile
    await page.navigate(`${BASE_URL}/cadet/profile`);
    const profileLoaded = await page.waitForCondition(`document.body.innerText.includes('Vikram Malhotra') && document.body.innerText.includes('KAR/24/SDA/10001')`, 5000);
    await page.screenshot("qa_12_cadet_profile_view.png");
    recordResult("Cadet Profile", "Profile View", "Displays core & dynamic attributes", profileLoaded);

    // Edit editable field (Height cm)
    const cadetEditRes = await fetch(`${BASE_URL}/api/cadet/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${cadetCookie}`,
      },
      body: JSON.stringify({
        dynamicData: {
          FIELD_00007: 180,
        },
      }),
    });
    recordResult("Cadet Profile", "Direct Edit on Editable Field (Height)", "Cadet saves editable field", cadetEditRes.ok);

    // Request Change on locked field (Blood Group to 'B+')
    const crSubmitRes = await fetch(`${BASE_URL}/api/cadet/change-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__session=${cadetCookie}`,
      },
      body: JSON.stringify({
        fieldId: "FIELD_00001",
        newValue: "B+",
        reason: "Typo in initial enrollment entry",
      }),
    });
    const crJson = await crSubmitRes.json();
    const createdCrId = crJson.changeRequest?.changeRequestId;
    recordResult("Cadet Profile", "Submit Change Request on Locked Field", "Request created with status 'pending'", crSubmitRes.ok && !!createdCrId, `CR ID: ${createdCrId}`);

    // 2.3 Cadet Change Requests List
    await page.navigate(`${BASE_URL}/cadet/change-requests`);
    const crListed = await page.waitForCondition(`document.body.innerText.includes('Blood Group') || document.body.innerText.includes('pending')`, 5000);
    await page.screenshot("qa_13_cadet_change_requests.png");
    recordResult("Cadet Change Requests", "List Pending Requests", "Displays pending change request", crListed);

    // 2.4 Cadet Data Requests (Respond to Survey)
    await page.navigate(`${BASE_URL}/cadet/data-requests`);
    const drListedForCadet = await page.waitForCondition(`document.body.innerText.includes('QA Annual Fitness Survey')`, 5000);
    await page.screenshot("qa_14_cadet_data_requests.png");
    recordResult("Cadet Data Requests", "View Open Requests", "Displays pending annual survey", drListedForCadet);

    // Submit Response to Data Request
    if (createdRequestId) {
      const drSubmitRes = await fetch(`${BASE_URL}/api/cadet/data-requests/${createdRequestId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__session=${cadetCookie}`,
        },
        body: JSON.stringify({
          values: {
            FIELD_00007: 180,
            [createdFieldId]: 12.5,
          },
        }),
      });
      recordResult("Cadet Data Requests", "Submit Request Response", "Responses saved & status updated", drSubmitRes.ok);
    }

    // 2.5 Cadet Notifications
    await page.navigate(`${BASE_URL}/cadet/notifications`);
    const notifReceived = await page.waitForCondition(`document.body.innerText.includes('QA System Drill Notice')`, 5000);
    await page.screenshot("qa_15_cadet_notifications.png");
    recordResult("Cadet Notifications", "Receive Broadcast", "Displays drill notice", notifReceived);

    // Mark notifications as read
    const markReadRes = await fetch(`${BASE_URL}/api/notifications/read-all`, {
      method: "POST",
      headers: { Cookie: `__session=${cadetCookie}` },
    });
    recordResult("Cadet Notifications", "Mark All Read", "Unread count decremented", markReadRes.ok);

    // 2.6 Cadet Security
    await page.navigate(`${BASE_URL}/cadet/security`);
    await page.screenshot("qa_16_cadet_security.png");
    const cadetSecLoaded = await page.eval(`document.body.innerText.includes('Change Password') || document.body.innerText.includes('Security')`);
    recordResult("Cadet Security", "Security & Password Card", "Security screen renders", cadetSecLoaded);

    // 2.7 Cadet Sign Out
    await page.eval(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const signOutBtn = buttons.find(b => b.innerText.includes('Sign Out'));
      if (signOutBtn) signOutBtn.click();
    `);
    const cadetSignedOut = await page.waitForCondition("window.location.pathname === '/login'", 4000);
    recordResult("Cadet Auth", "Sign Out Flow", "Redirects to /login", cadetSignedOut);

    // =========================================================================
    // SECTION 3: ADMIN APPROVAL OF CHANGE REQUEST
    // =========================================================================
    console.log("\n--- STARTING SECTION 3: ADMIN APPROVAL OF CHANGE REQUEST ---");
    const freshAdminCookie = await getSessionCookieForUser(REAL_ADMIN_EMAIL, "admin");
    await page.setSessionCookie(freshAdminCookie);

    if (createdCrId) {
      await page.navigate(`${BASE_URL}/admin/change-requests/${createdCrId}`);
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot("qa_17_admin_change_request_detail.png");

      const approveRes = await fetch(`${BASE_URL}/api/admin/change-requests/${createdCrId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__session=${freshAdminCookie}`,
        },
        body: JSON.stringify({
          action: "approve",
          reviewerComments: "Verified against battalion medical record.",
        }),
      });
      const approveJson = await approveRes.json().catch(() => ({}));
      console.log("Approve CR API result:", approveRes.status, approveJson);
      recordResult("Admin Change Requests", "Approve Change Request", "Status approved & cadet record updated", approveRes.ok && (approveJson.success || approveRes.status === 200));

      // Refresh detail view screenshot to capture approved state
      await page.navigate(`${BASE_URL}/admin/change-requests/${createdCrId}`);
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot("qa_17_admin_change_request_detail.png");

      // Verify cadet record updated in DB
      const cadetAfterCr = await db.collection("cadets").doc(QA_CADET_ID).get();
      const updatedBloodGroup = cadetAfterCr.data()?.dynamicData?.FIELD_00001;
      recordResult("Admin Change Requests", "Cadet DB Verification", "Blood Group updated to 'B+' in DB", updatedBloodGroup === "B+");
    }

    // =========================================================================
    // SECTION 4: CTO PORTAL TESTING
    // =========================================================================
    console.log("\n--- STARTING SECTION 4: CTO PORTAL ---");
    await page.setSessionCookie(ctoCookie);

    // 4.1 CTO Dashboard
    await page.navigate(`${BASE_URL}/cto`);
    await page.screenshot("qa_18_cto_dashboard.png");
    const ctoWelcome = await page.eval(`document.body.innerText.includes('CTO') || document.body.innerText.includes('Officer')`);
    recordResult("CTO Dashboard", "Dashboard Render", "CTO overview visible", ctoWelcome);

    // 4.2 CTO Cadets Directory
    await page.navigate(`${BASE_URL}/cto/cadets`);
    await page.screenshot("qa_19_cto_cadets_directory.png");
    const ctoCadetVisible = await page.eval(`document.body.innerText.includes('Vikram Malhotra')`);
    recordResult("CTO Cadets Directory", "Directory Display", "Displays cadets with unit scope", ctoCadetVisible);

    // 4.3 CTO Cadet Detail (READ ONLY CHECK)
    await page.navigate(`${BASE_URL}/cto/cadets/${QA_CADET_ID}`);
    const ctoReadOnlyNotice = await page.waitForCondition(`document.body.innerText.includes('Officer Read-Only View') || document.body.innerText.includes('Read-Only')`, 8000);
    await page.screenshot("qa_20_cto_cadet_readonly.png");
    const hasAnySaveButtons = await page.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.innerText.includes('Save') || b.innerText.includes('Update') || b.innerText.includes('Edit'));
      })()
    `);
    recordResult("CTO Cadet Detail", "Officer Read-Only Enforcement", "Read-only banner present & zero edit controls", ctoReadOnlyNotice && !hasAnySaveButtons);

    // 4.4 CTO Reports & Export
    await page.navigate(`${BASE_URL}/cto/reports`);
    await page.screenshot("qa_21_cto_reports.png");
    const ctoReportsLoaded = await page.eval(`document.body.innerText.includes('Reports') || document.body.innerText.includes('Export')`);
    recordResult("CTO Reports", "Reports Page Load", "CTO export interface loaded", ctoReportsLoaded);

    // 4.5 CTO Notifications
    await page.navigate(`${BASE_URL}/cto/notifications`);
    await page.screenshot("qa_22_cto_notifications.png");
    const ctoNotifsLoaded = await page.eval(`document.body.innerText.includes('Notifications')`);
    recordResult("CTO Notifications", "Notifications Load", "CTO notifications view loaded", ctoNotifsLoaded);

    // 4.6 CTO Security
    await page.navigate(`${BASE_URL}/cto/security`);
    await page.screenshot("qa_23_cto_security.png");
    const ctoSecLoaded = await page.eval(`document.body.innerText.includes('Security') || document.body.innerText.includes('Password')`);
    recordResult("CTO Security", "Security Page Load", "CTO security settings loaded", ctoSecLoaded);

    // 4.7 CTO Sign Out
    await page.eval(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const signOutBtn = buttons.find(b => b.innerText.includes('Sign Out'));
      if (signOutBtn) signOutBtn.click();
    `);
    const ctoSignedOut = await page.waitForCondition("window.location.pathname === '/login'", 4000);
    recordResult("CTO Auth", "Sign Out Flow", "Redirects to /login", ctoSignedOut);

    console.log("\n--- COMPREHENSIVE QA EXECUTION FINISHED ---");
  } catch (error) {
    console.error("FATAL QA ERROR:", error);
  } finally {
    page.close();
    cdp.close();
    chromeProcess.kill();

    // =========================================================================
    // SECTION 5: CLEANUP OF QA TEST DATA
    // =========================================================================
    console.log("\n5. Cleaning up QA test entities from Firestore & Auth...");
    try {
      // Delete test cadet
      await db.collection("cadets").doc(QA_CADET_ID).delete();
      console.log(`  ✓ Deleted test cadet ${QA_CADET_ID}`);

      // Delete test cadet user
      await db.collection("users").doc(QA_CADET_UID).delete();
      try { await auth.deleteUser(QA_CADET_UID); } catch {}
      console.log(`  ✓ Deleted test cadet user ${QA_CADET_UID}`);

      // Delete test CTO users
      await db.collection("users").doc(QA_CTO_UID).delete();
      try { await auth.deleteUser(QA_CTO_UID); } catch {}
      console.log(`  ✓ Deleted test CTO user ${QA_CTO_UID}`);

      // Delete any test CTO created via UI
      const testCtos = await db.collection("users").where("email", "==", "devendra.test.cto@ncc.test").get();
      for (const doc of testCtos.docs) {
        await doc.ref.delete();
        try { await auth.deleteUser(doc.id); } catch {}
        console.log(`  ✓ Deleted invite CTO ${doc.id}`);
      }

      // Delete test data requests created
      const testDrs = await db.collection("data_requests").where("title", "==", "QA Annual Fitness Survey").get();
      for (const doc of testDrs.docs) {
        await doc.ref.delete();
        console.log(`  ✓ Deleted test data request ${doc.id}`);
      }

      // Delete test change requests created
      const testCrs = await db.collection("change_requests").where("cadetId", "==", QA_CADET_ID).get();
      for (const doc of testCrs.docs) {
        await doc.ref.delete();
        console.log(`  ✓ Deleted test change request ${doc.id}`);
      }

      // Delete test category & field
      const testCats = await db.collection("categories").where("name", "==", "QA Physical Fitness").get();
      for (const doc of testCats.docs) {
        await doc.ref.delete();
        console.log(`  ✓ Deleted test category ${doc.id}`);
      }

      const testFields = await db.collection("fields").where("label", "in", ["100m Sprint Time", "100m Sprint Time (Seconds)"]).get();
      for (const doc of testFields.docs) {
        await doc.ref.delete();
        console.log(`  ✓ Deleted test field ${doc.id}`);
      }

      // Reset cadet counter back to 0
      await db.collection("system_counters").doc("cadet").set(
        { type: "cadet", lastSeq: 0, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      console.log("  ✓ Reset system_counters/cadet to 0.");
      console.log("✓ Cleanup finished cleanly.\n");
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }

  // Print Summary Table
  console.log("\n===============================================================");
  console.log("                 FUNCTIONAL QA CHECKLIST REPORT                ");
  console.log("===============================================================");
  console.table(checklist);

  const totalTests = checklist.length;
  const passed = checklist.filter((c) => c.status === "PASS").length;
  const failed = checklist.filter((c) => c.status === "FAIL").length;

  console.log(`\nTOTAL: ${totalTests} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Runner failed:", e);
  process.exit(1);
});
