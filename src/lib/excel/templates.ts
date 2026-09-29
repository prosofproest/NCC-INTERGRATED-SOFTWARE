import ExcelJS from "exceljs";

/**
 * Generates the Cadet Onboarding Excel template with sample data and guidelines.
 */
export async function generateCadetOnboardingTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NCC Integrated System";
  workbook.lastModifiedBy = "Admin";
  workbook.created = new Date();

  // Sheet 1: Cadets Template
  const sheet = workbook.addWorksheet("Cadets", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Name", key: "name", width: 32 },
    { header: "Email", key: "email", width: 38 },
    { header: "Phone", key: "phone", width: 22 },
  ];

  // Header Style
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate-800
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Sample Rows
  sheet.addRow({
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    phone: "9876543210",
  });
  sheet.addRow({
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "9812345678",
  });

  // Style data rows
  for (let i = 2; i <= 3; i++) {
    const row = sheet.getRow(i);
    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  // Sheet 2: Instructions
  const infoSheet = workbook.addWorksheet("Instructions", {
    views: [{ showGridLines: true }],
  });

  infoSheet.columns = [
    { header: "Field Name", key: "field", width: 24 },
    { header: "Requirement", key: "requirement", width: 16 },
    { header: "Specification / Description", key: "spec", width: 60 },
  ];

  const infoHeader = infoSheet.getRow(1);
  infoHeader.height = 24;
  infoHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle" };
  });

  infoSheet.addRow({
    field: "Name",
    requirement: "Mandatory",
    spec: "Official cadet full name (e.g. Aarav Sharma). Minimum 2 characters.",
  });
  infoSheet.addRow({
    field: "Email",
    requirement: "Mandatory",
    spec: "Unique email address for portal authentication. Duplicates will be rejected.",
  });
  infoSheet.addRow({
    field: "Phone",
    requirement: "Mandatory",
    spec: "10-digit Indian mobile number (e.g. 9876543210). Optional +91 prefix accepted.",
  });
  infoSheet.addRow({
    field: "Security Note",
    requirement: "System Policy",
    spec: "Accounts will be provisioned with a secure temporary password. Cadets must change password on first login.",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates the Regimental Enrollment Number Excel template.
 */
export async function generateEnrollmentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NCC Integrated System";
  workbook.lastModifiedBy = "Admin";
  workbook.created = new Date();

  // Sheet 1: Enrollment Template
  const sheet = workbook.addWorksheet("Enrollment", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "Name", key: "name", width: 34 },
    { header: "Enrollment Number", key: "enrollmentNo", width: 28 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  sheet.addRow({
    name: "Cdt. Aarav Sharma",
    enrollmentNo: "KA24SDA100101",
  });
  sheet.addRow({
    name: "Cpl. Priya Patel",
    enrollmentNo: "KA23SWA100205",
  });

  for (let i = 2; i <= 3; i++) {
    const row = sheet.getRow(i);
    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  // Sheet 2: Guidelines
  const infoSheet = workbook.addWorksheet("Guidelines", {
    views: [{ showGridLines: true }],
  });

  infoSheet.columns = [
    { header: "Topic", key: "topic", width: 24 },
    { header: "Guideline", key: "guideline", width: 68 },
  ];

  const infoHeader = infoSheet.getRow(1);
  infoHeader.height = 24;
  infoHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  });

  infoSheet.addRow({
    topic: "Matching Process",
    guideline: "The system matches each row against enrolled cadets by name. If multiple cadets share the same name, the system requires administrative disambiguation.",
  });
  infoSheet.addRow({
    topic: "Regimental Format",
    guideline: "Official NCC enrollment codes (e.g. KA24SDA100101 or KAR/23/SD/...). Must be between 3 and 30 characters.",
  });
  infoSheet.addRow({
    topic: "No Cadet Creation",
    guideline: "This template only updates existing cadet records. It will never create new cadet accounts.",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
