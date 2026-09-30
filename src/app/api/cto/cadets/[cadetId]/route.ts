import { NextResponse } from "next/server";
import { requireCto, filterFieldsForRole, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import type { CadetRecord } from "@/types/cadet";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ cadetId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await requireCto();
    const { cadetId } = await params;

    const cadetDoc = await adminDb.collection("cadets").doc(cadetId).get();
    if (!cadetDoc.exists) {
      return NextResponse.json(
        { error: `Cadet record '${cadetId}' was not found.` },
        { status: 404 }
      );
    }

    const cadet = cadetDoc.data() as CadetRecord;

    // Fetch active categories & active fields
    const [categoriesSnap, fieldsSnap] = await Promise.all([
      adminDb.collection("categories").where("isActive", "==", true).get(),
      adminDb.collection("fields").where("isActive", "==", true).get(),
    ]);

    const allCategories = categoriesSnap.docs
      .map((d) => d.data() as CategoryDefinition)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const allFields = fieldsSnap.docs
      .map((d) => d.data() as FieldDefinition)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Apply strict field-level permission filter for CTO
    const ctoVisibleFields = filterFieldsForRole("cto", allFields, "view");
    const visibleFieldIds = new Set(ctoVisibleFields.map((f) => f.fieldId));

    // Filter categories that have at least one visible field
    const visibleCategoryIds = new Set(ctoVisibleFields.map((f) => f.categoryId));
    const ctoCategories = allCategories.filter((c) => visibleCategoryIds.has(c.categoryId));

    // Sanitize dynamicData to strictly prevent leaking hidden attributes
    const sanitizedDynamicData: Record<string, unknown> = {};
    if (cadet.dynamicData) {
      for (const [k, v] of Object.entries(cadet.dynamicData)) {
        if (visibleFieldIds.has(k)) {
          sanitizedDynamicData[k] = v;
        }
      }
    }

    const sanitizedCadet: CadetRecord = {
      ...cadet,
      dynamicData: sanitizedDynamicData,
    };

    // Mandatory Audit Log: every CTO view must be audited (§ Spec Section 29)
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "cto",
      action: "cto.view_cadet",
      entityType: "cadet",
      entityId: cadetId,
      metadata: {
        cadetName: cadet.fullName,
        unit: cadet.unit,
        wing: cadet.wing,
      },
    });

    return NextResponse.json({
      cadet: sanitizedCadet,
      categories: ctoCategories,
      fields: ctoVisibleFields,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/cto/cadets/[cadetId] error:", error);
    return NextResponse.json(
      { error: "Internal server error while retrieving cadet details" },
      { status: 500 }
    );
  }
}

export async function PUT() {
  try {
    await requireCto();

    // CTO cannot edit cadet fields directly per security policy
    return NextResponse.json(
      {
        error: "Access denied. Caretaker Officers (CTO) have read-only access and cannot edit cadet records.",
        code: "FORBIDDEN_READ_ONLY",
      },
      { status: 403 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
