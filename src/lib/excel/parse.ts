import ExcelJS from "exceljs";
import { adminDb } from "@/lib/firebase/admin";
import type {
  CadetImportRow,
  CadetImportSummary,
  EnrollmentImportRow,
  EnrollmentImportSummary,
  CadetCandidateMatch,
} from "@/types/excel";
import type { CadetRecord } from "@/types/cadet";
import {
  CadetImportRowInputSchema,
  EnrollmentRowInputSchema,
  EnrollmentNoFormatRegex,
} from "@/lib/validation/excel";
import { validateExcelSpreadsheetBuffer } from "@/lib/validation/file-sniffer";

export function cleanCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    // Clean trailing .0 if stored as float (e.g. 7337846518.0)
    return Number.isInteger(val) ? String(val) : String(val).replace(/\.0+$/, "");
  }
  if (typeof val === "object") {
    const obj = val as {
      text?: string;
      result?: unknown;
      value?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((t) => t.text || "").join("").trim();
    }
    if (obj.text !== undefined) return String(obj.text).trim();
    if (obj.result !== undefined) {
      if (typeof obj.result === "number") {
        return Number.isInteger(obj.result) ? String(obj.result) : String(obj.result).replace(/\.0+$/, "");
      }
      return String(obj.result).trim();
    }
    if (obj.value !== undefined) return String(obj.value).trim();
  }
  return String(val).trim();
}

/**
 * Normalizes header string by stripping all spaces, underscores, and punctuation.
 */
function normalizeHeaderKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Alias dictionaries for flexible column matching
const COLUMN_ALIASES = {
  name: [
    "name",
    "cadetname",
    "fullname",
    "studentname",
    "cadetfullname",
    "nameofcadet",
    "cadetsname",
    "cadet",
    "candidatename",
    "applicantname",
  ],
  enrollmentNo: [
    "enrollment",
    "enrollmentid",
    "enrollmentnumber",
    "enrollmentno",
    "enrolment",
    "enrolmentid",
    "enrolmentnumber",
    "enrolmentno",
    "regimentalnumber",
    "regimentalno",
    "regtno",
    "regtlno",
    "regno",
    "nccno",
    "nccnumber",
    "nccenrollmentno",
    "cadetenrollmentno",
    "cadetenrolmentno",
    "cadetenrollmentid",
    "enrollid",
    "enrolid",
  ],
  email: [
    "email",
    "emailid",
    "emailaddress",
    "mailid",
    "mail",
    "cadetemail",
    "studentemail",
    "email_id",
  ],
  phone: [
    "phone",
    "mobile",
    "mobilenumber",
    "mobileno",
    "phonenumber",
    "phoneno",
    "contactnumber",
    "contactno",
    "contact",
    "whatsappno",
    "cellnumber",
    "cadetmobile",
    "telephoneno",
    "telephone",
    "primarymobile",
    "mobilenumber1",
  ],
  gender: ["gender", "sex"],
  division: ["division", "div", "sdsw", "sdorsw", "wingdivision", "nccdivision"],
  trainingYear: [
    "trainingyear",
    "year",
    "cadetyear",
    "academicyear",
    "yearoftraining",
    "nccyear",
    "currentyear",
  ],
};

interface MatchedSheetInfo {
  worksheet: ExcelJS.Worksheet;
  sheetName: string;
  headerRowNumber: number;
  colIndices: {
    name: number;
    email: number;
    phone: number;
    enrollmentNo: number;
    gender: number;
    division: number;
    trainingYear: number;
  };
  rawHeaders: {
    name?: string;
    email?: string;
    phone?: string;
    enrollmentNo?: string;
    gender?: string;
    division?: string;
    trainingYear?: string;
  };
  score: number;
  dataRowCount: number;
}

/**
 * Scans a single worksheet across rows 1-10 to find the best header row.
 */
