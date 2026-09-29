import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSession, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetDocumentMetadata } from "@/types/document";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents?cadetId=CADET_0001
 * Lists documents for a cadet with role-based access enforcement.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthorizedSession();
    const { searchParams } = new URL(request.url);
    const requestedCadetId = searchParams.get("cadetId");

    let targetCadetId: string;

    if (session.role === "cadet") {
      if (!session.cadetId) {
        return NextResponse.json(
          { error: "Cadet profile is not linked to your user account." },
          { status: 400 }
        );
      }
      if (requestedCadetId && requestedCadetId !== session.cadetId) {
        return NextResponse.json(
          { error: "Access denied. You can only view your own documents." },
          { status: 403 }
        );
      }
      targetCadetId = session.cadetId;
    } else if (session.role === "admin" || session.role === "cto") {
      if (!requestedCadetId) {
        return NextResponse.json(
          { error: "Missing required 'cadetId' query parameter." },
          { status: 400 }
        );
      }
      targetCadetId = requestedCadetId;
    } else {
      return NextResponse.json(
        { error: "Forbidden. Unauthorized role." },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection("documents")
      .where("cadetId", "==", targetCadetId)
      .get();

    const documents: CadetDocumentMetadata[] = [];
    snapshot.forEach((doc) => {
      documents.push(doc.data() as CadetDocumentMetadata);
    });

    // Sort in memory by uploadDate descending
    documents.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    return NextResponse.json({
      success: true,
      cadetId: targetCadetId,
      documents,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents." },
      { status: 500 }
    );
  }
}
