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
    { header: "Email", key: "email", width: 36 },
    { header: "Phone", key: "phone", width: 22 },
    { header: "Enrollment ID", key: "enrollmentNo", width: 26 },
    { header: "Gender", key: "gender", width: 16 },
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
    enrollmentNo: "KA26SDA100101",
    gender: "MALE",
  });
  sheet.addRow({
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "9812345678",
    enrollmentNo: "KA26SWA100205",
    gender: "FEMALE",
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
    { header: "Requirement", key: "requirement", width: 18 },
    { header: "Specification / Description", key: "spec", width: 68 },
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
    spec: "10-digit Indian mobile number (e.g. 9876543210). Floating point numbers and +91 are handled automatically.",
  });
  infoSheet.addRow({
    field: "Enrollment ID",
    requirement: "Optional",
    spec: "Official regimental number (e.g. KA26SDA100101). Stored in uppercase. If left blank, cadet can onboard via email and ID can be assigned later.",
  });
  infoSheet.addRow({
    field: "Gender",
    requirement: "Mandatory",
    spec: "Values: MALE / M (derived as Senior Division SD) or FEMALE / F (derived as Senior Wing SW).",
  });
  infoSheet.addRow({
    field: "Training Year",
    requirement: "App Selection",
    spec: "Training Year (1st, 2nd, or 3rd Year) is chosen directly in the web app during upload, or inferred if a Year column is provided.",
  });
  infoSheet.addRow({
    field: "Security Policy",
    requirement: "Strict Privacy",
    spec: "Only mapped columns are read. All extraneous columns (DOB, parents, addresses) in wider sheets are automatically ignored and never stored.",
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
