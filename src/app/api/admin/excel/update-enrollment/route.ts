import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { EnrollmentBatchConfirmInputSchema } from "@/lib/validation/excel";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/excel/update-enrollment
 * Applies confirmed regimental enrollment numbers to matched cadets.
 * Strictly updates existing records; never creates new cadets (Rule 6).
 * Strictly Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await req.json();
    const parseResult = EnrollmentBatchConfirmInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for enrollment batch update payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { updates } = parseResult.data;
    const now = new Date().toISOString();

    const updatedCadetIds: string[] = [];
    const failedUpdates: Array<{ cadetId: string; error: string }> = [];

    // Perform atomic batch update
    const batch = adminDb.batch();

    for (const item of updates) {
      const cadetRef = adminDb.collection("cadets").doc(item.cadetId);
      batch.update(cadetRef, {
        enrollmentNo: item.enrollmentNo.trim().toUpperCase(),
        updatedAt: now,
      });
      updatedCadetIds.push(item.cadetId);
    }

    await batch.commit();

    // Audit Log Entry
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "CADET_UPDATED",
      entityType: "cadet",
      entityId: updatedCadetIds[0] || "BATCH_ENROLLMENT_UPDATE",
      newState: {
        updatedCount: updatedCadetIds.length,
        cadetIds: updatedCadetIds,
      },
      metadata: {
        operation: "BULK_ENROLLMENT_UPDATE",
        updatedCount: updatedCadetIds.length,
        enrollmentMappings: updates,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updatedCadetIds.length,
      updatedCadetIds,
      failedUpdates,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/excel/update-enrollment error:", error);
    return NextResponse.json(
      { error: "Failed to update enrollment numbers." },
      { status: 500 }
    );
  }
}
