import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { ReviewChangeRequestInputSchema } from "@/lib/validation/request";
import type { ChangeRequest } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    changeRequestId: string;
  }>;
}

/**
 * GET /api/admin/change-requests/[changeRequestId]
 * Fetches single change request with cadet and field context.
 * Strict Admin-only access.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { changeRequestId } = await params;

    const crDoc = await adminDb.collection("change_requests").doc(changeRequestId).get();
    if (!crDoc.exists) {
      return NextResponse.json({ error: "Change request not found" }, { status: 404 });
    }

    const changeRequest = crDoc.data() as ChangeRequest;

    // Fetch cadet context
    const cadetDoc = await adminDb.collection("cadets").doc(changeRequest.cadetId).get();
    const cadet = cadetDoc.exists ? (cadetDoc.data() as CadetRecord) : null;

    // Fetch field definition
    const fieldDoc = await adminDb.collection("fields").doc(changeRequest.fieldId).get();
    const field = fieldDoc.exists ? (fieldDoc.data() as FieldDefinition) : null;

    return NextResponse.json({
      success: true,
      changeRequest,
      cadet,
      field,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/change-requests/[changeRequestId] error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching change request" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/change-requests/[changeRequestId]
 * Reviews (approves or rejects) a pending change request.
 * Transaction-safe with double-processing prevention and immutable audit logging.
 * Strict Admin-only access.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { changeRequestId } = await params;

    const body = await req.json();
    const parseResult = ReviewChangeRequestInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for review action.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { action, reviewerComments } = parseResult.data;
    const now = new Date().toISOString();

    const crRef = adminDb.collection("change_requests").doc(changeRequestId);

    // Run within a Firestore transaction for atomic check and write
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const crDoc = await transaction.get(crRef);
      if (!crDoc.exists) {
        throw new Error("NOT_FOUND: Change request does not exist.");
      }

      const crData = crDoc.data() as ChangeRequest;

      // 1. Prevent Double-Processing
      if (crData.status !== "pending") {
        throw new Error(
          `ALREADY_PROCESSED: This change request has already been reviewed and finalized as '${crData.status}'.`
        );
      }

      const cadetRef = adminDb.collection("cadets").doc(crData.cadetId);
      const cadetDoc = await transaction.get(cadetRef);

      if (!cadetDoc.exists) {
        throw new Error("NOT_FOUND: Associated cadet profile does not exist.");
      }

      const cadetData = cadetDoc.data() as CadetRecord;

      if (action === "approve") {
        // Update cadet's dynamicData with approved newValue
        const updatedDynamicData = {
          ...(cadetData.dynamicData || {}),
          [crData.fieldId]: crData.newValue,
        };

        transaction.update(cadetRef, {
          dynamicData: updatedDynamicData,
          updatedAt: now,
        });

        transaction.update(crRef, {
          status: "approved",
          reviewedBy: session.uid,
          reviewedByEmail: session.email,
          reviewedAt: now,
          reviewerComments: reviewerComments ? reviewerComments.trim() : null,
          updatedAt: now,
        });

        return {
          action: "approve",
          crData,
          cadetData,
          updatedDynamicData,
        };
      } else {
        // Reject: preserve history with reviewer comments
        transaction.update(crRef, {
          status: "rejected",
          reviewedBy: session.uid,
          reviewedByEmail: session.email,
          reviewedAt: now,
          reviewerComments: reviewerComments ? reviewerComments.trim() : "Rejected by administrator.",
          updatedAt: now,
        });

        return {
          action: "reject",
          crData,
          cadetData,
        };
      }
    });

    // Recalculate completion percentage if approved
    if (transactionResult.action === "approve" && transactionResult.updatedDynamicData) {
      try {
        const activeFieldsSnap = await adminDb
          .collection("fields")
          .where("isActive", "==", true)
          .get();

        const requiredActiveFields = activeFieldsSnap.docs
          .map((d) => d.data() as FieldDefinition)
          .filter((f) => f.validation?.required);

        const totalRequiredCount = 4 + requiredActiveFields.length;
        let filledCount = 0;
        if (transactionResult.cadetData.fullName) filledCount++;
        if (transactionResult.cadetData.rank) filledCount++;
        if (transactionResult.cadetData.unit) filledCount++;
        if (transactionResult.cadetData.wing) filledCount++;

        for (const field of requiredActiveFields) {
          const val = transactionResult.updatedDynamicData[field.fieldId];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            filledCount++;
          }
        }

        const completionPercentage = Math.min(
          100,
          Math.round((filledCount / totalRequiredCount) * 100)
        );

        await adminDb.collection("cadets").doc(transactionResult.crData.cadetId).update({
          completionPercentage,
        });
      } catch (pctErr) {
        console.error("Non-critical error recalculating completion percentage:", pctErr);
      }
    }

    // Audit Log Entry
    const auditAction =
      action === "approve" ? "CHANGE_REQUEST_APPROVED" : "CHANGE_REQUEST_REJECTED";

    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: auditAction,
      entityType: "change_request",
      entityId: changeRequestId,
      previousState: { status: "pending" },
      newState: {
        status: action === "approve" ? "approved" : "rejected",
        reviewedBy: session.email,
        reviewerComments: reviewerComments || null,
        approvedValue: action === "approve" ? transactionResult.crData.newValue : null,
      },
      metadata: {
        cadetId: transactionResult.crData.cadetId,
        fieldId: transactionResult.crData.fieldId,
        fieldLabel: transactionResult.crData.fieldLabel,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Change request successfully ${action === "approve" ? "approved" : "rejected"}.`,
      status: action === "approve" ? "approved" : "rejected",
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    const err = error as { message?: string };
    console.error("POST /api/admin/change-requests/[changeRequestId] error:", error);

    const isAlreadyProcessed = err.message?.includes("ALREADY_PROCESSED");
    const isNotFound = err.message?.includes("NOT_FOUND");
    const status = isAlreadyProcessed ? 409 : isNotFound ? 404 : 500;

    return NextResponse.json(
      { error: err.message || "Failed to process change request." },
      { status }
    );
  }
}
