import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

const BACKUP_COLLECTIONS = [
  "cadets",
  "categories",
  "fields",
  "data_requests",
  "change_requests",
  "documents",
  "users",
  "notifications",
  "system_counters",
  "audit_logs",
];

async function main() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupId = `BACKUP_${timestampStr}`;
  const createdAt = now.toISOString();

  console.log("=== TAKING FULL SYSTEM BACKUP BEFORE CLEANUP ===");
  const snapshot = {};
  const recordCounts = {};
  let totalRecords = 0;

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const colSnap = await db.collection(colName).get();
      const docsData = [];
      for (const doc of colSnap.docs) {
        docsData.push({
          _docId: doc.id,
          ...doc.data(),
        });
      }
      snapshot[colName] = docsData;
      recordCounts[colName] = docsData.length;
      totalRecords += docsData.length;
    } catch (err) {
      console.error(`Warning: Failed to backup collection ${colName}:`, err);
      snapshot[colName] = [];
      recordCounts[colName] = 0;
    }
  }

  const jsonStr = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(jsonStr, "utf8");

  const backupDoc = {
    backupId,
    createdAt,
    createdBy: process.env.SEED_ADMIN_EMAIL || "system_admin",
    recordCounts,
    totalRecords,
    sizeBytes,
    status: "completed",
    retentionPolicy: "Keep latest 10 versions",
    snapshot,
  };

  await db.collection("system_backups").doc(backupId).set(backupDoc);
  console.log(`✅ Backup created successfully: ${backupId} (${totalRecords} records, ${sizeBytes} bytes)`);
  console.log("Record counts by collection:", JSON.stringify(recordCounts, null, 2));

  // Inspect Categories & Fields
  console.log("\n=== INSPECTING EXISTING CATEGORIES ===");
  const catSnap = await db.collection("categories").orderBy("sortOrder", "asc").get();
  console.log(`Found ${catSnap.size} categories:`);
  for (const doc of catSnap.docs) {
    const d = doc.data();
    console.log(`- [${doc.id}] ${d.name} (sortOrder: ${d.sortOrder}, isSystem: ${d.isSystem}, isActive: ${d.isActive})`);
  }

  console.log("\n=== INSPECTING EXISTING FIELDS ===");
  const fieldSnap = await db.collection("fields").orderBy("categoryId", "asc").get();
  console.log(`Found ${fieldSnap.size} fields:`);
  for (const doc of fieldSnap.docs) {
    const d = doc.data();
    console.log(`- [${doc.id}] "${d.label}" (category: ${d.categoryId}, type: ${d.type}, sortOrder: ${d.sortOrder}, cadetEditable: ${d.permissions?.cadetEditable})`);
  }

  console.log("\n=== INSPECTING USERS COLLECTION ===");
  const userSnap = await db.collection("users").get();
  console.log(`Found ${userSnap.size} user accounts in Firestore:`);
  for (const doc of userSnap.docs) {
    const d = doc.data();
    console.log(`- [${doc.id}] Email: ${d.email}, Role: ${d.role}, Name: ${d.name || d.fullName || "N/A"}`);
  }

  console.log("\n=== INSPECTING SYSTEM COUNTERS ===");
  const counterSnap = await db.collection("system_counters").get();
  for (const doc of counterSnap.docs) {
    console.log(`- [${doc.id}] value: ${JSON.stringify(doc.data())}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
