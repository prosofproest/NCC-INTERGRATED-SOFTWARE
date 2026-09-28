import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
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
    await requireAdmin();
    const { cadetId } = await params;

    const cadetDoc = await adminDb.collection("cadets").doc(cadetId).get();
    if (!cadetDoc.exists) {
      return NextResponse.json(
        { error: `Cadet record '${cadetId}' was not found.` },
        { status: 404 }
      );
    }

    const cadet = cadetDoc.data() as CadetRecord;

    // Fetch active categories & active fields for grouped rendering
    const [categoriesSnap, fieldsSnap] = await Promise.all([
      adminDb.collection("categories").where("isActive", "==", true).get(),
      adminDb.collection("fields").where("isActive", "==", true).get(),
    ]);

    const categories = categoriesSnap.docs
      .map((d) => d.data() as CategoryDefinition)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const fields = fieldsSnap.docs
      .map((d) => d.data() as FieldDefinition)
      .sort((a, b) => a.sortOrder - b.sortOrder);

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
    console.error("GET /api/admin/cadets/[cadetId] error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching cadet details" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { cadetId } = await params;

    const cadetRef = adminDb.collection("cadets").doc(cadetId);
    const cadetDoc = await cadetRef.get();

    if (!cadetDoc.exists) {
      return NextResponse.json(
        { error: `Cadet record '${cadetId}' was not found.` },
        { status: 404 }
      );
    }

    const existingCadet = cadetDoc.data() as CadetRecord;
    const body = await request.json();

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : existingCadet.fullName;
    const enrollmentNo =
      body.enrollmentNo !== undefined
        ? body.enrollmentNo
          ? String(body.enrollmentNo).trim()
          : null
        : existingCadet.enrollmentNo;
    const rank = typeof body.rank === "string" ? body.rank.trim() : existingCadet.rank;
    const unit = typeof body.unit === "string" ? body.unit.trim() : existingCadet.unit;
    const wing = body.wing && ["Army", "Navy", "Air"].includes(body.wing) ? body.wing : existingCadet.wing;
    const status =
      body.status && ["active", "inactive", "suspended", "passed_out"].includes(body.status)
        ? body.status
        : existingCadet.status;

    const dynamicData = {
      ...(existingCadet.dynamicData || {}),
      ...(body.dynamicData || {}),
    };

    // Calculate Completion Percentage based on active fields
    const fieldsSnap = await adminDb.collection("fields").where("isActive", "==", true).get();
    const activeFields = fieldsSnap.docs.map((d) => d.data() as FieldDefinition);

    const requiredActiveFields = activeFields.filter((f) => f.validation?.required);
    const totalRequiredCount = 4 + requiredActiveFields.length; // core: fullName, rank, unit, wing

    let filledCount = 0;
    if (fullName) filledCount++;
    if (rank) filledCount++;
    if (unit) filledCount++;
    if (wing) filledCount++;

    for (const field of requiredActiveFields) {
      const val = dynamicData[field.fieldId];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        filledCount++;
      }
    }

    const completionPercentage = Math.min(100, Math.round((filledCount / totalRequiredCount) * 100));
    const updatedAt = new Date().toISOString();

    const updatedCadet: CadetRecord = {
      ...existingCadet,
      fullName,
      enrollmentNo,
      rank,
      unit,
      wing,
      status,
      dynamicData,
      completionPercentage,
      updatedAt,
    };

    await cadetRef.set(updatedCadet);

    // Audit Log Entry (§ Stage 5 & 6)
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "cadet.update",
      entityType: "cadet",
      entityId: cadetId,
      previousState: {
        fullName: existingCadet.fullName,
        enrollmentNo: existingCadet.enrollmentNo,
        rank: existingCadet.rank,
        unit: existingCadet.unit,
        wing: existingCadet.wing,
        status: existingCadet.status,
        dynamicData: existingCadet.dynamicData,
      },
      newState: {
        fullName: updatedCadet.fullName,
        enrollmentNo: updatedCadet.enrollmentNo,
        rank: updatedCadet.rank,
        unit: updatedCadet.unit,
        wing: updatedCadet.wing,
        status: updatedCadet.status,
        dynamicData: updatedCadet.dynamicData,
      },
      metadata: {
        cadetId,
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
    console.error("PUT /api/admin/cadets/[cadetId] error:", error);
    return NextResponse.json(
      { error: "Internal server error while updating cadet record" },
      { status: 500 }
    );
  }
}