function scanWorksheetForHeaders(worksheet: ExcelJS.Worksheet): MatchedSheetInfo | null {
  let bestHeaderRowNumber = -1;
  let bestScore = -1;
  let bestColIndices = {
    name: -1,
    email: -1,
    phone: -1,
    enrollmentNo: -1,
    gender: -1,
    division: -1,
    trainingYear: -1,
  };
  let bestRawHeaders: Record<string, string> = {};

  const maxScanRow = Math.min(10, worksheet.rowCount || 10);

  for (let r = 1; r <= maxScanRow; r++) {
    const row = worksheet.getRow(r);
    const colIndices = {
      name: -1,
      email: -1,
      phone: -1,
      enrollmentNo: -1,
      gender: -1,
      division: -1,
      trainingYear: -1,
    };
    const rawHeaders: Record<string, string> = {};

    row.eachCell((cell, colNumber) => {
      const rawVal = cleanCellValue(cell.value);
      if (!rawVal) return;
      const normalized = normalizeHeaderKey(rawVal);

      if (colIndices.name === -1 && COLUMN_ALIASES.name.includes(normalized)) {
        colIndices.name = colNumber;
        rawHeaders.name = rawVal;
      } else if (colIndices.email === -1 && COLUMN_ALIASES.email.includes(normalized)) {
        colIndices.email = colNumber;
        rawHeaders.email = rawVal;
      } else if (colIndices.phone === -1 && COLUMN_ALIASES.phone.includes(normalized)) {
        colIndices.phone = colNumber;
        rawHeaders.phone = rawVal;
      } else if (colIndices.enrollmentNo === -1 && COLUMN_ALIASES.enrollmentNo.includes(normalized)) {
        colIndices.enrollmentNo = colNumber;
        rawHeaders.enrollmentNo = rawVal;
      } else if (colIndices.gender === -1 && COLUMN_ALIASES.gender.includes(normalized)) {
        colIndices.gender = colNumber;
        rawHeaders.gender = rawVal;
      } else if (colIndices.division === -1 && COLUMN_ALIASES.division.includes(normalized)) {
        colIndices.division = colNumber;
        rawHeaders.division = rawVal;
      } else if (colIndices.trainingYear === -1 && COLUMN_ALIASES.trainingYear.includes(normalized)) {
        colIndices.trainingYear = colNumber;
        rawHeaders.trainingYear = rawVal;
      }
    });

    // Score this row
    let rowScore = 0;
    if (colIndices.name !== -1) rowScore += 25;
    if (colIndices.email !== -1) rowScore += 25;
    if (colIndices.phone !== -1) rowScore += 20;
    if (colIndices.enrollmentNo !== -1) rowScore += 15;
    if (colIndices.gender !== -1 || colIndices.division !== -1) rowScore += 10;
    if (colIndices.trainingYear !== -1) rowScore += 5;

    // Must have at least name and either (email, phone, or enrollment)
    const hasCore = colIndices.name !== -1 && (colIndices.email !== -1 || colIndices.phone !== -1 || colIndices.enrollmentNo !== -1);

    if (hasCore && rowScore > bestScore) {
      bestScore = rowScore;
      bestHeaderRowNumber = r;
      bestColIndices = colIndices;
      bestRawHeaders = rawHeaders;
    }
  }

  if (bestHeaderRowNumber === -1) {
    return null;
  }

  // Count non-empty subsequent data rows
  let dataRowCount = 0;
  for (let r = bestHeaderRowNumber + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    let hasData = false;
    if (bestColIndices.name !== -1 && cleanCellValue(row.getCell(bestColIndices.name).value)) hasData = true;
    if (bestColIndices.email !== -1 && cleanCellValue(row.getCell(bestColIndices.email).value)) hasData = true;
    if (bestColIndices.phone !== -1 && cleanCellValue(row.getCell(bestColIndices.phone).value)) hasData = true;
    if (bestColIndices.enrollmentNo !== -1 && cleanCellValue(row.getCell(bestColIndices.enrollmentNo).value)) hasData = true;
    if (hasData) dataRowCount++;
  }

  const totalScore = bestScore * 100 + dataRowCount;

  return {
    worksheet,
    sheetName: worksheet.name,
    headerRowNumber: bestHeaderRowNumber,
    colIndices: bestColIndices,
    rawHeaders: bestRawHeaders,
    score: totalScore,
    dataRowCount,
  };
}

