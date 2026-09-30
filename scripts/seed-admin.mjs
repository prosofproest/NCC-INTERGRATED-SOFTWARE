import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
const seedEmail = process.env.SEED_ADMIN_EMAIL;

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Error: Missing Firebase Admin credentials in environment variables.");
  console.error("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

if (!seedEmail || !seedEmail.includes("@")) {
  console.error("❌ Error: SEED_ADMIN_EMAIL is missing or invalid in environment variables.");
  process.exit(1);
}

privateKey = privateKey.replace(/\\n/g, "\n");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

const auth = getAuth(app);
const db = getFirestore(app);

async function seedAdmin() {
  console.log(`\n======================================================`);
  console.log(` NCC DATA SYSTEM — ADMIN BOOTSTRAP INITIALIZATION`);
  console.log(`======================================================`);
  console.log(`Target Seed Admin Email: ${seedEmail}`);

  const normalizedEmail = seedEmail.trim().toLowerCase();

  try {
    let user;
    const defaultPassword = process.argv[2] || "AdminPassword123!";

    try {
      user = await auth.getUserByEmail(normalizedEmail);
      console.log(`✓ Existing Firebase Auth user found with UID: ${user.uid}`);
      // Update password to ensure user can always log in with the seeded password
      await auth.updateUser(user.uid, {
        password: defaultPassword,
      });
      console.log(`✓ Password updated in Firebase Auth.`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`• Creating new Firebase Auth user for ${normalizedEmail}...`);
        user = await auth.createUser({
          email: normalizedEmail,
          password: defaultPassword,
          emailVerified: true,
          displayName: "System Administrator",
        });
        console.log(`✓ Created new user with UID: ${user.uid}`);
      } else {
        throw err;
      }
    }

    // 1. Assign custom claims: role: 'admin'
    console.log(`• Assigning 'admin' custom claim...`);
    await auth.setCustomUserClaims(user.uid, {
      role: "admin",
    });
    console.log(`✓ Custom claim { role: 'admin' } assigned.`);

    // 2. Upsert Firestore user record
    console.log(`• Updating Firestore user profile in collection 'users'...`);
    const userDocRef = db.collection("users").doc(user.uid);
    const existingDoc = await userDocRef.get();

    const timestamp = new Date().toISOString();
    const userData = {
      uid: user.uid,
      email: normalizedEmail,
      name: "System Administrator",
      role: "admin",
      mustChangePassword: false,
      updatedAt: timestamp,
      ...(existingDoc.exists ? {} : { createdAt: timestamp }),
    };

    await userDocRef.set(userData, { merge: true });
    console.log(`✓ Firestore user profile updated.`);

    console.log(`\n======================================================`);
    console.log(`🎉 SUCCESS: Admin account bootstrap completed!`);
    console.log(`Email:    ${normalizedEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log(`Role:     admin`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error(`\n❌ Failed to bootstrap admin account:`, error);
    process.exit(1);
  }
}

seedAdmin();
