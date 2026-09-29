import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { parseCadetOnboardingFile } from "@/lib/excel/parse";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/excel/parse-onboarding
 * Validates and pre-inspects an uploaded Cadet Onboarding spreadsheet.
 * Pure read-only operation — performs 0 database writes.
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

    const result = await parseCadetOnboardingFile(buffer);

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
    console.error("POST /api/admin/excel/parse-onboarding error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to parse onboarding spreadsheet." },
      { status: 400 }
    );
  }
}