export interface ParseCadetOnboardingOptions {
  sheetName?: string;
  defaultTrainingYear?: "1st Year" | "2nd Year" | "3rd Year";
  defaultDivision?: "SD" | "SW";
}

/**
 * Normalizes Indian mobile phone numbers:
 * - Drops trailing .0 from float values (e.g. 7337846518.0 -> 7337846518)
 * - Strips leading +91, 91 (when length is 12), or leading 0 (when length is 11)
 * - Returns exactly 10 digits if valid, else original cleaned digits for validation reporting
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\.0+$/, "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalizes Cadet Regimental Enrollment Number:
 * - Trims and strips inner spaces
 * - Converts to UPPERCASE
 */
export function normalizeEnrollmentNo(raw: string): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, "").toUpperCase().trim();
}

/**
 * Parses and validates an uploaded Cadet Onboarding Excel spreadsheet.
 * Pure pre-flight inspection — performs zero database writes.
 */
export async function parseCadetOnboardingFile(
  buffer: Buffer,
  options: ParseCadetOnboardingOptions = {}
): Promise<{
  rows: CadetImportRow[];
  summary: CadetImportSummary;
}> {
  // 1. Initial file check
  const fileCheck = validateExcelSpreadsheetBuffer(buffer);
  if (!fileCheck.valid) {
    throw new Error(fileCheck.error);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error(
      "The uploaded file could not be read as an Excel workbook. Please ensure it is a valid, uncorrupted .xlsx file."
    );
  }

  const allSheetNames = workbook.worksheets.map((s) => s.name);
  if (allSheetNames.length === 0) {
    throw new Error("No worksheets found in the uploaded workbook.");
  }

  // 2. Scan all sheets for header rows and best score
  const scannedSheets: MatchedSheetInfo[] = [];
  for (const sheet of workbook.worksheets) {
    const scanned = scanWorksheetForHeaders(sheet);
    if (scanned) {
      scannedSheets.push(scanned);
    }
  }

  if (scannedSheets.length === 0) {
    throw new Error(
      `Could not find cadet data in any worksheet. Searched sheets: [${allSheetNames.join(
        ", "
      )}]. Please ensure the sheet has column headers like Name, Email, Phone, Enrollment ID, and Gender/Division.`
    );
  }

  // Select target sheet
  let selectedSheetInfo: MatchedSheetInfo;
  if (options.sheetName) {
    const target = scannedSheets.find((s) => s.sheetName.toLowerCase() === options.sheetName?.toLowerCase());
    if (target) {
      selectedSheetInfo = target;
    } else {
      // If requested sheet was scanned but didn't have auto-headers, try scanning with lower threshold or fallback
      const directSheet = workbook.getWorksheet(options.sheetName);
      if (!directSheet) {
        throw new Error(`Worksheet '${options.sheetName}' not found in workbook. Available: ${allSheetNames.join(", ")}`);
      }
      const rescanned = scanWorksheetForHeaders(directSheet);
      if (!rescanned) {
        throw new Error(`Worksheet '${options.sheetName}' does not contain recognized cadet columns (Name, Email, Phone).`);
      }
      selectedSheetInfo = rescanned;
    }
  } else {
    // Sort by score descending and pick best
    scannedSheets.sort((a, b) => b.score - a.score);
    selectedSheetInfo = scannedSheets[0];
  }

  const { worksheet: sheet, headerRowNumber, colIndices, rawHeaders } = selectedSheetInfo;

  // Build human-readable column mapping object
  const columnMapping: Record<string, string> = {};
  if (colIndices.name !== -1) columnMapping.name = rawHeaders.name || "Name";
  if (colIndices.email !== -1) columnMapping.email = rawHeaders.email || "Email";
  if (colIndices.phone !== -1) columnMapping.phone = rawHeaders.phone || "Phone";
  if (colIndices.enrollmentNo !== -1) columnMapping.enrollmentNo = rawHeaders.enrollmentNo || "Enrollment ID";
  if (colIndices.gender !== -1) columnMapping.gender = rawHeaders.gender || "Gender";
  if (colIndices.division !== -1) columnMapping.division = rawHeaders.division || "Division";
  if (colIndices.trainingYear !== -1) columnMapping.trainingYear = rawHeaders.trainingYear || "Training Year";

  // Check required minimum columns: Name, and at least (Email or Phone)
  if (colIndices.name === -1 || (colIndices.email === -1 && colIndices.phone === -1)) {
    throw new Error(
      `Sheet '${selectedSheetInfo.sheetName}' is missing required cadet columns. Must include Name and Email/Phone.`
    );
  }

  const rows: CadetImportRow[] = [];
  const seenEmailsInFile = new Map<string, number>(); // email -> first rowNumber
  const seenEnrollmentsInFile = new Map<string, number>(); // enrollmentNo -> first rowNumber
  const emailsToCheckInDb: string[] = [];
  const enrollmentsToCheckInDb: string[] = [];

  const defaultYear = options.defaultTrainingYear || "1st Year";
  const defaultDiv = options.defaultDivision || "SD";

  // 3. Iterate Rows and Validate In-Memory with Data Minimisation
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return; // Skip headers and any pre-header rows

    const rawName = colIndices.name !== -1 ? cleanCellValue(row.getCell(colIndices.name).value) : "";
    const rawEmail = colIndices.email !== -1 ? cleanCellValue(row.getCell(colIndices.email).value) : "";
    const rawPhone = colIndices.phone !== -1 ? cleanCellValue(row.getCell(colIndices.phone).value) : "";
    const rawEnrollment = colIndices.enrollmentNo !== -1 ? cleanCellValue(row.getCell(colIndices.enrollmentNo).value) : "";
    const rawGender = colIndices.gender !== -1 ? cleanCellValue(row.getCell(colIndices.gender).value) : "";
    const rawDivision = colIndices.division !== -1 ? cleanCellValue(row.getCell(colIndices.division).value) : "";
    const rawYear = colIndices.trainingYear !== -1 ? cleanCellValue(row.getCell(colIndices.trainingYear).value) : "";

    // Ignore completely blank rows
    if (!rawName && !rawEmail && !rawPhone && !rawEnrollment && !rawGender && !rawDivision && !rawYear) {
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalise Name
    const cleanName = rawName.replace(/\s+/g, " ").trim();

    // Normalise Email
    const cleanEmail = rawEmail.toLowerCase().trim();

    // Normalise Phone
    const cleanPhone = normalizePhoneNumber(rawPhone);

    // Normalise Enrollment ID
    const cleanEnrollment = normalizeEnrollmentNo(rawEnrollment);

    // Normalise Training Year
    let trainingYear: "1st Year" | "2nd Year" | "3rd Year" = defaultYear;
    if (rawYear) {
      const y = rawYear.toLowerCase().trim();
      if (y === "1st year" || y === "1" || y === "1st" || y === "first" || y === "i") {
        trainingYear = "1st Year";
      } else if (y === "2nd year" || y === "2" || y === "2nd" || y === "second" || y === "ii") {
        trainingYear = "2nd Year";
      } else if (y === "3rd year" || y === "3" || y === "3rd" || y === "third" || y === "iii") {
        trainingYear = "3rd Year";
      } else {
        warnings.push(`Unrecognized Training Year '${rawYear}', defaulting to '${defaultYear}'`);
      }
    }

    // Normalise Division & Gender
    let division: "SD" | "SW" = defaultDiv;
    let genderVal: string | null = null;

    if (rawDivision) {
      const d = rawDivision.toUpperCase().trim();
      if (d === "SD" || d === "SENIOR DIVISION" || d === "MALE" || d === "M") {
        division = "SD";
        genderVal = "Male";
      } else if (d === "SW" || d === "SENIOR WING" || d === "FEMALE" || d === "F") {
        division = "SW";
        genderVal = "Female";
      } else {
        errors.push(`Invalid division '${rawDivision}'. Must be SD (Senior Division) or SW (Senior Wing).`);
      }
    } else if (rawGender) {
      const g = rawGender.toUpperCase().trim();
      if (g === "MALE" || g === "M" || g === "BOY" || g === "SD") {
        division = "SD";
        genderVal = "Male";
      } else if (g === "FEMALE" || g === "F" || g === "GIRL" || g === "SW") {
        division = "SW";
        genderVal = "Female";
      } else {
        errors.push(`Unrecognized gender value '${rawGender}'. Expected MALE or FEMALE.`);
      }
    } else {
      // Neither division nor gender was provided
      division = defaultDiv;
    }

    // Enrollment ID format & presence checks
    if (!cleanEnrollment) {
      warnings.push("No Enrollment ID provided; cadet will onboard with email only.");
    } else {
      if (!EnrollmentNoFormatRegex.test(cleanEnrollment)) {
        errors.push(`Invalid Enrollment ID format '${cleanEnrollment}'. Must be 6-25 characters (letters, numbers, hyphens).`);
      }
    }

    // Zod schema validation
    const parsed = CadetImportRowInputSchema.safeParse({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      enrollmentNo: cleanEnrollment || null,
      trainingYear,
      division,
      gender: genderVal,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // Skip duplicate error messages if already captured
        if (!errors.includes(issue.message)) {
          errors.push(issue.message);
        }
      }
    }

    // Check duplicate email inside file
    let isDuplicateInFile = false;
    if (cleanEmail) {
      if (seenEmailsInFile.has(cleanEmail)) {
        isDuplicateInFile = true;
        const prevRow = seenEmailsInFile.get(cleanEmail);
        errors.push(`Duplicate email in spreadsheet (already seen on row ${prevRow}).`);
      } else {
        seenEmailsInFile.set(cleanEmail, rowNumber);
        emailsToCheckInDb.push(cleanEmail);
      }
    }

    // Check duplicate enrollment ID inside file
    let isDuplicateEnrollmentInFile = false;
    if (cleanEnrollment) {
      if (seenEnrollmentsInFile.has(cleanEnrollment)) {
        isDuplicateEnrollmentInFile = true;
        const prevRow = seenEnrollmentsInFile.get(cleanEnrollment);
        errors.push(`Duplicate Enrollment ID in spreadsheet '${cleanEnrollment}' (already seen on row ${prevRow}).`);
      } else {
        seenEnrollmentsInFile.set(cleanEnrollment, rowNumber);
        enrollmentsToCheckInDb.push(cleanEnrollment);
      }
    }

    rows.push({
      rowNumber,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      enrollmentNo: cleanEnrollment || null,
      trainingYear,
      division,
      gender: genderVal,
      isValid: errors.length === 0,
      errors,
      warnings,
      isDuplicateInFile,
      isDuplicateEnrollmentInFile,
    });
  });

  // 4. Batch Check Existing Emails and Enrollment Numbers in Firestore
  const existingEmailsInDb = new Set<string>();
  const existingEnrollmentsInDb = new Set<string>();

  const BATCH_SIZE = 30;

  // 4a. Check Emails in DB
  if (emailsToCheckInDb.length > 0) {
    for (let i = 0; i < emailsToCheckInDb.length; i += BATCH_SIZE) {
      const batch = emailsToCheckInDb.slice(i, i + BATCH_SIZE);
      const [cadetsSnap, usersSnap] = await Promise.all([
        adminDb.collection("cadets").where("email", "in", batch).get(),
        adminDb.collection("users").where("email", "in", batch).get(),
      ]);

      for (const doc of cadetsSnap.docs) {
        const e = (doc.data().email as string)?.toLowerCase();
        if (e) existingEmailsInDb.add(e);
      }
      for (const doc of usersSnap.docs) {
        const e = (doc.data().email as string)?.toLowerCase();
        if (e) existingEmailsInDb.add(e);
      }
    }
  }

  // 4b. Check Enrollment IDs in DB (via enrollment_index and cadets collection)
  if (enrollmentsToCheckInDb.length > 0) {
    for (let i = 0; i < enrollmentsToCheckInDb.length; i += BATCH_SIZE) {
      const batch = enrollmentsToCheckInDb.slice(i, i + BATCH_SIZE);

      // Check enrollment_index documents by doc ID
      const indexRefs = batch.map((id) => adminDb.collection("enrollment_index").doc(id));
      const indexSnaps = await adminDb.getAll(...indexRefs);

      for (const snap of indexSnaps) {
        if (snap.exists) {
          existingEnrollmentsInDb.add(snap.id);
        }
      }

      // Also check cadets collection in case legacy cadets exist without enrollment_index
      const cadetsEnrollSnap = await adminDb.collection("cadets").where("enrollmentNo", "in", batch).get();
      for (const doc of cadetsEnrollSnap.docs) {
        const en = (doc.data().enrollmentNo as string)?.toUpperCase();
        if (en) existingEnrollmentsInDb.add(en);
      }
    }
  }

  // 5. Update validity flags and counts
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    if (existingEmailsInDb.has(row.email)) {
      row.isDuplicateInDb = true;
      row.errors.push("Email is already registered to an existing cadet or user account.");
      row.isValid = false;
    }

    if (row.enrollmentNo && existingEnrollmentsInDb.has(row.enrollmentNo)) {
      row.isDuplicateEnrollmentInDb = true;
      row.errors.push(`Enrollment ID '${row.enrollmentNo}' is already assigned to an existing cadet.`);
      row.isValid = false;
    }

    if (row.isValid) {
      validCount++;
      if (row.warnings.length > 0) {
        warningCount++;
      }
    } else {
      errorCount++;
    }
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validCount,
      warningCount,
      errorCount,
      detectedSheet: selectedSheetInfo.sheetName,
      allSheets: allSheetNames,
      columnMapping,
      duplicateEmailsInBatch: Array.from(seenEmailsInFile.keys()).filter((e) => {
        let count = 0;
        for (const r of rows) {
          if (r.email === e) count++;
        }
        return count > 1;
      }),
      duplicateEnrollmentsInBatch: Array.from(seenEnrollmentsInFile.keys()).filter((en) => {
        let count = 0;
        for (const r of rows) {
          if (r.enrollmentNo === en) count++;
        }
        return count > 1;
      }),
      existingEmailsInDb: Array.from(existingEmailsInDb),
      existingEnrollmentsInDb: Array.from(existingEnrollmentsInDb),
    },
  };
}

