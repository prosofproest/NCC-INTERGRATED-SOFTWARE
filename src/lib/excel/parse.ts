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
import { CadetImportRowInputSchema, EnrollmentRowInputSchema } from "@/lib/validation/excel";

function cleanCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    // ExcelJS sometimes returns rich text objects or hyperlinks
    const obj = val as { text?: string; result?: unknown };
    if (obj.text) return String(obj.text).trim();
    if (obj.result !== undefined) return String(obj.result).trim();
  }
  return String(val).trim();
}

/**
 * Parses and validates an uploaded Cadet Onboarding Excel spreadsheet.
 * Pure pre-flight inspection — performs zero database writes.
 */
export async function parseCadetOnboardingFile(buffer: Buffer): Promise<{
  rows: CadetImportRow[];
  summary: CadetImportSummary;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.getWorksheet("Cadets") || workbook.worksheets[0];
  if (!sheet) {
    throw new Error("No readable worksheet found in the uploaded workbook.");
  }

  // 1. Identify Header Columns
  let nameColIdx = -1;
  let emailColIdx = -1;
  let phoneColIdx = -1;
  let yearColIdx = -1;
  let divisionColIdx = -1;

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const header = cleanCellValue(cell.value).toLowerCase();
    if (header === "name" || header === "cadet name" || header === "full name") {
      nameColIdx = colNumber;
    } else if (header === "email" || header === "email address") {
      emailColIdx = colNumber;
    } else if (header === "phone" || header === "phone number" || header === "mobile" || header === "mobile number") {
      phoneColIdx = colNumber;
    } else if (
      header === "training year" ||
      header === "year" ||
      header === "cadet year" ||
      header === "trainingyear"
    ) {
      yearColIdx = colNumber;
    } else if (
      header === "division" ||
      header === "div" ||
      header === "sd/sw" ||
      header === "sd / sw"
    ) {
      divisionColIdx = colNumber;
    }
  });

  if (nameColIdx === -1 || emailColIdx === -1 || phoneColIdx === -1 || yearColIdx === -1 || divisionColIdx === -1) {
    const missing: string[] = [];
    if (nameColIdx === -1) missing.push("Name");
    if (emailColIdx === -1) missing.push("Email");
    if (phoneColIdx === -1) missing.push("Phone");
    if (yearColIdx === -1) missing.push("Training Year");
    if (divisionColIdx === -1) missing.push("Division");
    throw new Error(
      `Invalid spreadsheet structure. Missing required column headers: ${missing.join(", ")}. Please use the official template.`
    );
  }

  const rows: CadetImportRow[] = [];
  const seenEmailsInFile = new Map<string, number>(); // email -> first rowNumber
  const emailsToCheckInDb: string[] = [];

  // 2. Iterate Rows and Validate In-Memory
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rawName = cleanCellValue(row.getCell(nameColIdx).value);
    const rawEmail = cleanCellValue(row.getCell(emailColIdx).value).toLowerCase();
    let rawPhone = cleanCellValue(row.getCell(phoneColIdx).value);
    let rawTrainingYear = cleanCellValue(row.getCell(yearColIdx).value);
    let rawDivision = cleanCellValue(row.getCell(divisionColIdx).value).toUpperCase();

    // Skip empty trailing rows
    if (!rawName && !rawEmail && !rawPhone && !rawTrainingYear && !rawDivision) {
      return;
    }

    // Clean phone number format
    if (rawPhone.startsWith("+91")) rawPhone = rawPhone.slice(3).trim();
    if (rawPhone.startsWith("0")) rawPhone = rawPhone.slice(1).trim();
    rawPhone = rawPhone.replace(/[\s\-]/g, "");

    // Normalize Training Year casing if recognizable
    const yearLower = rawTrainingYear.toLowerCase().trim();
    if (yearLower === "1st year" || yearLower === "1" || yearLower === "1st") {
      rawTrainingYear = "1st Year";
    } else if (yearLower === "2nd year" || yearLower === "2" || yearLower === "2nd") {
      rawTrainingYear = "2nd Year";
    } else if (yearLower === "3rd year" || yearLower === "3" || yearLower === "3rd") {
      rawTrainingYear = "3rd Year";
    }

    // Normalize Division
    if (rawDivision === "SENIOR DIVISION" || rawDivision === "MALE") {
      rawDivision = "SD";
    } else if (rawDivision === "SENIOR WING" || rawDivision === "FEMALE") {
      rawDivision = "SW";
    }

    const errors: string[] = [];

    // Zod schema validation
    const parsed = CadetImportRowInputSchema.safeParse({
      name: rawName,
      email: rawEmail,
      phone: rawPhone,
      trainingYear: rawTrainingYear,
      division: rawDivision,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }

    // Check duplicate email inside file
    let isDuplicateInFile = false;
    if (rawEmail) {
      if (seenEmailsInFile.has(rawEmail)) {
        isDuplicateInFile = true;
        const prevRow = seenEmailsInFile.get(rawEmail);
        errors.push(`Duplicate email in file (previously seen on row ${prevRow}).`);
      } else {
        seenEmailsInFile.set(rawEmail, rowNumber);
        emailsToCheckInDb.push(rawEmail);
      }
    }

    rows.push({
      rowNumber,
      name: rawName,
      email: rawEmail,
      phone: rawPhone,
      trainingYear: (rawTrainingYear as "1st Year" | "2nd Year" | "3rd Year") || "1st Year",
      division: (rawDivision as "SD" | "SW") || "SD",
      isValid: errors.length === 0,
      errors,
      isDuplicateInFile,
    });
  });

  // 3. Batch Check Existing Emails in Firestore
  const existingEmailsInDb = new Set<string>();

  if (emailsToCheckInDb.length > 0) {
    // Firestore `in` queries support up to 30 items per batch
    const BATCH_SIZE = 30;
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

  // 4. Update validity flag for DB duplicates
  let validCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    if (existingEmailsInDb.has(row.email)) {
      row.isDuplicateInDb = true;
      row.errors.push("Email is already registered to an existing cadet or user account.");
      row.isValid = false;
    }

    if (row.isValid) {
      validCount++;
    } else {
      errorCount++;
    }
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validCount,
      errorCount,
      duplicateEmailsInBatch: Array.from(seenEmailsInFile.keys()).filter((e) => {
        let count = 0;
        for (const r of rows) {
          if (r.email === e) count++;
        }
        return count > 1;
      }),
      existingEmailsInDb: Array.from(existingEmailsInDb),
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
  existingCadets: CadetRecord[]
): Promise<{
  rows: EnrollmentImportRow[];
  summary: EnrollmentImportSummary;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.getWorksheet("Enrollment") || workbook.worksheets[0];
  if (!sheet) {
    throw new Error("No readable worksheet found in the uploaded workbook.");
  }

  let nameColIdx = -1;
  let enrollmentColIdx = -1;

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const header = cleanCellValue(cell.value).toLowerCase();
    if (header === "name" || header === "cadet name" || header === "full name") {
      nameColIdx = colNumber;
    } else if (
      header === "enrollment number" ||
      header === "enrollment no" ||
      header === "regimental number" ||
      header === "regimental no" ||
      header === "enrollment"
    ) {
      enrollmentColIdx = colNumber;
    }
  });

  if (nameColIdx === -1 || enrollmentColIdx === -1) {
    const missing: string[] = [];
    if (nameColIdx === -1) missing.push("Name");
    if (enrollmentColIdx === -1) missing.push("Enrollment Number");
    throw new Error(
      `Invalid spreadsheet structure. Missing required column headers: ${missing.join(", ")}. Please use the official template.`
    );
  }

  // Pre-index existing cadets for collision detection
  const assignedEnrollments = new Map<string, string>(); // enrollmentNo -> cadetId
  for (const c of existingCadets) {
    if (c.enrollmentNo) {
      assignedEnrollments.set(c.enrollmentNo.trim().toUpperCase(), c.cadetId);
    }
  }

  const rows: EnrollmentImportRow[] = [];
  const seenEnrollmentsInFile = new Map<string, number>();

  let exactCount = 0;
  let ambiguousCount = 0;
  let unmatchedCount = 0;
  let invalidCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawName = cleanCellValue(row.getCell(nameColIdx).value);
    const rawEnrollment = cleanCellValue(row.getCell(enrollmentColIdx).value).toUpperCase();

    if (!rawName && !rawEnrollment) return;

    const errors: string[] = [];

    const parsed = EnrollmentRowInputSchema.safeParse({
      name: rawName,
      enrollmentNo: rawEnrollment,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }

    // Check duplicate enrollment number within the same file
    if (rawEnrollment) {
      if (seenEnrollmentsInFile.has(rawEnrollment)) {
        const prevRow = seenEnrollmentsInFile.get(rawEnrollment);
        errors.push(`Duplicate enrollment number in file (already specified on row ${prevRow}).`);
      } else {
        seenEnrollmentsInFile.set(rawEnrollment, rowNumber);
      }
    }

    // Find matches in existing cadets
    const normalizedInput = normalizeName(rawName);
    const candidateCadets: CadetCandidateMatch[] = [];

    for (const c of existingCadets) {
      const normalizedCandidate = normalizeName(c.fullName);
      if (
        c.fullName.toLowerCase() === rawName.toLowerCase() ||
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

      // Check if this enrollment number is already assigned to a different cadet
      const currentAssignedCadet = assignedEnrollments.get(rawEnrollment);
      if (currentAssignedCadet && currentAssignedCadet !== matchedCadetId) {
        errors.push(
          `Enrollment number '${rawEnrollment}' is already assigned to another cadet (${currentAssignedCadet}).`
        );
        matchStatus = "invalid";
        invalidCount++;
      } else {
        exactCount++;
      }
    } else if (candidateCadets.length > 1) {
      // Ambiguous match — Never guess! Require administrator manual disambiguation
      matchStatus = "ambiguous";
      matchedCadetId = null;
      errors.push(
        `Ambiguous match: ${candidateCadets.length} cadets found with name "${rawName}". Please select the correct cadet.`
      );
      ambiguousCount++;
    } else {
      // 0 candidates
      matchStatus = "unmatched";
      matchedCadetId = null;
      errors.push(`No cadet record found matching name "${rawName}".`);
      unmatchedCount++;
    }

    rows.push({
      rowNumber,
      name: rawName,
      enrollmentNo: rawEnrollment,
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
