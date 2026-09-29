import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { parseEnrollmentFile } from "@/lib/excel/parse";
import type { CadetRecord } from "@/types/cadet";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/excel/parse-enrollment
 * Validates and matches an uploaded Enrollment Numbers spreadsheet against existing cadets.
 * Handles exact, ambiguous, and unmatched names safely without guessing.
 * Strictly Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No Excel file provided in request." },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload an Excel (.xlsx) file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fetch existing cadets to perform safe name matching
    const cadetsSnap = await adminDb.collection("cadets").get();
    const existingCadets = cadetsSnap.docs.map((doc) => doc.data() as CadetRecord);

    const result = await parseEnrollmentFile(buffer, existingCadets);

    return NextResponse.json({
      success: true,
      rows: result.rows,
      summary: result.summary,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/excel/parse-enrollment error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to parse enrollment spreadsheet." },
      { status: 400 }
    );
  }
}
