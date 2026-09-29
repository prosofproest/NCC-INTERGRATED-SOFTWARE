import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";
import type { CadetRecord, CadetSummary } from "@/types/cadet";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-requests/options
 * Returns active categories, dynamic fields, and active cadet rosters needed
 * to populate the Create Data Request wizard.
 * Accessible to Admin and CTO roles.
 */
export async function GET() {
  try {
    await requireRole(["admin", "cto"]);

    const [categoriesSnap, fieldsSnap, cadetsSnap] = await Promise.all([
      adminDb.collection("categories").where("isActive", "==", true).get(),
      adminDb.collection("fields").where("isActive", "==", true).get(),
      adminDb.collection("cadets").where("status", "==", "active").get(),
    ]);

    const categories = categoriesSnap.docs
      .map((d) => d.data() as CategoryDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const fields = fieldsSnap.docs
      .map((d) => d.data() as FieldDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const cadets: CadetSummary[] = cadetsSnap.docs
      .map((d) => {
        const c = d.data() as CadetRecord;
        return {
          cadetId: c.cadetId,
          fullName: c.fullName,
          email: c.email,
          enrollmentNo: c.enrollmentNo,
          rank: c.rank,
          unit: c.unit,
          wing: c.wing,
          status: c.status,
          completionPercentage: c.completionPercentage || 0,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({
      success: true,
      categories,
      fields,
      cadets,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error fetching data request options:", error);
    return NextResponse.json(
      { error: err.message || "Failed to fetch data request options" },
      { status: err.statusCode || 500 }
    );
  }
}
