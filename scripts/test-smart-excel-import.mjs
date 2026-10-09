/**
 * Comprehensive Synthetic Test Suite for Smart Cadet Excel Import
 * Strictly uses SYNTHETIC data only — NEVER uses or commits real cadet data.
 */

import ExcelJS from "exceljs";
import { validateExcelSpreadsheetBuffer } from "../src/lib/validation/file-sniffer.js";
import { parseCadetOnboardingFile, normalizePhoneNumber, normalizeEnrollmentNo } from "../src/lib/excel/parse.js";
import { adminDb } from "../src/lib/firebase/admin.js";

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING SMART EXCEL IMPORT SYNTHETIC TEST SUITE");
  console.log("================================================================================\n");

  let allPassed = true;

  function assert(condition, description) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: File Checks & Apple Numbers / Legacy XLS / CSV Detection
  // -------------------------------------------------------------------------
  console.log("TEST 1: File Type & Error Detection");

  // 1a. Empty buffer
  const emptyRes = validateExcelSpreadsheetBuffer(Buffer.alloc(0));
  assert(!emptyRes.valid && emptyRes.error.includes("empty"), "Detects empty file (0 bytes)");

  // 1b. Legacy .xls file (0xD0 0xCF 0x11 0xE0)
  const legacyXlsBuf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
  const legacyRes = validateExcelSpreadsheetBuffer(legacyXlsBuf);
  assert(!legacyRes.valid && legacyRes.error.includes("legacy Excel (.xls) file"), "Detects legacy .xls binary with friendly message");

  // 1c. CSV text file
  const csvBuf = Buffer.from("Name,Email,Phone,Gender\nJohn Doe,john@example.com,9876543210,Male\n");
  const csvRes = validateExcelSpreadsheetBuffer(csvBuf);
  assert(!csvRes.valid && csvRes.error.includes("CSV"), "Detects CSV text file with friendly message");

  // 1d. Apple Numbers file (ZIP containing Index/Document.iwa, no [Content_Types].xml)
  // Construct a minimal ZIP header with "Index/Document.iwa"
  const fakeNumbersHeader = Buffer.from(
    "PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00\x00\x00Index/Document.iwa\x00\x00\x00\x00"
  );
  const numbersRes = validateExcelSpreadsheetBuffer(fakeNumbersHeader);
  assert(
    !numbersRes.valid && numbersRes.error.includes("Apple Numbers document"),
    "Detects Apple Numbers document saved as .xlsx with actionable export instructions"
  );

  // -------------------------------------------------------------------------
  // TEST 2: Normalisation Functions Unit Tests
  // -------------------------------------------------------------------------
  console.log("\nTEST 2: Normalisation Unit Tests");

  // Phone float cleanup & formatting
  assert(normalizePhoneNumber("7337846518.0") === "7337846518", "Strips float .0 from phone: 7337846518.0 -> 7337846518");
  assert(normalizePhoneNumber("+91 98765 43210") === "9876543210", "Strips +91 and spaces: +91 98765 43210 -> 9876543210");
  assert(normalizePhoneNumber("09876543210") === "9876543210", "Strips leading 0: 09876543210 -> 9876543210");
  assert(normalizePhoneNumber("919876543210") === "9876543210", "Strips leading 91 (12-digit): 919876543210 -> 9876543210");

  // Enrollment ID uppercase & whitespace stripping
  assert(normalizeEnrollmentNo(" ka2026 sdaf 2490421 ") === "KA2026SDAF2490421", "Uppercases and strips spaces from enrollment ID");
  assert(normalizeEnrollmentNo("kar/24/sd/100101") === "KAR/24/SD/100101", "Preserves valid slashes in enrollment ID");

  // -------------------------------------------------------------------------
  // TEST 3: Multi-Sheet Workbook with 56 Columns & Auto-Detection
  // -------------------------------------------------------------------------
  console.log("\nTEST 3: 4-Sheet Workbook Auto-Detection & Parsing");

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Incomplete summary sheet
  const s1 = wb.addWorksheet("Summary");
  s1.addRow(["SL NO", "Enrollment ID", "Name"]);
  s1.addRow([1, "KA26SDA1001", "Synthetic Alpha"]);
  s1.addRow([2, "KA26SDA1002", "Synthetic Beta"]);

  // Sheet 2: Wide 56-column master export with float phone numbers and extra metadata
  const s2 = wb.addWorksheet("NCC Master Export");
  // Row 1 is a title banner (simulating header on row 2)
  s2.addRow(["NATIONAL CADET CORPS - MASTER EXPORT NOMINAL ROLL"]);
  // Row 2 is the actual header row with 56 columns
  const s2Headers = [
    "SL No", "Group Name", "Unit Name", "Cadet Name", "Enrollment ID",
    "Mobilenumber", "Emailid", "Gender", "Dateofbirth", "Blood Group",
    "Father Name", "Mother Name", "Address Line 1", "Address Line 2",
    "City", "State", "Pincode", "Aadhaar Number", "Bank Name",
    "Account Number", "IFSC Code", "College Name", "Stream",
    "Class", "Roll Number", "Height CM", "Weight KG", "Shoe Size",
    "Shirt Size", "Trouser Size", "Beret Size", "Identification Mark 1",
    "Identification Mark 2", "Emergency Contact", "Emergency Relation",
    "Next of Kin", "NOK Address", "NOK Contact", "Camp Attended 1",
    "Camp Attended 2", "Firing Score", "Drill Grade", "Aero Modelling",
    "Skeet Shooting", "Swimming", "Sports Played", "Hobbies",
    "Remarks", "Special Achievement", "Passport Number", "PAN Number",
    "COVID Vaccination", "Dose 1 Date", "Dose 2 Date", "Booster Date", "Status"
  ];
  s2.addRow(s2Headers);

  // Add synthetic test rows
  s2.addRow([
    1, "Bangalore A", "1 Kar Air Sqn", "Synthetic Cadet One", "ka26sdaf249001",
    7337846518.0, "synth.cadet1@example.com", "MALE", "2005-01-01", "O+",
    "Father One", "Mother One", "Street 1", "Area 1",
    "Bangalore", "Karnataka", "560001", "123456789012", "SBI",
    "123456789", "SBIN0001234", "Synthetic College", "B.Tech",
    "2nd Year", "R001", 175, 68, 8,
    38, 32, 7, "Mole on neck",
    "None", "9876543210", "Father",
    "Father One", "Street 1", "9876543210", "CATC-I",
    "AATC", 28, "A", "Radio Control",
    "Yes", "Proficient", "Basketball", "Reading",
    "Disciplined", "Gold Medal Drill", "A1234567", "ABCDE1234F",
    "Fully Vaccinated", "2021-06-01", "2021-09-01", "2022-04-01", "Active"
  ]);

  s2.addRow([
    2, "Bangalore A", "1 Kar Air Sqn", "Synthetic Cadet Two", "KA26SWAF249002",
    "9876543211", "synth.cadet2@example.com", "FEMALE", "2005-05-15", "B+",
    "Father Two", "Mother Two", "Street 2", "Area 2",
    "Bangalore", "Karnataka", "560002", "123456789013", "HDFC",
    "987654321", "HDFC0001234", "Synthetic College", "B.Sc",
    "1st Year", "R002", 162, 54, 6,
    36, 28, 6, "Scar on left hand",
    "None", "9876543212", "Mother",
    "Mother Two", "Street 2", "9876543212", "ATC-II",
    "VSC", 29, "A", "Static Models",
    "Yes", "Intermediate", "Athletics", "Singing",
    "Punctual", "Best Cadet Nominee", "B7654321", "FGHIJ5678K",
    "Fully Vaccinated", "2021-07-01", "2021-10-01", "2022-05-01", "Active"
  ]);

  // Row with missing optional Enrollment ID
  s2.addRow([
    3, "Bangalore A", "1 Kar Air Sqn", "Synthetic Cadet Three", "",
    "+91 98765 43213", "synth.cadet3@example.com", "FEMALE", "2006-02-20", "A+",
    "Father Three", "Mother Three", "Street 3", "Area 3",
    "Bangalore", "Karnataka", "560003", "123456789014", "ICICI",
    "555666777", "ICIC0001234", "Synthetic College", "B.Com",
    "1st Year", "R003", 165, 56, 7,
    36, 30, 6, "None",
    "None", "9876543214", "Father",
    "Father Three", "Street 3", "9876543214", "CATC",
    "None", 25, "B", "None",
    "No", "Beginner", "Badminton", "Art",
    "Active", "None", "C9876543", "LMNOP9012Q",
    "Fully Vaccinated", "2021-08-01", "2021-11-01", "2022-06-01", "Active"
  ]);

  // Add 30 trailing empty rows
  for (let i = 0; i < 30; i++) {
    s2.addRow([]);
  }

  // Sheet 3: Standard template sheet
  const s3 = wb.addWorksheet("Template Match");
  s3.addRow(["Name", "Email", "Phone", "Enrollment ID", "Gender"]);
  s3.addRow(["Synthetic Template Cadet", "synth.template@example.com", "9876543219", "KA26SDA999999", "MALE"]);

  // Sheet 4: Notes
  const s4 = wb.addWorksheet("Notes");
  s4.addRow(["Instructions and guidelines for uploading"]);

  const testWorkbookBuf = await wb.xlsx.writeBuffer();

  // Test Auto-Detection on multi-sheet workbook
  const parseResult = await parseCadetOnboardingFile(Buffer.from(testWorkbookBuf), {
    defaultTrainingYear: "1st Year",
  });

  assert(parseResult.summary.detectedSheet === "NCC Master Export", `Auto-detected best sheet: '${parseResult.summary.detectedSheet}' (expected 'NCC Master Export')`);
  assert(parseResult.rows.length === 3, `Ignored empty trailing rows, parsed exactly ${parseResult.rows.length} data rows (expected 3)`);

  const row1 = parseResult.rows[0];
  assert(row1.phone === "7337846518", `Float phone cleaned: ${row1.phone} (expected '7337846518')`);
  assert(row1.enrollmentNo === "KA26SDAF249001", `Enrollment ID uppercased: ${row1.enrollmentNo} (expected 'KA26SDAF249001')`);
  assert(row1.division === "SD", `Division derived from MALE: ${row1.division} (expected 'SD')`);
  assert(row1.trainingYear === "1st Year", `Default training year applied: ${row1.trainingYear}`);
  assert(row1.isValid === true, "Row 1 is fully valid");

  const row2 = parseResult.rows[1];
  assert(row2.division === "SW", `Division derived from FEMALE: ${row2.division} (expected 'SW')`);
  assert(row2.enrollmentNo === "KA26SWAF249002", `Enrollment ID formatted: ${row2.enrollmentNo}`);

  const row3 = parseResult.rows[2];
  assert(row3.enrollmentNo === null || row3.enrollmentNo === "", "Row 3 has empty Enrollment ID");
  assert(row3.isValid === true, "Row 3 with missing Enrollment ID is VALID (onboards via email)");
  assert(row3.warnings.some((w) => w.includes("No Enrollment ID")), "Row 3 has non-blocking warning for missing Enrollment ID");

  // Data Minimisation Check: verify NO unmapped keys (Father Name, Bank, DOB, etc.) are present in the row object
  const allowedKeys = new Set([
    "rowNumber", "name", "email", "phone", "enrollmentNo",
    "trainingYear", "division", "gender", "isValid",
    "errors", "warnings", "isDuplicateInFile", "isDuplicateInDb",
    "isDuplicateEnrollmentInFile", "isDuplicateEnrollmentInDb"
  ]);
  const rowKeys = Object.keys(row1);
  const extraKeys = rowKeys.filter((k) => !allowedKeys.has(k));
  assert(extraKeys.length === 0, `Data minimisation strictly enforced: 0 extraneous columns present (${extraKeys.length})`);

  // Test On-Demand Sheet Switching to Sheet 3 ("Template Match")
  const switchResult = await parseCadetOnboardingFile(Buffer.from(testWorkbookBuf), {
    sheetName: "Template Match",
    defaultTrainingYear: "2nd Year",
  });
  assert(switchResult.summary.detectedSheet === "Template Match", "Sheet switcher parsed 'Template Match' on demand");
  assert(switchResult.rows.length === 1, "Parsed exactly 1 row from 'Template Match'");
  assert(switchResult.rows[0].name === "Synthetic Template Cadet", "Correct cadet extracted from switched sheet");

  // -------------------------------------------------------------------------
  // TEST 4: Validation Errors & Duplicate Checks
  // -------------------------------------------------------------------------
  console.log("\nTEST 4: Validation Errors & Duplicate Rules");

  const errWb = new ExcelJS.Workbook();
  const errSheet = errWb.addWorksheet("Cadets");
  errSheet.addRow(["Name", "Email", "Phone", "Enrollment ID", "Gender"]);
  // Row 1: Valid
  errSheet.addRow(["Valid Cadet", "valid.cadet@example.com", "9876543210", "KA26SDA111111", "MALE"]);
  // Row 2: Bad Phone (8 digits)
  errSheet.addRow(["Bad Phone Cadet", "badphone@example.com", "98765432", "KA26SDA222222", "MALE"]);
  // Row 3: Unknown Gender
  errSheet.addRow(["Bad Gender Cadet", "badgender@example.com", "9876543211", "KA26SDA333333", "UNKNOWN_VAL"]);
  // Row 4: Duplicate Email inside file (same as Row 1)
  errSheet.addRow(["Duplicate Email Cadet", "valid.cadet@example.com", "9876543212", "KA26SDA444444", "FEMALE"]);
  // Row 5: Duplicate Enrollment ID inside file (same as Row 1)
  errSheet.addRow(["Duplicate Enrollment Cadet", "dup.enroll@example.com", "9876543213", "KA26SDA111111", "FEMALE"]);

  const errBuf = await errWb.xlsx.writeBuffer();
  const errParse = await parseCadetOnboardingFile(Buffer.from(errBuf));

  assert(errParse.rows[0].isValid === true, "Row 1 (Valid) is VALID");
  assert(!errParse.rows[1].isValid && errParse.rows[1].errors.some((e) => e.includes("Phone") || e.includes("phone")), "Row 2 flagged for invalid phone number");
  assert(!errParse.rows[2].isValid && errParse.rows[2].errors.some((e) => e.includes("gender")), "Row 3 flagged for unrecognized gender");
  assert(!errParse.rows[3].isValid && errParse.rows[3].errors.some((e) => e.includes("Duplicate email")), "Row 4 flagged for duplicate email in spreadsheet");
  assert(!errParse.rows[4].isValid && errParse.rows[4].errors.some((e) => e.includes("Duplicate Enrollment ID")), "Row 5 flagged for duplicate Enrollment ID in spreadsheet");

  // -------------------------------------------------------------------------
  // TEST 5: Atomic Uniqueness & Enrollment Index in Firestore
  // -------------------------------------------------------------------------
  console.log("\nTEST 5: Atomic Enrollment Index Uniqueness Test");

  const testEnrollmentId = "TEST_KA26SDA_UNIQUE99";
  const testCadetId1 = "CADET_SYNTH_TEST1";
  const testCadetId2 = "CADET_SYNTH_TEST2";

  // Clean up any stale test record
  await adminDb.collection("enrollment_index").doc(testEnrollmentId).delete().catch(() => {});
  await adminDb.collection("cadets").doc(testCadetId1).delete().catch(() => {});
  await adminDb.collection("cadets").doc(testCadetId2).delete().catch(() => {});

  // 1. Reserve index doc
  await adminDb.collection("enrollment_index").doc(testEnrollmentId).set({
    cadetId: testCadetId1,
    enrollmentNo: testEnrollmentId,
    createdAt: new Date().toISOString(),
  });

  // 2. Pre-flight check against DB
  const dupDbWb = new ExcelJS.Workbook();
  const dupDbSheet = dupDbWb.addWorksheet("Cadets");
  dupDbSheet.addRow(["Name", "Email", "Phone", "Enrollment ID", "Gender"]);
  dupDbSheet.addRow(["Collision Cadet", "collision.cadet@example.com", "9876543210", testEnrollmentId, "MALE"]);

  const dupDbBuf = await dupDbWb.xlsx.writeBuffer();
  const dupDbResult = await parseCadetOnboardingFile(Buffer.from(dupDbBuf));

  assert(!dupDbResult.rows[0].isValid && dupDbResult.rows[0].errors.some((e) => e.includes("already assigned")), "Pre-flight detects collision against enrollment_index in Firestore");

  // Clean up test documents
  await adminDb.collection("enrollment_index").doc(testEnrollmentId).delete().catch(() => {});
  console.log("  🧹 Cleaned up synthetic enrollment_index test records.");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  if (allPassed) {
    console.log("🎉 ALL SYNTHETIC TESTS PASSED SUCCESSFULLY (100%)");
  } else {
    console.error("❌ SOME TESTS FAILED — PLEASE REVIEW LOGS");
    process.exit(1);
  }
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("Fatal error running synthetic tests:", err);
  process.exit(1);
});
