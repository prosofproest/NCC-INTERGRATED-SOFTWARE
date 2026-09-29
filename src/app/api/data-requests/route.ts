import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { generateDataRequestId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { CreateDataRequestInputSchema } from "@/lib/validation/request";
import { computeMissingFieldIds } from "@/features/data-requests/utils/missing-fields";
import type { DataRequest, CadetResponseRecord } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-requests
 * Lists all data requests. Accessible to Admin and CTO roles.
 */
export async function GET() {
  try {
    const session = await requireRole(["admin", "cto"]);

    const snapshot = await adminDb
      .collection("data_requests")
      .orderBy("createdAt", "desc")
      .get();

    const requests = snapshot.docs.map((doc) => {
      const data = doc.data() as DataRequest;
      const responses = Object.values(data.cadetResponses || {});
      const totalTargeted = responses.length;
      const completedCount = responses.filter((r) => r.status === "completed").length;
      const pendingCount = totalTargeted - completedCount;
      const completionRate = totalTargeted > 0 ? Math.round((completedCount / totalTargeted) * 100) : 0;

      return {
        ...data,
        summary: {
          totalTargeted,
          completedCount,
          pendingCount,
          completionRate,
        },
      };
    });

    return NextResponse.json({
      success: true,
      currentUserRole: session.role,
      requests,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error fetching data requests:", error);
    return NextResponse.json(
      { error: err.message || "Failed to fetch data requests" },
      { status: err.statusCode || 500 }
    );
  }
}

/**
 * POST /api/data-requests
 * Creates a new Data Request document with computed missing-field targeting.
 * Accessible to Admin and CTO roles.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["admin", "cto"]);

    const json = await req.json();
    const parseResult = CreateDataRequestInputSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { title, purpose, targetCadetIds, requiredFieldIds, deadline } = parseResult.data;

    // 1. Fetch targeted cadets from Firestore
    let cadetsToTarget: CadetRecord[] = [];

    if (targetCadetIds === "all") {
      const cadetsSnap = await adminDb
        .collection("cadets")
        .where("status", "==", "active")
        .get();
      cadetsToTarget = cadetsSnap.docs.map((doc) => doc.data() as CadetRecord);
    } else {
      // Fetch specific cadets
      const fetchPromises = targetCadetIds.map((id) =>
        adminDb.collection("cadets").doc(id).get()
      );
      const docs = await Promise.all(fetchPromises);
      cadetsToTarget = docs
        .filter((d) => d.exists)
        .map((d) => d.data() as CadetRecord);
    }

    if (cadetsToTarget.length === 0) {
      return NextResponse.json(
        { error: "No matching active cadets found for this request." },
        { status: 400 }
      );
    }

    // 2. Compute missing fields per targeted cadet
    const cadetResponses: Record<string, CadetResponseRecord> = {};

    for (const cadet of cadetsToTarget) {
      const missingFieldIds = computeMissingFieldIds(requiredFieldIds, cadet.dynamicData);
      cadetResponses[cadet.cadetId] = {
        status: "pending",
        cadetName: cadet.fullName,
        missingFieldIds,
      };
    }

    // 3. Atomically generate permanent Data Request ID (REQ_XXXXX)
    const requestId = await generateDataRequestId();
    const now = new Date().toISOString();

    const dataRequest: DataRequest = {
      requestId,
      title: title.trim(),
      purpose: purpose.trim(),
      requestedBy: session.uid,
      requesterRole: session.role as "admin" | "cto",
      requesterEmail: session.email,
      targetCadetIds,
      requiredFieldIds,
      deadline: deadline || undefined,
      status: "open",
      cadetResponses,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("data_requests").doc(requestId).set(dataRequest);

    // 4. Audit Log the creation
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "DATA_REQUEST_CREATED",
      entityType: "data_request",
      entityId: requestId,
      newState: {
        requestId,
        title: dataRequest.title,
        purpose: dataRequest.purpose,
        targetCadetCount: cadetsToTarget.length,
        requiredFieldCount: requiredFieldIds.length,
        deadline: deadline || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        dataRequest,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error creating data request:", error);
    return NextResponse.json(
      { error: err.message || "Failed to create data request" },
      { status: err.statusCode || 500 }
    );
  }
}
