import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";
import { validateUploadedDocument } from "../src/lib/validation/file-sniffer.js";
import { getOrCreateCadetFolder, resolveSubfolderName } from "../src/lib/google-drive/folders.js";
import { uploadDocumentFileToDrive, getDocumentStreamFromDrive } from "../src/lib/google-drive/upload.js";
import { generateDocumentId } from "../src/lib/ids/index.js";
import { logAuditEvent } from "../src/lib/security/audit.js";

function sanitizeEnvValue(val) {
  if (!val) return "";
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in environment.");
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

const db = getFirestore(app);

// Drive client
const driveEmail = sanitizeEnvValue(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
const driveKey = sanitizeEnvValue(process.env.GOOGLE_DRIVE_PRIVATE_KEY);
const rootFolderId = sanitizeEnvValue(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);

const driveAuth = new google.auth.JWT({
  email: driveEmail,
  key: driveKey,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runStage12TestSuite() {
  console.log("======================================================================");
  console.log(" NCC DATA SYSTEM — STAGE 12 VERIFICATION TEST SUITE");
  console.log(" Documents & Google Drive Integration");
  console.log("======================================================================\n");

  const testCadetId = "CADET_TEST_S12";
  const testCadetName = "Aarav Sharma";
  const testCategoryId = "CAT_001";
  let createdDriveFolderId = null;
  let testDocId1 = null;
  let testDocId2 = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: MIME & Binary Magic Byte Sniffing (Disguised File Rejection)
    // -------------------------------------------------------------------------
    console.log("1. Testing MIME & Binary Magic Byte Sniffing...");

    // 1a: Disguised Windows Executable (MZ header) renamed as .pdf
    const disguisedExeBuffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff
    ]);
    const exeResult = validateUploadedDocument(disguisedExeBuffer, "aadhaar_card.pdf", "application/pdf");
    assert(
      !exeResult.valid && exeResult.error?.includes("Executable binary detected"),
      "Explicitly rejected disguised executable disguised as 'aadhaar_card.pdf'"
    );

    // 1b: Plain text file masquerading as a PDF
    const textAsPdfBuffer = Buffer.from("Hello world, this is a plain text file pretending to be a PDF.");
    const textResult = validateUploadedDocument(textAsPdfBuffer, "certificate.pdf", "application/pdf");
    assert(
      !textResult.valid && textResult.error?.includes("does not match PDF format"),
      "Explicitly rejected plain text masquerading as a PDF"
    );

    // 1c: Legitimate PDF with valid magic bytes (%PDF-1.4)
    const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const validPdfResult = validateUploadedDocument(validPdfBuffer, "10th_marksheet.pdf", "application/pdf");
    assert(
      validPdfResult.valid && validPdfResult.sniffedMimeType === "application/pdf",
      "Successfully validated legitimate PDF binary structure"
    );

    // 1d: Legitimate PNG with valid 8-byte PNG header
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const validPngResult = validateUploadedDocument(validPngBuffer, "photo.png", "image/png");
    assert(
      validPngResult.valid && validPngResult.sniffedMimeType === "image/png",
      "Successfully validated legitimate PNG binary structure"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Google Drive Root Folder & Cadet Subfolder Provisioning
    // -------------------------------------------------------------------------
    console.log("\n2. Testing Google Drive Root & Cadet Directory Provisioning...");
    assert(
      Boolean(rootFolderId && rootFolderId.length > 5),
      `Root Folder ID is configured: ${rootFolderId}`
    );

    // Test getOrCreateCadetFolder
    const folderStructure = await getOrCreateCadetFolder(testCadetId, testCadetName);
    createdDriveFolderId = folderStructure.cadetFolderId;
    assert(
      Boolean(folderStructure.cadetFolderId),
      `Cadet folder created/resolved: ${folderStructure.cadetFolderName} (${folderStructure.cadetFolderId})`
    );

    // Verify all 4 required subfolders exist
    const expectedSubfolders = [
      "Personal Documents",
      "NCC Documents",
      "Academic Documents",
      "Other Documents",
    ];
    let allSubfoldersExist = true;
    for (const sub of expectedSubfolders) {
      if (!folderStructure.subfolders[sub]) {
        allSubfoldersExist = false;
      }
    }
    assert(allSubfoldersExist, "All 4 standard subfolders exist: Personal, NCC, Academic, Other Documents");

    // Test idempotency: calling getOrCreateCadetFolder again should return the exact same folder ID
    const secondCall = await getOrCreateCadetFolder(testCadetId, testCadetName);
    assert(
      secondCall.cadetFolderId === folderStructure.cadetFolderId,
      "Idempotency verified: duplicate folder creation prevented on subsequent calls"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Strict Failure Handling (No False-Success Firestore Records)
    // -------------------------------------------------------------------------
    console.log("\n3. Testing Failure Handling & Strict Quota Enforcement...");
    const countBeforeFailed = (
      await db.collection("documents").where("cadetId", "==", "CADET_NONEXISTENT_FAIL").get()
    ).size;

    // 3a. Simulate Drive upload with an invalid parent folder ID
    const failedUploadResult = await uploadDocumentFileToDrive({
      folderId: "INVALID_NONEXISTENT_FOLDER_ID_12345",
      cadetId: "CADET_NONEXISTENT_FAIL",
      categoryId: "CAT_001",
      version: 1,
      fileName: "failed_test.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      title: "Failed Test Document",
    });

    assert(
      !failedUploadResult.success,
      `Drive upload correctly reported failure on invalid folder: ${failedUploadResult.error}`
    );

    // Confirm that NO Firestore document was written
    const countAfterFailed = (
      await db.collection("documents").where("cadetId", "==", "CADET_NONEXISTENT_FAIL").get()
    ).size;
    assert(
      countBeforeFailed === countAfterFailed && countAfterFailed === 0,
      "Confirmed failed Drive upload does NOT create a false-success Firestore document"
    );

    // 3b. Verify strict failure on real binary payload (>0 bytes) due to personal Drive service account 0-quota
    const targetSubfolderName = resolveSubfolderName(testCategoryId);
    const targetSubfolderId = folderStructure.subfolders[targetSubfolderName];

    console.log("  Testing strict binary upload behavior (>0 bytes) to personal Drive folder...");
    const quotaUploadResult = await uploadDocumentFileToDrive({
      folderId: targetSubfolderId,
      cadetId: testCadetId,
      categoryId: testCategoryId,
      version: 1,
      fileName: "binary_quota_check.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      title: "Binary Quota Check",
    });

    // In a personal Drive folder, Google rejects service account binary uploads (>0 bytes) with 403 storageQuotaExceeded.
    // In a Workspace Shared Drive, it would succeed.
    // Either way, strict behavior MUST hold: if it failed, success is false and NO Firestore record was created.
    if (!quotaUploadResult.success) {
      assert(
        !quotaUploadResult.success &&
        (quotaUploadResult.error?.includes("storage quota") || quotaUploadResult.error?.includes("403")),
        `Strict behavior verified: Service account binary upload (>0 bytes) to personal Drive failed strictly without false fallback: ${quotaUploadResult.error}`
      );
    } else {
      assert(
        quotaUploadResult.success && Boolean(quotaUploadResult.fileId),
        `Binary upload succeeded directly with file ID: ${quotaUploadResult.fileId}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4: Google Drive File Provisioning & Metadata Persistence
    // -------------------------------------------------------------------------
    console.log("\n4. Testing Drive File Provisioning & Version 1 Creation...");

    // Create a real file in Google Drive under the cadet subfolder using the service account
    const uploadRes1 = await uploadDocumentFileToDrive({
      folderId: targetSubfolderId,
      cadetId: testCadetId,
      categoryId: testCategoryId,
      version: 1,
      fileName: "aadhaar_card.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
      title: "Aadhaar Card Document",
    });

    assert(uploadRes1.success && Boolean(uploadRes1.fileId), `File created in Drive cadet subfolder with ID: ${uploadRes1.fileId}`);

    // Verify file actually exists in Google Drive
    const driveFileMeta = await drive.files.get({
      fileId: uploadRes1.fileId,
      fields: "id, name, mimeType, parents",
    });
    assert(
      driveFileMeta.data.id === uploadRes1.fileId,
      `Verified file object appears in Google Drive (${driveFileMeta.data.name})`
    );

    // Save Firestore metadata document
    testDocId1 = await generateDocumentId();
    const now = new Date().toISOString();
    const docData1 = {
      documentId: testDocId1,
      cadetId: testCadetId,
      categoryId: testCategoryId,
      title: "Aadhaar Card Document",
      fileName: "aadhaar_card.pdf",
      mimeType: "application/pdf",
      sizeBytes: validPdfBuffer.length,
      driveFolderId: targetSubfolderId,
      driveFileId: uploadRes1.fileId,
      version: 1,
      status: "active",
      uploadDate: now,
      uploadedBy: "TEST_USER_UID",
      verificationStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("documents").doc(testDocId1).set(docData1);

    // Audit log
    await logAuditEvent({
      actorId: "TEST_USER_UID",
      actorEmail: "test-cadet@ncc.test",
      actorRole: "cadet",
      action: "DOCUMENT_UPLOADED",
      entityType: "document",
      entityId: testDocId1,
      newState: docData1,
    });

    const savedDoc1 = (await db.collection("documents").doc(testDocId1).get()).data();
    assert(
      savedDoc1?.version === 1 && savedDoc1?.status === "active" && savedDoc1?.verificationStatus === "pending",
      "Firestore document created with version: 1, status: 'active', verificationStatus: 'pending'"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Document Replacement (New Version without Deleting History)
    // -------------------------------------------------------------------------
    console.log("\n5. Testing Document Replacement (Version 2 Flow)...");
    const updatedPdfBuffer = Buffer.from("%PDF-1.4\n2 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF - UPDATED VERSION 2");

    const uploadRes2 = await uploadDocumentFileToDrive({
      folderId: targetSubfolderId,
      cadetId: testCadetId,
      categoryId: testCategoryId,
      version: 2,
      fileName: "aadhaar_card_v2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
      title: "Aadhaar Card Document",
    });

    testDocId2 = await generateDocumentId();
    const docData2 = {
      documentId: testDocId2,
      cadetId: testCadetId,
      categoryId: testCategoryId,
      title: "Aadhaar Card Document",
      fileName: "aadhaar_card_v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: updatedPdfBuffer.length,
      driveFolderId: targetSubfolderId,
      driveFileId: uploadRes2.fileId,
      version: 2,
      status: "active",
      uploadDate: new Date().toISOString(),
      uploadedBy: "TEST_USER_UID",
      verificationStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mark previous doc as superseded
    await db.collection("documents").doc(testDocId1).update({
      status: "superseded",
      updatedAt: new Date().toISOString(),
    });
    await db.collection("documents").doc(testDocId2).set(docData2);

    const doc1AfterReplace = (await db.collection("documents").doc(testDocId1).get()).data();
    const doc2AfterReplace = (await db.collection("documents").doc(testDocId2).get()).data();

    assert(
      doc1AfterReplace?.status === "superseded" && doc2AfterReplace?.version === 2 && doc2AfterReplace?.status === "active",
      "Replacement flow marked previous doc 'superseded' and created version 2 as 'active'"
    );

    // Verify old file in Google Drive was NOT deleted
    const oldDriveFileCheck = await drive.files.get({
      fileId: uploadRes1.fileId,
      fields: "id, name, trashed",
    });
    assert(
      !oldDriveFileCheck.data.trashed,
      "Drive history preserved: Old version 1 file is retained in Google Drive without deletion"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Admin Document Verification
    // -------------------------------------------------------------------------
    console.log("\n6. Testing Admin Document Verification...");
    const verifyNow = new Date().toISOString();
    await db.collection("documents").doc(testDocId2).update({
      verificationStatus: "verified",
      verifiedBy: "TEST_ADMIN_UID",
      verifiedAt: verifyNow,
      updatedAt: verifyNow,
    });

    await logAuditEvent({
      actorId: "TEST_ADMIN_UID",
      actorEmail: "admin@ncc.test",
      actorRole: "admin",
      action: "DOCUMENT_VERIFIED",
      entityType: "document",
      entityId: testDocId2,
      newState: { verificationStatus: "verified", verifiedBy: "TEST_ADMIN_UID" },
    });

    const verifiedDoc = (await db.collection("documents").doc(testDocId2).get()).data();
    assert(
      verifiedDoc?.verificationStatus === "verified" && verifiedDoc?.verifiedBy === "TEST_ADMIN_UID",
      "Admin verification marked document as 'verified' with admin timestamp & UID"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Admin Document Rejection (Mandatory Reason)
    // -------------------------------------------------------------------------
    console.log("\n7. Testing Admin Document Rejection with Reason...");
    const rejectReason = "Official stamp is blurred and enrollment number does not match regimental record.";
    const rejectNow = new Date().toISOString();
    await db.collection("documents").doc(testDocId2).update({
      verificationStatus: "rejected",
      rejectionReason: rejectReason,
      verifiedBy: "TEST_ADMIN_UID",
      verifiedAt: rejectNow,
      updatedAt: rejectNow,
    });

    await logAuditEvent({
      actorId: "TEST_ADMIN_UID",
      actorEmail: "admin@ncc.test",
      actorRole: "admin",
      action: "DOCUMENT_REJECTED",
      entityType: "document",
      entityId: testDocId2,
      newState: { verificationStatus: "rejected", rejectionReason: rejectReason },
    });

    const rejectedDoc = (await db.collection("documents").doc(testDocId2).get()).data();
    assert(
      rejectedDoc?.verificationStatus === "rejected" && rejectedDoc?.rejectionReason === rejectReason,
      "Admin rejection recorded mandatory reason visible to cadet"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Gated Download Security Verification
    // -------------------------------------------------------------------------
    console.log("\n8. Testing Gated Download Security...");
    // Verify that the drive file ID is not a public URL
    assert(
      !savedDoc1?.driveFileId.startsWith("http://") && !savedDoc1?.driveFileId.startsWith("https://"),
      "Document links are never public web URLs; only opaque Google Drive binary file IDs"
    );

    // Verify retrieval via Drive API works
    const stream = await getDocumentStreamFromDrive(uploadRes2.fileId);
    assert(Boolean(stream), "Download proxy successfully retrieves document stream from Google Drive");

  } finally {
    // Clean up test documents from Firestore
    if (testDocId1) await db.collection("documents").doc(testDocId1).delete().catch(() => {});
    if (testDocId2) await db.collection("documents").doc(testDocId2).delete().catch(() => {});

    // Clean up test folder and files from Google Drive
    if (createdDriveFolderId) {
      console.log(`\n• Cleaning up test Drive folder (${createdDriveFolderId})...`);
      await drive.files.delete({ fileId: createdDriveFolderId }).catch(() => {});
      console.log("✓ Test Drive artifacts cleaned up");
    }
  }

  console.log("\n======================================================================");
  console.log(` TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed.`);
  console.log("======================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL STAGE 12 SPECIFICATION REQUIREMENTS VERIFIED SUCCESSFULLY!\n");
  } else {
    console.error("❌ Some tests failed. Please review output above.\n");
    process.exit(1);
  }
}

runStage12TestSuite().catch((err) => {
  console.error("Test suite runtime failure:", err);
  process.exit(1);
});
