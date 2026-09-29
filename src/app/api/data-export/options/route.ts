import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { FieldDefinition, CategoryDefinition } from "@/types/fields";
import type { ExportFieldOption } from "@/types/excel";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-export/options
 * Returns available export columns and filter options.
 * Accessible to Admin and CTO (with ctoExportable filtering enforced for CTO).
 */
export async function GET() {
  try {
    const session = await requireRole(["admin", "cto"]);
    const isCto = session.role === "cto";

    // 1. Fetch categories for grouping
    const categoriesSnap = await adminDb
      .collection("categories")
      .where("isActive", "==", true)
      .get();
    const categories = categoriesSnap.docs.map((doc) => doc.data() as CategoryDefinition);
    const categoryNameMap = new Map<string, string>();
    for (const cat of categories) {
      categoryNameMap.set(cat.categoryId, cat.name);
    }

    // 2. Fetch active dynamic fields
    const fieldsSnap = await adminDb
      .collection("fields")
      .where("isActive", "==", true)
      .get();
    const allFields = fieldsSnap.docs.map((doc) => doc.data() as FieldDefinition);

    // 3. Define Core Fields
    const coreFieldOptions: ExportFieldOption[] = [
      {
        id: "core_cadetId",
        label: "Cadet ID",
        category: "Master Identity",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_fullName",
        label: "Full Name",
        category: "Master Identity",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_enrollmentNo",
        label: "Enrollment Number",
        category: "Regimental Info",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_rank",
        label: "Rank",
        category: "Regimental Info",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_wing",
        label: "Wing",
        category: "Regimental Info",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_unit",
        label: "Unit",
        category: "Regimental Info",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_status",
        label: "Account Status",
        category: "System Status",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_email",
        label: "Email Address",
        category: "Contact Info",
        isCore: true,
        ctoExportable: false, // Hidden from CTO
      },
      {
        id: "core_completion",
        label: "Profile Completion %",
        category: "System Status",
        isCore: true,
        ctoExportable: true,
      },
      {
        id: "core_createdAt",
        label: "Enrolled Date",
        category: "System Status",
        isCore: true,
        ctoExportable: true,
      },
    ];

    // Filter core fields if CTO
    const allowedCoreFields = isCto
      ? coreFieldOptions.filter((f) => f.ctoExportable)
      : coreFieldOptions;

    // 4. Map Dynamic Fields
    const dynamicFieldOptions: ExportFieldOption[] = [];
    for (const field of allFields) {
      if (isCto && !field.permissions?.ctoExportable) {
        continue; // Omit non-ctoExportable fields for CTO
      }
      dynamicFieldOptions.push({
        id: field.fieldId,
        label: field.label,
        category: categoryNameMap.get(field.categoryId) || "Dynamic Profile",
        isCore: false,
        ctoExportable: Boolean(field.permissions?.ctoExportable),
      });
    }

    return NextResponse.json({
      success: true,
      isCto,
      coreFields: allowedCoreFields,
      dynamicFields: dynamicFieldOptions,
      allAvailableFields: [...allowedCoreFields, ...dynamicFieldOptions],
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/data-export/options error:", error);
    return NextResponse.json(
      { error: "Failed to load export options." },
      { status: 500 }
    );
  }
}
