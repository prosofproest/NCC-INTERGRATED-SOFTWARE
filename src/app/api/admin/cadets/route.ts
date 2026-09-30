import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Enforce Admin authorization
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const status = searchParams.get("status") || "all";
    const trainingYear = searchParams.get("trainingYear") || "all";
    const division = searchParams.get("division") || "all";
    const rank = searchParams.get("rank") || "all";
    const unit = searchParams.get("unit") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));

    // 2. Fetch all cadets from Firestore
    // Note on Firestore limitation: native full-text multi-field search is not supported by Firestore.
    // We execute server-side filtering on the retrieved records.
    const snapshot = await adminDb.collection("cadets").get();
    let allCadets: CadetRecord[] = snapshot.docs.map((doc) => doc.data() as CadetRecord);

    // 3. Apply Filters
    if (status !== "all") {
      allCadets = allCadets.filter((c) => c.status === status);
    }

    if (trainingYear !== "all") {
      allCadets = allCadets.filter((c) => c.trainingYear === trainingYear);
    }

    if (division !== "all") {
      allCadets = allCadets.filter((c) => c.division === division);
    }

    if (rank !== "all") {
      allCadets = allCadets.filter((c) => c.rank.toLowerCase() === rank.toLowerCase());
    }

    if (unit !== "all") {
      allCadets = allCadets.filter((c) => c.unit.toLowerCase() === unit.toLowerCase());
    }

    // 4. Apply Search across Name, Cadet ID, Enrollment No, Email, Unit, Rank, and dynamic values (phone, etc.)
    if (search) {
      allCadets = allCadets.filter((c) => {
        const inCadetId = c.cadetId?.toLowerCase().includes(search);
        const inName = c.fullName?.toLowerCase().includes(search);
        const inEnrollment = c.enrollmentNo ? c.enrollmentNo.toLowerCase().includes(search) : false;
        const inEmail = c.email?.toLowerCase().includes(search);
        const inUnit = c.unit?.toLowerCase().includes(search);
        const inRank = c.rank?.toLowerCase().includes(search);

        // Search dynamicData string representations
        const inDynamic = c.dynamicData
          ? Object.values(c.dynamicData).some((val) =>
              String(val).toLowerCase().includes(search)
            )
          : false;

        return inCadetId || inName || inEnrollment || inEmail || inUnit || inRank || inDynamic;
      });
    }

    const total = allCadets.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedCadets = allCadets.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      cadets: paginatedCadets,
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
    console.error("GET /api/admin/cadets error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching cadets" },
      { status: 500 }
    );
  }
}
