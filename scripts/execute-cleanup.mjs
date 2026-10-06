import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = getAuth(app);

const SEED_ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "hruthwick17@gmail.com").toLowerCase();

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`Collection '${collectionName}' is already empty.`);
    return 0;
  }
  const batch = db.batch();
  let count = 0;
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
  }
  await batch.commit();
  console.log(`Deleted ${count} documents from '${collectionName}'.`);
  return count;
}

async function cleanup() {
  console.log("=================================================================");
  console.log("=== EXECUTING CAREFUL PRODUCTION DATA CLEANUP ===");
  console.log("=================================================================\n");
  console.log(`Target Real Admin Email to Preserve: ${SEED_ADMIN_EMAIL}`);

  // 1. Delete cadets collection
  const deletedCadets = await deleteCollection("cadets");

  // 2. Delete data_requests collection
  const deletedDataRequests = await deleteCollection("data_requests");

  // 3. Delete change_requests collection
  const deletedChangeRequests = await deleteCollection("change_requests");

  // 4. Delete documents collection
  const deletedDocuments = await deleteCollection("documents");

  // 5. Delete notifications collection
  const deletedNotifications = await deleteCollection("notifications");

  // 6. Delete test users from Auth and Firestore (preserving SEED_ADMIN_EMAIL)
  const usersSnap = await db.collection("users").get();
  let preservedAdminCount = 0;
  let deletedUsersCount = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const email = (data.email || "").toLowerCase();
    const uid = doc.id;

    if (email === SEED_ADMIN_EMAIL) {
      console.log(`🔒 Preserved Admin Account: [${uid}] ${email}`);
      preservedAdminCount++;
      // Ensure admin role and active status
      await doc.ref.update({
        role: "admin",
        status: "active",
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Delete from Firestore
      await doc.ref.delete();
      // Delete from Firebase Auth
      try {
        await auth.deleteUser(uid);
        console.log(`🗑️ Deleted User Auth & Record: [${uid}] ${email}`);
      } catch (authErr) {
        console.warn(`Note: Auth user deletion for [${uid}]:`, authErr.message);
      }
      deletedUsersCount++;
    }
  }

  // 7. Reset System Counters
  console.log("\n--- Resetting System Sequences ---");
  const countersToReset = [
    { type: "cadet", initialSeq: 0 },
    { type: "data_request", initialSeq: 0 },
    { type: "change_request", initialSeq: 0 },
    { type: "document", initialSeq: 0 },
    { type: "notification", initialSeq: 0 },
    { type: "category", initialSeq: 4 }, // 4 categories exist (CAT_001 - CAT_004)
    { type: "field", initialSeq: 8 },    // 8 fields exist (FIELD_00001 - FIELD_00008)
  ];

  for (const c of countersToReset) {
    await db.collection("system_counters").doc(c.type).set({
      type: c.type,
      currentSequence: c.initialSeq,
      lastSeq: c.initialSeq,
      updatedAt: new Date(),
    });
    console.log(`Reset counter '${c.type}' to sequence: ${c.initialSeq}`);
  }

  console.log("\n=================================================================");
  console.log("=== CLEANUP SUMMARY ===");
  console.log("=================================================================");
  console.log(`- Cadets deleted: ${deletedCadets}`);
  console.log(`- Data Requests deleted: ${deletedDataRequests}`);
  console.log(`- Change Requests deleted: ${deletedChangeRequests}`);
  console.log(`- Documents deleted: ${deletedDocuments}`);
  console.log(`- Notifications deleted: ${deletedNotifications}`);
  console.log(`- Test Users deleted: ${deletedUsersCount}`);
  console.log(`- Admin Accounts preserved: ${preservedAdminCount}`);
  console.log(`- Categories preserved: 4 (CAT_001 to CAT_004)`);
  console.log(`- Fields preserved: 8 (FIELD_00001 to FIELD_00008)`);
  console.log(`- Audit Logs preserved: (untouched)`);
  console.log(`- System Backups preserved: (untouched)`);
}

cleanup().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
