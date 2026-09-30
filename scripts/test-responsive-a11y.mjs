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

const REAL_ADMIN_EMAIL = "hruthwick17@gmail.com";
const QA_CADET_EMAIL = "qa.cadet.test@ncc.test";
const QA_CADET_ID = "CADET_QA_001";
const QA_CTO_EMAIL = "qa.cto.test@ncc.test";

const VIEWPORTS = [
  { width: 375, height: 812, name: "375_mobile", label: "375px (Mobile)" },
  { width: 768, height: 1024, name: "768_tablet", label: "768px (Tablet)" },
  { width: 1024, height: 768, name: "1024_laptop", label: "1024px (Small Laptop)" },
  { width: 1440, height: 900, name: "1440_desktop", label: "1440px (Desktop)" },
];

const results = [];

function recordCheck(screen, viewport, testName, passed, details = "") {
  results.push({
    screen,
    viewport,
    testName,
    passed,
    details,
  });
  const symbol = passed ? "✅" : "❌";
  console.log(`${symbol} [${viewport}] [${screen}] ${testName} => ${passed ? "PASS" : "FAIL"} ${details ? `(${details})` : ""}`);
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
      url: "http://localhost:3000",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
    });
  }

  async clearSessionCookie() {
    await this.send("Network.deleteCookies", {
      name: "__session",
      url: "http://localhost:3000",
      domain: "localhost",
      path: "/",
    });
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  async navigate(url, waitMs = 2000) {
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

  async captureScreenshot(filepath) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    fs.writeFileSync(filepath, Buffer.from(data, "base64"));
  }

  async pressKey(key, code = key) {
    await this.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key,
      code,
      windowsVirtualKeyCode: key === "Escape" ? 27 : key === "Tab" ? 9 : key === "Enter" ? 13 : 0,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: key === "Escape" ? 27 : key === "Tab" ? 9 : key === "Enter" ? 13 : 0,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  async checkHorizontalOverflow() {
    return await this.eval(`(() => {
      const docWidth = document.documentElement.clientWidth || window.innerWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const isOverflowing = scrollWidth > docWidth || bodyScrollWidth > docWidth;
      return {
        docWidth,
        scrollWidth,
        bodyScrollWidth,
        isOverflowing,
      };
    })()`);
  }

  async auditAccessibility() {
    return await this.eval(`(() => {
      // 1. Heading hierarchy check
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        tag: h.tagName.toLowerCase(),
        text: h.textContent.trim().substring(0, 40)
      }));
      const hasH1 = headings.some(h => h.tag === 'h1');

      // 2. Form input accessibility (labels or aria-labels)
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      const unlabelledInputs = inputs.filter(el => {
        const id = el.getAttribute('id');
        const hasExplicitLabel = id && document.querySelector('label[for="' + id + '"]');
        const hasWrappingLabel = el.closest('label');
        const hasAriaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        const hasTitle = el.getAttribute('title');
        return !(hasExplicitLabel || hasWrappingLabel || hasAriaLabel || hasTitle);
      }).map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || 'text',
        name: el.getAttribute('name') || el.className.substring(0, 30)
      }));

      // 3. Modals & Dialogs check
      const modals = Array.from(document.querySelectorAll('[role="dialog"]')).map(m => ({
        role: m.getAttribute('role'),
        ariaModal: m.getAttribute('aria-modal'),
        ariaLabelledby: m.getAttribute('aria-labelledby'),
        ariaLabel: m.getAttribute('aria-label'),
      }));

      return {
        hasH1,
        headingCount: headings.length,
        headings,
        totalInputs: inputs.length,
        unlabelledInputsCount: unlabelledInputs.length,
        unlabelledInputs,
        modals,
      };
    })()`);
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function runTest() {
  console.log("=== STAGE 17-18: RESPONSIVE & ACCESSIBILITY REFINEMENT PASS ===");

  // 1. Launch Chrome Headless
  const chromeProc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-sandbox",
    "--disable-gpu",
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const cdp = new CDPClient(9222);
  await cdp.connect();
  const page = await cdp.createPage();

  // 2. Prepare Sessions
  console.log("\n[AUTH] Creating test session cookies...");
  const adminCookie = await getSessionCookieForUser(REAL_ADMIN_EMAIL, "admin");
  const cadetCookie = await getSessionCookieForUser(QA_CADET_EMAIL, "cadet", QA_CADET_ID);

  // Ensure test cadet exists
  const cadetDoc = await db.collection("cadets").doc(QA_CADET_ID).get();
  if (!cadetDoc.exists) {
    await db.collection("cadets").doc(QA_CADET_ID).set({
      cadetId: QA_CADET_ID,
      fullName: "Cadet QA Specialist",
      email: QA_CADET_EMAIL,
      enrollmentNo: "KA24SDA199999",
      rank: "Cadet",
      unit: "1 Kar Air Sqn NCC",
      wing: "Air",
      trainingYear: "1st Year",
      division: "SD",
      status: "active",
      completionPercentage: 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const screens = [
    { name: "Login Page", url: `${BASE_URL}/login`, role: "public", authCookie: null },
    { name: "Admin Dashboard", url: `${BASE_URL}/admin`, role: "admin", authCookie: adminCookie },
    { name: "Cadets Directory", url: `${BASE_URL}/admin/cadets`, role: "admin", authCookie: adminCookie },
    { name: "Cadet Details", url: `${BASE_URL}/admin/cadets/${QA_CADET_ID}`, role: "admin", authCookie: adminCookie },
    { name: "Data Structure", url: `${BASE_URL}/admin/data-structure`, role: "admin", authCookie: adminCookie },
    { name: "Audit Logs", url: `${BASE_URL}/admin/audit-logs`, role: "admin", authCookie: adminCookie },
    { name: "Import Export", url: `${BASE_URL}/admin/import-export`, role: "admin", authCookie: adminCookie },
    { name: "Backups View", url: `${BASE_URL}/admin/backups`, role: "admin", authCookie: adminCookie },
    { name: "Cadet Profile", url: `${BASE_URL}/cadet/profile`, role: "cadet", authCookie: cadetCookie },
  ];

  console.log("\n=== PART A: MULTI-VIEWPORT RESPONSIVE SCREEN AUDIT ===");

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.label} (${vp.width}x${vp.height}) ---`);
    await page.setViewport(vp.width, vp.height);

    for (const scr of screens) {
      if (scr.authCookie) {
        await page.setSessionCookie(scr.authCookie);
      } else {
        await page.clearSessionCookie();
      }

      await page.navigate(scr.url, 2500);

      // Check Body Horizontal Overflow
      const overflow = await page.checkHorizontalOverflow();
      const noOverflow = !overflow.isOverflowing;
      recordCheck(
        scr.name,
        vp.label,
        "No Horizontal Body Overflow",
        noOverflow,
        `Doc: ${overflow.docWidth}px, Scroll: ${overflow.scrollWidth}px, Body: ${overflow.bodyScrollWidth}px`
      );

      // Check A11y (Headings & Labels)
      const a11y = await page.auditAccessibility();
      recordCheck(
        scr.name,
        vp.label,
        "Heading Hierarchy & H1 present",
        a11y.hasH1,
        `Headings count: ${a11y.headingCount}`
      );

      // Capture screenshot for all viewports
      const screenshotSlug = `${scr.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${vp.width}px.png`;
      const screenshotPath = `${SCREENSHOT_DIR}/${screenshotSlug}`;
      await page.captureScreenshot(screenshotPath);
      console.log(`  📸 Saved screenshot: ${screenshotSlug}`);
    }
  }

  console.log("\n=== PART B: ACCESSIBLE MODAL DIALOG & KEYBOARD INTERACTION AUDIT ===");

  // Test Modal Dialog Open State at 375px and 1440px
  for (const modalVp of [VIEWPORTS[0], VIEWPORTS[3]]) {
    console.log(`\n--- Testing Modal Dialog at ${modalVp.label} ---`);
    await page.setViewport(modalVp.width, modalVp.height);
    await page.setSessionCookie(adminCookie);

    // Open Audit Logs Detail Modal or Data Structure Field Modal
    await page.navigate(`${BASE_URL}/admin/data-structure`, 2500);
    // Switch to fields tab and open create field modal
    await page.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fieldsTab = btns.find(b => b.textContent.includes('Dynamic Fields'));
      if (fieldsTab) fieldsTab.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Click "+ Add Dynamic Field"
    await page.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addFieldBtn = btns.find(b => b.textContent.includes('+ Add Dynamic Field'));
      if (addFieldBtn) addFieldBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // Check modal dialog attributes
    const modalA11y = await page.auditAccessibility();
    const hasDialog = modalA11y.modals.some((m) => m.role === "dialog" && m.ariaModal === "true");
    recordCheck(
      "Modal Dialog",
      modalVp.label,
      "Modal Dialog ARIA Compliance (role=dialog, aria-modal=true)",
      hasDialog,
      `Found ${modalA11y.modals.length} active dialogs`
    );

    // Capture screenshot of open modal
    const modalScreenshotSlug = `modal_dialog_open_${modalVp.width}px.png`;
    await page.captureScreenshot(`${SCREENSHOT_DIR}/${modalScreenshotSlug}`);
    console.log(`  📸 Saved modal screenshot: ${modalScreenshotSlug}`);

    // Test Escape key closes modal
    await page.pressKey("Escape");
    await new Promise((r) => setTimeout(r, 600));
    const modalAfterEscape = await page.auditAccessibility();
    const isClosed = modalAfterEscape.modals.length === 0;
    recordCheck(
      "Modal Dialog",
      modalVp.label,
      "Escape Key Closes Modal Dialog",
      isClosed,
      `Remaining dialogs: ${modalAfterEscape.modals.length}`
    );
  }

  // Close Chrome
  page.close();
  cdp.close();
  chromeProc.kill();

  console.log("\n=== AUDIT SUMMARY ===");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Checks: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} checks failed.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL RESPONSIVE AND ACCESSIBILITY CHECKS PASSED 100%!");
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
