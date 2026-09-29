import { NextResponse } from "next/server";
import { requireCadet, requireCadetOwnership, canEditField, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import type { CadetRecord } from "@/types/cadet";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

/**
 * Helper to resolve the authenticated cadet's master record.
 */
async function resolveCurrentCadet(session: { uid: string; email: string; cadetId?: string }) {
  if (session.cadetId) {
    const snap = await adminDb.collection("cadets").doc(session.cadetId).get();
    if (snap.exists) {
      return snap.data() as CadetRecord;
    }
  }

  // Fallback lookup by userId or email
  const byUserSnap = await adminDb
    .collection("cadets")
    .where("userId", "==", session.uid)
    .limit(1)
    .get();
  if (!byUserSnap.empty) {
    return byUserSnap.docs[0].data() as CadetRecord;
  }

  const byEmailSnap = await adminDb
    .collection("cadets")
    .where("email", "==", session.email)
    .limit(1)
    .get();
  if (!byEmailSnap.empty) {
    return byEmailSnap.docs[0].data() as CadetRecord;
  }

  return null;
}

export async function GET() {
  try {
    const session = await requireCadet();
    const cadet = await resolveCurrentCadet(session);

    if (!cadet) {
      return NextResponse.json(
        { error: "Cadet profile is not yet linked. Contact your battalion administrator." },
        { status: 404 }
      );
    }

    // Verify ownership
    await requireCadetOwnership(cadet.cadetId);

    // Fetch active categories and active fields
    const [categoriesSnap, fieldsSnap] = await Promise.all([
      adminDb.collection("categories").where("isActive", "==", true).get(),
      adminDb.collection("fields").where("isActive", "==", true).get(),
    ]);

    const categories = categoriesSnap.docs
      .map((d) => d.data() as CategoryDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const fields = fieldsSnap.docs
      .map((d) => d.data() as FieldDefinition)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return NextResponse.json({
      cadet,
      categories,
      fields,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/cadet/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireCadet();
    const cadet = await resolveCurrentCadet(session);

    if (!cadet) {
      return NextResponse.json(
        { error: "Cadet profile is not yet linked. Contact your battalion administrator." },
        { status: 404 }
      );
    }

    // Verify ownership
    await requireCadetOwnership(cadet.cadetId);

    const body = await request.json();
    const incomingDynamic = body.dynamicData || {};

    // Fetch active field definitions to validate permissions
    const fieldsSnap = await adminDb.collection("fields").where("isActive", "==", true).get();
    const activeFields = fieldsSnap.docs.map((d) => d.data() as FieldDefinition);
    const fieldMap = new Map(activeFields.map((f) => [f.fieldId, f]));

    // Check each updated field:
    // If field is locked (cadetEditable: false), reject if incoming value differs from existing
    const existingDynamic = cadet.dynamicData || {};
    const allowedUpdates: Record<string, unknown> = {};

    for (const [fieldId, incomingVal] of Object.entries(incomingDynamic)) {
      const fieldDef = fieldMap.get(fieldId);
      if (!fieldDef) {
        continue;
      }

      const currentVal = existingDynamic[fieldId];
      const isChanged = JSON.stringify(currentVal) !== JSON.stringify(incomingVal);

      if (isChanged) {
        const canEdit = canEditField("cadet", fieldDef, true);
        if (!canEdit) {
          return NextResponse.json(
            {
              error: `Field '${fieldDef.label}' is protected and cannot be directly modified. Please submit a Change Request.`,
              fieldId,
            },
            { status: 403 }
          );
        }
        allowedUpdates[fieldId] = incomingVal;
      }
    }

    const updatedDynamicData = {
      ...existingDynamic,
      ...allowedUpdates,
    };

    // Recalculate Completion Percentage
    const requiredActiveFields = activeFields.filter((f) => f.validation?.required);
    const totalRequiredCount = 4 + requiredActiveFields.length; // core: fullName, rank, unit, wing

    let filledCount = 0;
    if (cadet.fullName) filledCount++;
    if (cadet.rank) filledCount++;
    if (cadet.unit) filledCount++;
    if (cadet.wing) filledCount++;

    for (const field of requiredActiveFields) {
      const val = updatedDynamicData[field.fieldId];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        filledCount++;
      }
    }

    const completionPercentage = Math.min(100, Math.round((filledCount / totalRequiredCount) * 100));
    const timestamp = new Date().toISOString();

    const updatedCadet: CadetRecord = {
      ...cadet,
      dynamicData: updatedDynamicData,
      completionPercentage,
      updatedAt: timestamp,
    };

    await adminDb.collection("cadets").doc(cadet.cadetId).set(updatedCadet);

    // Audit Log Entry
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "cadet",
      action: "cadet.profile.update",
      entityType: "cadet",
      entityId: cadet.cadetId,
      previousState: existingDynamic,
      newState: updatedDynamicData,
      metadata: {
        cadetId: cadet.cadetId,
        updatedFieldIds: Object.keys(allowedUpdates),
        completionPercentage,
      },
    });

    return NextResponse.json({
      success: true,
      cadet: updatedCadet,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("PUT /api/cadet/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error while saving profile" },
      { status: 500 }
    );
  }
}
