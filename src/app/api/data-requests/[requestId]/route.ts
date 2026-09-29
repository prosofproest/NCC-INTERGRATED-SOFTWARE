import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { CloseDataRequestInputSchema } from "@/lib/validation/request";
import type { DataRequest } from "@/types/request";
import type { FieldDefinition, CategoryDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    requestId: string;
  }>;
}

/**
 * GET /api/data-requests/[requestId]
 * Fetches a single Data Request with field definitions and per-cadet response status.
 * Accessible to Admin and CTO roles.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["admin", "cto"]);
    const { requestId } = await params;

    const doc = await adminDb.collection("data_requests").doc(requestId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Data request not found" }, { status: 404 });
    }

    const dataRequest = doc.data() as DataRequest;

    // Fetch related field definitions
    const fields: FieldDefinition[] = [];
    if (dataRequest.requiredFieldIds && dataRequest.requiredFieldIds.length > 0) {
      const fieldDocs = await Promise.all(
        dataRequest.requiredFieldIds.map((id) =>
          adminDb.collection("fields").doc(id).get()
        )
      );
      for (const fDoc of fieldDocs) {
        if (fDoc.exists) {
          fields.push(fDoc.data() as FieldDefinition);
        }
      }
    }

    // Fetch categories for those fields
    const categoryIds = Array.from(new Set(fields.map((f) => f.categoryId)));
    const categories: CategoryDefinition[] = [];
    if (categoryIds.length > 0) {
      const catDocs = await Promise.all(
        categoryIds.map((id) => adminDb.collection("categories").doc(id).get())
      );
      for (const cDoc of catDocs) {
        if (cDoc.exists) {
          categories.push(cDoc.data() as CategoryDefinition);
        }
      }
    }

    // Compute response metrics
    const responses = Object.values(dataRequest.cadetResponses || {});
    const totalTargeted = responses.length;
    const completedCount = responses.filter((r) => r.status === "completed").length;
    const pendingCount = totalTargeted - completedCount;
    const completionRate = totalTargeted > 0 ? Math.round((completedCount / totalTargeted) * 100) : 0;

    const canClose = session.role === "admin" || session.uid === dataRequest.requestedBy;

    return NextResponse.json({
      success: true,
      dataRequest,
      fields,
      categories,
      summary: {
        totalTargeted,
        completedCount,
        pendingCount,
        completionRate,
      },
      permissions: {
        canClose,
      },
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error fetching data request details:", error);
    return NextResponse.json(
      { error: err.message || "Failed to fetch data request details" },
      { status: err.statusCode || 500 }
    );
  }
}

/**
 * PATCH /api/data-requests/[requestId]
 * Updates request status (e.g. closing a request).
 * Allowed only for the request creator or an Administrator.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["admin", "cto"]);
    const { requestId } = await params;

    const json = await req.json();
    const parseResult = CloseDataRequestInputSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid status update. Only status: 'closed' is supported." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("data_requests").doc(requestId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Data request not found" }, { status: 404 });
    }

    const dataRequest = doc.data() as DataRequest;

    // Check permissions: only Admin or request creator can close
    const isCreator = session.uid === dataRequest.requestedBy;
    const isAdmin = session.role === "admin";

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: "Access denied. Only the request creator or an Administrator can close this data request." },
        { status: 403 }
      );
    }

    if (dataRequest.status === "closed") {
      return NextResponse.json(
        { error: "Data request is already closed." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await docRef.update({
      status: "closed",
      updatedAt: now,
    });

    // Audit log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "DATA_REQUEST_UPDATED",
      entityType: "data_request",
      entityId: requestId,
      previousState: { status: dataRequest.status },
      newState: { status: "closed", closedBy: session.email },
      metadata: { closedByRole: session.role },
    });

    return NextResponse.json({
      success: true,
      message: "Data request has been successfully closed.",
      status: "closed",
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error("Error closing data request:", error);
    return NextResponse.json(
      { error: err.message || "Failed to update data request" },
      { status: err.statusCode || 500 }
    );
  }
}
