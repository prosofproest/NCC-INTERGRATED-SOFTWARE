import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { getPaginatedAuditLogs, getAuditStats } from "@/features/audit/services/auditService";
import type { AuditActorRole, AuditEntityType } from "@/types/audit";

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce strict Admin-only authorization
    await requireAdmin();

    // 2. Parse search parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const cursor = searchParams.get("cursor") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const actorRole = (searchParams.get("actorRole") as AuditActorRole) || undefined;
    const action = searchParams.get("action") || undefined;
    const entityType = (searchParams.get("entityType") as AuditEntityType) || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const includeStats = searchParams.get("includeStats") === "true";

    // 3. Query paginated logs
    const result = await getPaginatedAuditLogs({
      limit,
      cursor,
      actor,
      actorRole,
      action,
      entityType,
      startDate,
      endDate,
    });

    let stats = null;
    if (includeStats) {
      stats = await getAuditStats();
    }

    return NextResponse.json({
      success: true,
      logs: result.logs,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      stats,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("GET /api/admin/audit-logs error:", err);
    return NextResponse.json(
      { error: "Failed to fetch audit logs: " + err.message },
      { status: 500 }
    );
  }
}
