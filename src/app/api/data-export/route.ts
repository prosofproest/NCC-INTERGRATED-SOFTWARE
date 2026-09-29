import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { generateCadetExportWorkbook } from "@/lib/excel/export";
import { ExportRequestInputSchema } from "@/lib/validation/excel";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

/**
 * POST /api/data-export
 * Generates and downloads an Excel export of cadet master records.
 * Enforces ctoExportable constraints when invoked in a CTO context.
 * Accessible to Admin and CTO.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["admin", "cto"]);
    const isCto = session.role === "cto";

    const body = await req.json();
    const parseResult = ExportRequestInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for export request.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { selectedFieldIds, wing, status, rank, search } = parseResult.data;

    // 1. Build Firestore Query
    let query: FirebaseFirestore.Query = adminDb.collection("cadets");

    if (wing && wing !== "all") {
      query = query.where("wing", "==", wing);
    }

    if (isCto) {
      // CTO is strictly restricted to active cadets
      query = query.where("status", "==", "active");
    } else if (status && status !== "all") {
      query = query.where("status", "==", status);
    }

    if (rank && rank !== "all") {
      query = query.where("rank", "==", rank);
    }

    const snapshot = await query.get();
    let cadets = snapshot.docs.map((doc) => doc.data() as CadetRecord);

    // 2. In-Memory Search Filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      cadets = cadets.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.cadetId.toLowerCase().includes(q) ||
          (c.enrollmentNo && c.enrollmentNo.toLowerCase().includes(q))
      );
    }

    // 3. Fetch Active Field Definitions
    const fieldsSnap = await adminDb
      .collection("fields")
      .where("isActive", "==", true)
      .get();
    const allFields = fieldsSnap.docs.map((doc) => doc.data() as FieldDefinition);

    // 4. Generate Styled Excel Workbook
    const buffer = await generateCadetExportWorkbook(
      cadets,
      allFields,
      selectedFieldIds,
      {
        requesterEmail: session.email,
        requesterRole: session.role as "admin" | "cto",
        isCto,
      }
    );

    // 5. Audit Log Entry
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "DATA_EXPORTED",
      entityType: "system",
      entityId: "EXCEL_EXPORT",
      metadata: {
        exportedCadetsCount: cadets.length,
        selectedFieldsCount: selectedFieldIds.length,
        selectedFieldIds,
        filters: { wing, status, rank, search },
        isCtoContext: isCto,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `ncc_cadets_export_${timestamp}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/data-export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel export." },
      { status: 500 }
    );
  }
}
