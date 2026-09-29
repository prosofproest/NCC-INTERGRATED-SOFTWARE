import ExcelJS from "exceljs";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export interface CadetExportMeta {
  requesterEmail: string;
  requesterRole: "admin" | "cto";
  isCto: boolean;
}

interface ColumnDescriptor {
  id: string;
  header: string;
  width: number;
  getValue: (cadet: CadetRecord) => string | number | null;
}

/**
 * Builds and formats a high-fidelity NCC nominal roll spreadsheet using ExcelJS.
 */
export async function generateCadetExportWorkbook(
  cadets: CadetRecord[],
  fields: FieldDefinition[],
  selectedFieldIds: string[],
  meta: CadetExportMeta
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NCC Integrated System";
  workbook.lastModifiedBy = meta.requesterEmail;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Nominal Roll", {
    views: [{ showGridLines: true }],
  });

  // 1. Build Column Definitions
  const columns: ColumnDescriptor[] = [];

  // Core Column Mapping
  const coreColumnMap: Record<string, ColumnDescriptor> = {
    core_cadetId: {
      id: "core_cadetId",
      header: "Cadet ID",
      width: 16,
      getValue: (c) => c.cadetId,
    },
    core_fullName: {
      id: "core_fullName",
      header: "Full Name",
      width: 26,
      getValue: (c) => c.fullName,
    },
    core_enrollmentNo: {
      id: "core_enrollmentNo",
      header: "Enrollment Number",
      width: 22,
      getValue: (c) => c.enrollmentNo || "Pending",
    },
    core_rank: {
      id: "core_rank",
      header: "Rank",
      width: 16,
      getValue: (c) => c.rank,
    },
    core_wing: {
      id: "core_wing",
      header: "Wing",
      width: 14,
      getValue: (c) => c.wing,
    },
    core_unit: {
      id: "core_unit",
      header: "Unit",
      width: 24,
      getValue: (c) => c.unit,
    },
    core_status: {
      id: "core_status",
      header: "Status",
      width: 14,
      getValue: (c) => c.status,
    },
    core_email: {
      id: "core_email",
      header: "Email Address",
      width: 30,
      getValue: (c) => c.email,
    },
    core_completion: {
      id: "core_completion",
      header: "Completion %",
      width: 16,
      getValue: (c) => `${c.completionPercentage || 0}%`,
    },
    core_createdAt: {
      id: "core_createdAt",
      header: "Enrolled Date",
      width: 18,
      getValue: (c) => {
        try {
          return new Date(c.createdAt).toLocaleDateString("en-IN");
        } catch {
          return c.createdAt;
        }
      },
    },
  };

  // Add selected core columns
  for (const fieldId of selectedFieldIds) {
    if (coreColumnMap[fieldId]) {
      // In CTO context, ensure core fields are authorized (email is sensitive, omit if CTO unless explicit)
      if (meta.isCto && fieldId === "core_email") {
        continue;
      }
      columns.push(coreColumnMap[fieldId]);
    }
  }

  // Dynamic field definitions lookup
  const fieldDefMap = new Map<string, FieldDefinition>();
  for (const f of fields) {
    fieldDefMap.set(f.fieldId, f);
  }

  // Add selected dynamic fields
  for (const fieldId of selectedFieldIds) {
    const fieldDef = fieldDefMap.get(fieldId);
    if (!fieldDef) continue;

    // Strict CTO Exportable Security Check
    if (meta.isCto && !fieldDef.permissions.ctoExportable) {
      continue;
    }

    columns.push({
      id: fieldDef.fieldId,
      header: fieldDef.label,
      width: Math.max(16, fieldDef.label.length + 4),
      getValue: (c) => {
        const val = c.dynamicData ? c.dynamicData[fieldDef.fieldId] : null;
        if (val === null || val === undefined) return "—";
        if (typeof val === "boolean") return val ? "Yes" : "No";
        if (Array.isArray(val)) return val.join(", ");
        return String(val);
      },
    });
  }

  // If no columns matched, fallback to basic core columns
  if (columns.length === 0) {
    columns.push(
      coreColumnMap["core_cadetId"],
      coreColumnMap["core_fullName"],
      coreColumnMap["core_rank"],
      coreColumnMap["core_wing"]
    );
  }

  // 2. Set Up Column Dimensions
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.id,
    width: col.width,
  }));

  // 3. Insert Title Banner & Metadata at the Top
  // Shift headers down to row 4
  sheet.spliceRows(1, 0, [], [], []);

  // Title Row (Row 1)
  const titleRow = sheet.getRow(1);
  titleRow.height = 32;
  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "NATIONAL CADET CORPS — CADET NOMINAL ROLL / MASTER EXPORT";
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate-900
  };
  titleCell.font = {
    name: "Calibri",
    size: 13,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // Metadata Row (Row 2)
  const metaRow = sheet.getRow(2);
  metaRow.height = 20;
  sheet.mergeCells(2, 1, 2, columns.length);
  const metaCell = sheet.getCell("A2");
  const formattedDate = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  metaCell.value = `Exported on: ${formattedDate} | Generated by: ${meta.requesterEmail} (${meta.requesterRole.toUpperCase()}) | Total Records: ${cadets.length}`;
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Slate-800
  };
  metaCell.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: "FFCBD5E1" },
  };
  metaCell.alignment = { vertical: "middle", horizontal: "center" };

  // Empty separator row (Row 3)
  sheet.getRow(3).height = 8;

  // Header Row (Row 4)
  const headerRow = sheet.getRow(4);
  headerRow.height = 26;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" }, // Slate-700
    };
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  // 4. Insert Cadet Data Rows
  cadets.forEach((cadet, rowIdx) => {
    const rowValues = columns.map((col) => col.getValue(cadet));
    const dataRow = sheet.addRow(rowValues);
    dataRow.height = 20;

    const isEven = rowIdx % 2 === 0;
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
