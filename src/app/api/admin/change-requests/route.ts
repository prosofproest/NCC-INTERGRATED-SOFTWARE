import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { ChangeRequest } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/change-requests
 * Lists all change requests across all cadets.
 * Strict Admin-only access.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const search = searchParams.get("search")?.toLowerCase().trim() || "";

    const snapshot = await adminDb
      .collection("change_requests")
      .orderBy("createdAt", "desc")
      .get();

    let changeRequests: ChangeRequest[] = snapshot.docs.map(
      (doc) => doc.data() as ChangeRequest
    );

    // Compute summary metrics before filters
    const totalCount = changeRequests.length;
    const pendingCount = changeRequests.filter((r) => r.status === "pending").length;
    const approvedCount = changeRequests.filter((r) => r.status === "approved").length;
    const rejectedCount = changeRequests.filter((r) => r.status === "rejected").length;

    // Apply status filter
    if (statusFilter !== "all") {
      changeRequests = changeRequests.filter((r) => r.status === statusFilter);
    }

    // Enrich missing cadetName if needed
    const missingNameCadetIds = Array.from(
      new Set(
        changeRequests
          .filter((r) => !r.cadetName)
          .map((r) => r.cadetId)
      )
    );

    if (missingNameCadetIds.length > 0) {
      const cadetDocs = await Promise.all(
        missingNameCadetIds.map((id) => adminDb.collection("cadets").doc(id).get())
      );
      const nameMap = new Map<string, string>();
      for (const cDoc of cadetDocs) {
        if (cDoc.exists) {
          const c = cDoc.data() as CadetRecord;
          nameMap.set(c.cadetId, c.fullName);
        }
      }

      changeRequests = changeRequests.map((r) => {
        if (!r.cadetName && nameMap.has(r.cadetId)) {
          return { ...r, cadetName: nameMap.get(r.cadetId) };
        }
        return r;
      });
    }

    // Apply search filter (cadet ID, cadet name, field label, reason, request ID)
    if (search) {
      changeRequests = changeRequests.filter((r) => {
        const inId = r.changeRequestId.toLowerCase().includes(search);
        const inCadetId = r.cadetId.toLowerCase().includes(search);
        const inCadetName = r.cadetName ? r.cadetName.toLowerCase().includes(search) : false;
        const inLabel = r.fieldLabel ? r.fieldLabel.toLowerCase().includes(search) : false;
        const inReason = r.reason ? r.reason.toLowerCase().includes(search) : false;
        return inId || inCadetId || inCadetName || inLabel || inReason;
      });
    }

    return NextResponse.json({
      success: true,
      changeRequests,
      summary: {
        totalCount,
        pendingCount,
        approvedCount,
        rejectedCount,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/change-requests error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching change requests" },
      { status: 500 }
    );
  }
}
