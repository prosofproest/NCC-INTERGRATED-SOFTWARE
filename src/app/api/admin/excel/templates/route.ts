import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { generateCadetOnboardingTemplate, generateEnrollmentTemplate } from "@/lib/excel/templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/excel/templates?type=onboarding|enrollment
 * Downloads official Excel templates for cadet onboarding or enrollment update.
 * Strictly Admin-only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    let buffer: Buffer;
    let filename: string;

    if (type === "enrollment") {
      buffer = await generateEnrollmentTemplate();
      filename = "ncc_cadet_enrollment_template.xlsx";
    } else {
      buffer = await generateCadetOnboardingTemplate();
      filename = "ncc_cadet_onboarding_template.xlsx";
    }

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
    console.error("GET /api/admin/excel/templates error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel template." },
      { status: 500 }
    );
  }
}
