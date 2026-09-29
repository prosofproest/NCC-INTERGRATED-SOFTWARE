import { NextResponse } from "next/server";
import { requireCadet } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { computeMissingFieldIds } from "@/features/data-requests/utils/missing-fields";
import type { DataRequest } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

/**
 * GET /api/cadet/data-requests
 * Fetches data requests targeting the authenticated cadet.
 * Separates requests into pending and completed.
 * For pending requests, computes and provides ONLY the missing fields.
 */
export async function GET() {
  try {
    const session = await requireCadet();
    const cadetId = session.cadetId;

    if (!cadetId) {
      return NextResponse.json(
        { error: "No cadet profile associated with this account." },
        { status: 400 }
      );
    }

    // 1. Fetch current cadet record to get dynamicData
    const cadetDoc = await adminDb.collection("cadets").doc(cadetId).get();
    if (!cadetDoc.exists) {
      return NextResponse.json(
        { error: "Cadet record not found." },
        { status: 404 }
      );
    }
    const cadet = cadetDoc.data() as CadetRecord;

    // 2. Fetch all data requests
    const requestsSnap = await adminDb
      .collection("data_requests")
      .orderBy("createdAt", "desc")
      .get();

    const allRequests = requestsSnap.docs.map((d) => d.data() as DataRequest);

    // 3. Filter requests targeting this cadet
    const targetedRequests = allRequests.filter((req) =>
      Boolean(req.cadetResponses && req.cadetResponses[cadetId])
    );

    // Collect all field IDs we need definitions for
    const allNeededFieldIds = new Set<string>();
    for (const req of targetedRequests) {
      req.requiredFieldIds.forEach((fId) => allNeededFieldIds.add(fId));
    }

    const fieldDefsMap: Record<string, FieldDefinition> = {};
    if (allNeededFieldIds.size > 0) {
      const fieldPromises = Array.from(allNeededFieldIds).map((id) =>
        adminDb.collection("fields").doc(id).get()
      );
      const fieldDocs = await Promise.all(fieldPromises);
      for (const fDoc of fieldDocs) {
        if (fDoc.exists) {
          const f = fDoc.data() as FieldDefinition;
          fieldDefsMap[f.fieldId] = f;
        }
      }
    }

    // 4. Process pending and completed requests
    const pendingRequests = [];
    const completedRequests = [];

    for (const req of targetedRequests) {
      const responseRecord = req.cadetResponses[cadetId];

      if (responseRecord.status === "completed") {
        completedRequests.push({
          requestId: req.requestId,
          title: req.title,
          purpose: req.purpose,
          requesterRole: req.requesterRole,
          requesterEmail: req.requesterEmail,
          completedAt: responseRecord.completedAt,
          submittedValues: responseRecord.submittedValues || {},
          requiredFields: req.requiredFieldIds.map((id) => fieldDefsMap[id]).filter(Boolean),
        });
      } else if (req.status === "open") {
        // Spec Section 10: "Ask only for what's missing"
        // Compute dynamically against latest cadet dynamicData
        const missingFieldIds = computeMissingFieldIds(
          req.requiredFieldIds,
          cadet.dynamicData
        );

        // Fetch definitions ONLY for missing fields
        const missingFields = missingFieldIds
          .map((id) => fieldDefsMap[id])
          .filter(Boolean);

        pendingRequests.push({
          requestId: req.requestId,
          title: req.title,
          purpose: req.purpose,
          requesterRole: req.requesterRole,
          requesterEmail: req.requesterEmail,
          deadline: req.deadline,
          createdAt: req.createdAt,
          totalRequiredCount: req.requiredFieldIds.length,
          missingFieldIds,
          missingFields,
        });
      }
    }

    return NextResponse.json({
      success: true,
      cadetId,
      cadetName: cadet.fullName,
      pendingRequests,
      completedRequests,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error fetching cadet data requests:", error);
    return NextResponse.json(
      { error: err.message || "Failed to fetch data requests" },
      { status: err.statusCode || 500 }
    );
  }
}