/**
 * Normalizes a cadet name by stripping ranks and punctuation for fuzzy-safe matching.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(cdt|cpl|sgt|chm|csuo|juo|suo|sergeant|corporal|cadet)\.?\s+/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses and matches an uploaded Enrollment Numbers spreadsheet.
 * Strictly avoids guessing when name collisions / ambiguity occur.
 */
export async function parseEnrollmentFile(
  buffer: Buffer,
  existingCadets: CadetRecord[],
  options: { sheetName?: string } = {}
): Promise<{
  rows: EnrollmentImportRow[];
  summary: EnrollmentImportSummary;
}> {
  const fileCheck = validateExcelSpreadsheetBuffer(buffer);
  if (!fileCheck.valid) {
    throw new Error(fileCheck.error);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error("Could not load workbook. Please ensure it is a valid .xlsx file.");
  }

  const targetSheet = options.sheetName
    ? workbook.getWorksheet(options.sheetName) || workbook.worksheets[0]
    : workbook.getWorksheet("Enrollment") || workbook.worksheets[0];

  if (!targetSheet) {
    throw new Error("No readable worksheet found in the uploaded workbook.");
  }

  let nameColIdx = -1;
  let enrollmentColIdx = -1;
  let headerRowNumber = 1;

  // Scan first 10 rows for Name & Enrollment
  for (let r = 1; r <= Math.min(10, targetSheet.rowCount || 10); r++) {
    const row = targetSheet.getRow(r);
    let nCol = -1;
    let eCol = -1;

    row.eachCell((cell, colNumber) => {
      const raw = cleanCellValue(cell.value);
      const norm = normalizeHeaderKey(raw);
      if (nCol === -1 && COLUMN_ALIASES.name.includes(norm)) {
        nCol = colNumber;
      } else if (eCol === -1 && COLUMN_ALIASES.enrollmentNo.includes(norm)) {
        eCol = colNumber;
      }
    });

    if (nCol !== -1 && eCol !== -1) {
      nameColIdx = nCol;
      enrollmentColIdx = eCol;
      headerRowNumber = r;
      break;
    }
  }

  if (nameColIdx === -1 || enrollmentColIdx === -1) {
    throw new Error(
      `Invalid spreadsheet structure. Missing required columns 'Name' and 'Enrollment Number' in sheet '${targetSheet.name}'.`
    );
  }

  // Pre-index existing cadets for collision detection
  const assignedEnrollments = new Map<string, string>(); // enrollmentNo -> cadetId
  for (const c of existingCadets) {
    if (c.enrollmentNo) {
      assignedEnrollments.set(normalizeEnrollmentNo(c.enrollmentNo), c.cadetId);
    }
  }

  const rows: EnrollmentImportRow[] = [];
  const seenEnrollmentsInFile = new Map<string, number>();

  let exactCount = 0;
  let ambiguousCount = 0;
  let unmatchedCount = 0;
  let invalidCount = 0;

  targetSheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const rawName = cleanCellValue(row.getCell(nameColIdx).value);
    const rawEnrollment = cleanCellValue(row.getCell(enrollmentColIdx).value);

    if (!rawName && !rawEnrollment) return;

    const cleanName = rawName.replace(/\s+/g, " ").trim();
    const cleanEnrollment = normalizeEnrollmentNo(rawEnrollment);

    const errors: string[] = [];

    const parsed = EnrollmentRowInputSchema.safeParse({
      name: cleanName,
      enrollmentNo: cleanEnrollment,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }

    if (cleanEnrollment) {
      if (seenEnrollmentsInFile.has(cleanEnrollment)) {
        const prevRow = seenEnrollmentsInFile.get(cleanEnrollment);
        errors.push(`Duplicate Enrollment ID in file '${cleanEnrollment}' (already seen on row ${prevRow}).`);
      } else {
        seenEnrollmentsInFile.set(cleanEnrollment, rowNumber);
      }
    }

    // Find matches in existing cadets
    const normalizedInput = normalizeName(cleanName);
    const candidateCadets: CadetCandidateMatch[] = [];

    for (const c of existingCadets) {
      const normalizedCandidate = normalizeName(c.fullName);
      if (
        c.fullName.toLowerCase() === cleanName.toLowerCase() ||
        normalizedCandidate === normalizedInput
      ) {
        candidateCadets.push({
          cadetId: c.cadetId,
          fullName: c.fullName,
          rank: c.rank,
          wing: c.wing,
          unit: c.unit,
          enrollmentNo: c.enrollmentNo,
        });
      }
    }

    let matchStatus: EnrollmentImportRow["matchStatus"] = "invalid";
    let matchedCadetId: string | null = null;

    if (errors.length > 0) {
      matchStatus = "invalid";
      invalidCount++;
    } else if (candidateCadets.length === 1) {
      matchStatus = "exact";
      matchedCadetId = candidateCadets[0].cadetId;

      const currentAssignedCadet = assignedEnrollments.get(cleanEnrollment);
      if (currentAssignedCadet && currentAssignedCadet !== matchedCadetId) {
        errors.push(
          `Enrollment ID '${cleanEnrollment}' is already assigned to another cadet (${currentAssignedCadet}).`
        );
        matchStatus = "invalid";
        invalidCount++;
      } else {
        exactCount++;
      }
    } else if (candidateCadets.length > 1) {
      matchStatus = "ambiguous";
      matchedCadetId = null;
      errors.push(
        `Ambiguous match: ${candidateCadets.length} cadets found with name "${cleanName}". Disambiguation required.`
      );
      ambiguousCount++;
    } else {
      matchStatus = "unmatched";
      matchedCadetId = null;
      errors.push(`No cadet record found matching name "${cleanName}".`);
      unmatchedCount++;
    }

    rows.push({
      rowNumber,
      name: cleanName,
      enrollmentNo: cleanEnrollment,
      matchedCadetId,
      matchStatus,
      candidateCadets: candidateCadets.length > 0 ? candidateCadets : undefined,
      errors,
    });
  });

  return {
    rows,
    summary: {
      totalRows: rows.length,
      exactCount,
      ambiguousCount,
      unmatchedCount,
      invalidCount,
    },
  };
}

