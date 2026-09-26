import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

const db = getFirestore(app);

async function testAudit() {
  console.log("Testing live audit log write to Firestore...");

  // Generate sequence number from system_counters
  const counterRef = db.collection("system_counters").doc("audit_log");
  const nextSeq = await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    let nextVal = 1;
    if (doc.exists && typeof doc.data()?.currentSequence === "number") {
      nextVal = doc.data().currentSequence + 1;
    }
    t.set(counterRef, { type: "audit_log", currentSequence: nextVal }, { merge: true });
    return nextVal;
  });

  const logId = `LOG_${String(nextSeq).padStart(7, "0")}`;
  const timestamp = new Date().toISOString();

  const auditEntry = {
    logId,
    actorId: "p3ieK2yvkPV4oLz8rMkQuRmR5Om1",
    actorEmail: "admin@organization.org",
    actorRole: "admin",
    action: "SYSTEM_SECURITY_INITIALIZED",
    entityType: "system",
    entityId: "SYS_SECURITY_STAGE_5",
    metadata: {
      stage: "Stage 5: Server-Side Authorization & Security",
      rateLimitingEnabled: true,
      securityHeadersConfigured: true,
    },
    ipAddress: "127.0.0.1",
    userAgent: "Antigravity/Stage5-Verifier",
    timestamp,
  };

  await db.collection("audit_logs").doc(logId).set(auditEntry);
  console.log("✓ Audit log successfully written with Log ID:", logId);

  // Read back and confirm
  const retrieved = await db.collection("audit_logs").doc(logId).get();
  console.log("\nVerified Firestore Document Data:");
  console.log(JSON.stringify(retrieved.data(), null, 2));
}

testAudit().catch(console.error);
