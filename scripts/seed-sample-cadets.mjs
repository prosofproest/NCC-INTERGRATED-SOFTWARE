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

async function seedData() {
  console.log("==================================================");
  console.log("🌱 SEEDING TEST DATA FOR ADMIN FOUNDATION");
  console.log("==================================================");

  const timestamp = new Date().toISOString();

  // 1. Categories
  const categories = [
    {
      categoryId: "CAT_001",
      name: "Personal Information",
      description: "Cadet personal demographic and emergency contact details",
      sortOrder: 1,
      isSystem: true,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      categoryId: "CAT_002",
      name: "Academic Details",
      description: "Institution enrollment, course of study, and academic year",
      sortOrder: 2,
      isSystem: true,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      categoryId: "CAT_003",
      name: "NCC Regimental Details",
      description: "Rank progression, wing affiliation, and battalion enrollment details",
      sortOrder: 3,
      isSystem: true,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      categoryId: "CAT_004",
      name: "Physical & Medical",
      description: "Physical measurements, blood group, and medical fitness profile",
      sortOrder: 4,
      isSystem: true,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  console.log("\n• Seeding 4 Core Categories...");
  for (const cat of categories) {
    await db.collection("categories").doc(cat.categoryId).set(cat, { merge: true });
    console.log(`  ✓ Category [${cat.categoryId}] ${cat.name}`);
  }

  // 2. Fields
  const fields = [
    {
      fieldId: "FIELD_00001",
      categoryId: "CAT_001",
      label: "Blood Group",
      type: "select",
      options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      validation: { required: true },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 1,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00002",
      categoryId: "CAT_001",
      label: "Date of Birth",
      type: "date",
      validation: { required: true },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 2,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00003",
      categoryId: "CAT_001",
      label: "Father / Guardian Name",
      type: "text",
      validation: { required: true },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 3,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00004",
      categoryId: "CAT_002",
      label: "Institution / College Name",
      type: "text",
      validation: { required: true },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 1,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00005",
      categoryId: "CAT_002",
      label: "Degree / Course of Study",
      type: "text",
      validation: { required: true },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 2,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00006",
      categoryId: "CAT_003",
      label: "Year of Enrollment",
      type: "number",
      validation: { required: true, min: 2020, max: 2030 },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 1,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00007",
      categoryId: "CAT_004",
      label: "Height (cm)",
      type: "number",
      validation: { required: false, min: 100, max: 250 },
      permissions: { cadetEditable: true, ctoVisible: true, ctoExportable: true },
      sortOrder: 1,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      fieldId: "FIELD_00008",
      categoryId: "CAT_004",
      label: "Identification Mark",
      type: "text",
      validation: { required: false },
      permissions: { cadetEditable: false, ctoVisible: true, ctoExportable: true },
      sortOrder: 2,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  console.log("\n• Seeding 8 Dynamic Field Schemas...");
  for (const field of fields) {
    await db.collection("fields").doc(field.fieldId).set(field, { merge: true });
    console.log(`  ✓ Field [${field.fieldId}] ${field.label} (${field.type})`);
  }

  // 3. Cadets
  const cadets = [
    {
      cadetId: "CADET_0001",
      userId: "sample_user_aarav_001",
      email: "aarav.sharma@example.com",
      fullName: "Cdt. Aarav Sharma",
      enrollmentNo: "KA24SDA100101",
      rank: "Cadet",
      unit: "1 Kar Air Sqn NCC",
      wing: "Air",
      trainingYear: "1st Year",
      division: "SD",
      status: "active",
      driveFolderId: null,
      completionPercentage: 88,
      dynamicData: {
        FIELD_00001: "O+",
        FIELD_00002: "2005-04-12",
        FIELD_00003: "Rajesh Sharma",
        FIELD_00004: "National College of Engineering",
        FIELD_00005: "B.Tech Computer Science",
        FIELD_00006: 2024,
        FIELD_00007: 176,
        FIELD_00008: "Mole on left collarbone",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      cadetId: "CADET_0002",
      userId: "sample_user_priya_002",
      email: "priya.patel@example.com",
      fullName: "Cpl. Priya Patel",
      enrollmentNo: "KA23SWA100205",
      rank: "Corporal",
      unit: "1 Kar Air Sqn NCC",
      wing: "Air",
      trainingYear: "2nd Year",
      division: "SW",
      status: "active",
      driveFolderId: null,
      completionPercentage: 94,
      dynamicData: {
        FIELD_00001: "B+",
        FIELD_00002: "2004-11-28",
        FIELD_00003: "Kirit Patel",
        FIELD_00004: "St. Joseph's University",
        FIELD_00005: "B.Sc Physics",
        FIELD_00006: 2023,
        FIELD_00007: 165,
        FIELD_00008: "Scar on right forearm",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      cadetId: "CADET_0003",
      userId: "sample_user_rohan_003",
      email: "rohan.verma@example.com",
      fullName: "Sgt. Rohan Verma",
      enrollmentNo: null, // Pending regimental code
      rank: "Sergeant",
      unit: "1 Kar Air Sqn NCC",
      wing: "Air",
      trainingYear: "3rd Year",
      division: "SD",
      status: "inactive",
      driveFolderId: null,
      completionPercentage: 55,
      dynamicData: {
        FIELD_00001: "A+",
        FIELD_00002: "2006-01-15",
        FIELD_00003: "Suresh Verma",
        FIELD_00004: "Bangalore City College",
        FIELD_00005: "B.Com",
        FIELD_00006: 2024,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  console.log("\n• Seeding 3 Sample Master Cadet Records...");
  for (const cadet of cadets) {
    await db.collection("cadets").doc(cadet.cadetId).set(cadet, { merge: true });
    console.log(`  ✓ Cadet [${cadet.cadetId}] ${cadet.fullName} (${cadet.unit}, ${cadet.wing})`);
  }

  // Update counters to match seeded IDs
  await db.collection("system_counters").doc("cadet").set(
    { type: "cadet", currentSequence: 3, updatedAt: timestamp },
    { merge: true }
  );
  await db.collection("system_counters").doc("category").set(
    { type: "category", currentSequence: 4, updatedAt: timestamp },
    { merge: true }
  );
  await db.collection("system_counters").doc("field").set(
    { type: "field", currentSequence: 8, updatedAt: timestamp },
    { merge: true }
  );

  console.log("\n🎉 Seed data successfully committed to Cloud Firestore!");
  console.log("==================================================");
}

seedData().catch(console.error);
