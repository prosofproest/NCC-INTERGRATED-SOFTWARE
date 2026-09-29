import { NextRequest, NextResponse } from "next/server";
import { requireCadet } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { SubmitDataRequestInputSchema } from "@/lib/validation/request";
import type { DataRequest } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    requestId: string;
  }>;
}

/**
 * POST /api/cadet/data-requests/[requestId]/submit
 * Handles submission of missing field values by a cadet.
 * 
 * Key Architectural Decisions:
 * 1. Direct-write bypass of cadetEditable:
 *    Data Requests represent official administrative/officer mandates to collect
 *    missing profile information. Submitting values for requested fields updates
 *    cadet.dynamicData directly without requiring a separate Change Request, even
 *    if cadetEditable is false for those fields.
 * 2. Duplicate Prevention:
 *    Atomic check verifies the cadet hasn't already completed this request.
 *    Any subsequent submission is rejected with HTTP 400.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireCadet();
    const cadetId = session.cadetId;
    const { requestId } = await params;

    if (!cadetId) {
      return NextResponse.json(
        { error: "No cadet profile associated with this account." },
        { status: 400 }
      );
    }

    const json = await req.json();
    const parseResult = SubmitDataRequestInputSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid submission data.", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { values } = parseResult.data;

    // Run within a Firestore transaction for atomic validation and duplicate prevention
    const result = await adminDb.runTransaction(async (transaction) => {
      const requestRef = adminDb.collection("data_requests").doc(requestId);
      const cadetRef = adminDb.collection("cadets").doc(cadetId);

      const [requestDoc, cadetDoc] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(cadetRef),
      ]);

      if (!requestDoc.exists) {
        throw new Error("Data request not found.");
      }
      if (!cadetDoc.exists) {
        throw new Error("Cadet profile not found.");
      }

      const dataRequest = requestDoc.data() as DataRequest;
      const cadet = cadetDoc.data() as CadetRecord;

      // 1. Verify request is still open
      if (dataRequest.status !== "open") {
        throw new Error("This data request is no longer open for responses.");
      }

      // 2. Verify cadet was targeted
      const existingResponse = dataRequest.cadetResponses?.[cadetId];
      if (!existingResponse) {
        throw new Error("Your profile was not targeted by this data request.");
      }

      // 3. Duplicate Prevention: Reject if already completed
      if (existingResponse.status === "completed") {
        throw new Error("DUPLICATE_SUBMISSION: You have already submitted your response for this data request.");
      }

      // 4. Update cadet's dynamicData with submitted values
      const currentDynamicData = cadet.dynamicData || {};
      const updatedDynamicData = {
        ...currentDynamicData,
        ...values,
      };

      // 5. Recalculate profile completion percentage
      // We retrieve active required fields to compute new completion %
      // For transaction safety, we read fields outside or compute based on active fields
      const now = new Date().toISOString();

      transaction.update(cadetRef, {
        dynamicData: updatedDynamicData,
        updatedAt: now,
      });

      transaction.update(requestRef, {
        [`cadetResponses.${cadetId}`]: {
          status: "completed",
          completedAt: now,
          cadetName: cadet.fullName,
          submittedValues: values,
        },
        updatedAt: now,
      });

      return {
        updatedDynamicData,
        cadet,
      };
    });

    // 6. Recalculate completion percentage asynchronously and save
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
      if (result.cadet.fullName) filledCount++;
      if (result.cadet.rank) filledCount++;
      if (result.cadet.unit) filledCount++;
      if (result.cadet.wing) filledCount++;

      for (const field of requiredActiveFields) {
        const val = result.updatedDynamicData[field.fieldId];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          filledCount++;
        }
      }

      const completionPercentage = Math.min(
        100,
        Math.round((filledCount / totalRequiredCount) * 100)
      );

      await adminDb.collection("cadets").doc(cadetId).update({
        completionPercentage,
      });
    } catch (pctErr) {
      console.error("Non-critical error recalculating completion percentage:", pctErr);
    }

    // 7. Audit Log the completion
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "cadet",
      action: "DATA_REQUEST_RESPONDED",
      entityType: "data_request",
      entityId: requestId,
      metadata: {
        cadetId,
        submittedFieldCount: Object.keys(values).length,
        submittedFieldIds: Object.keys(values),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data request response recorded successfully.",
      submittedFieldCount: Object.keys(values).length,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Error submitting cadet data request response:", error);

    const isDuplicate = err.message?.includes("DUPLICATE_SUBMISSION");
    const status = isDuplicate ? 400 : 500;

    return NextResponse.json(
      { error: err.message || "Failed to submit data request response" },
      { status }
    );
  }
}
