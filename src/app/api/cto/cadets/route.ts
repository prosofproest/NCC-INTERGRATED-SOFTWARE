import { NextResponse } from "next/server";
import { requireCto, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Enforce CTO authorization strictly
    await requireCto();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const status = searchParams.get("status") || "all";
    const trainingYear = searchParams.get("trainingYear") || "all";
    const division = searchParams.get("division") || "all";
    const rank = searchParams.get("rank") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));

    // 2. Fetch active fields to identify ctoVisible fields
    const fieldsSnap = await adminDb.collection("fields").where("isActive", "==", true).get();
    const activeFields = fieldsSnap.docs.map((d) => d.data() as FieldDefinition);
    const ctoVisibleFieldIds = new Set(
      activeFields.filter((f) => f.permissions?.ctoVisible).map((f) => f.fieldId)
    );

    // 3. Fetch cadets
    const snapshot = await adminDb.collection("cadets").get();
    let allCadets: CadetRecord[] = snapshot.docs.map((doc) => doc.data() as CadetRecord);

    // Filter by status
    if (status !== "all") {
      allCadets = allCadets.filter((c) => c.status === status);
    }

    // Filter by training year
    if (trainingYear !== "all") {
      allCadets = allCadets.filter((c) => c.trainingYear === trainingYear);
    }

    // Filter by division
    if (division !== "all") {
      allCadets = allCadets.filter((c) => c.division === division);
    }

    // Filter by rank
    if (rank !== "all") {
      allCadets = allCadets.filter((c) => c.rank.toLowerCase() === rank.toLowerCase());
    }

    // Filter by search
    if (search) {
      allCadets = allCadets.filter((c) => {
        const inCadetId = c.cadetId?.toLowerCase().includes(search);
        const inName = c.fullName?.toLowerCase().includes(search);
        const inEnrollment = c.enrollmentNo ? c.enrollmentNo.toLowerCase().includes(search) : false;
        const inUnit = c.unit?.toLowerCase().includes(search);
        const inRank = c.rank?.toLowerCase().includes(search);

        // Search only across ctoVisible dynamic fields
        let inDynamic = false;
        if (c.dynamicData) {
          for (const [k, v] of Object.entries(c.dynamicData)) {
            if (ctoVisibleFieldIds.has(k) && String(v).toLowerCase().includes(search)) {
              inDynamic = true;
              break;
            }
          }
        }

        return inCadetId || inName || inEnrollment || inUnit || inRank || inDynamic;
      });
    }

    const total = allCadets.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = allCadets.slice((page - 1) * limit, page * limit);

    // Sanitize dynamicData for CTO visibility
    const sanitizedCadets = paginated.map((cadet) => {
      const sanitizedDynamic: Record<string, unknown> = {};
      if (cadet.dynamicData) {
        for (const [k, v] of Object.entries(cadet.dynamicData)) {
          if (ctoVisibleFieldIds.has(k)) {
            sanitizedDynamic[k] = v;
          }
        }
      }
      return {
        ...cadet,
        dynamicData: sanitizedDynamic,
      };
    });

    return NextResponse.json({
      cadets: sanitizedCadets,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/cto/cadets error:", error);
    return NextResponse.json(
      { error: "Internal server error while searching cadets" },
      { status: 500 }
    );
  }
}
