import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { VerifyDocumentInputSchema } from "@/lib/validation/document";
import type { CadetDocumentMetadata } from "@/types/document";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    documentId: string;
  }>;
}

/**
 * POST /api/admin/documents/[documentId]/verify
 * Admin document verification/rejection review action.
 * Transaction-safe with immutable audit logging.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { documentId } = await context.params;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = VerifyDocumentInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed for verification payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { verificationStatus, rejectionReason } = parseResult.data;

    // Requirement: Rejection reason is mandatory when rejected
    if (verificationStatus === "rejected" && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json(
        { error: "A rejection reason is mandatory when marking a document as rejected." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("documents").doc(documentId);
    const nowIso = new Date().toISOString();

    // Execute atomic Firestore transaction
    const { previousDoc, updatedDoc } = await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        throw new Error("NOT_FOUND: Document was not found.");
      }

      const prev = snap.data() as CadetDocumentMetadata;

      // Ensure document is not superseded
      if (prev.status === "superseded") {
        throw new Error("CANNOT_MODIFY: Cannot verify or reject a superseded document version.");
      }

      const updates: Partial<CadetDocumentMetadata> = {
        verificationStatus,
        verifiedBy: session.uid,
        verifiedAt: nowIso,
        rejectionReason: verificationStatus === "rejected" ? rejectionReason?.trim() : undefined,
        updatedAt: nowIso,
      };

      transaction.update(docRef, updates);
      return {
        previousDoc: prev,
        updatedDoc: { ...prev, ...updates } as CadetDocumentMetadata,
      };
    });

    // Audit Logging
    const auditAction =
      verificationStatus === "verified"
        ? "DOCUMENT_VERIFIED"
        : "DOCUMENT_REJECTED";

    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: auditAction,
      entityType: "document",
      entityId: documentId,
      previousState: {
        verificationStatus: previousDoc.verificationStatus,
        rejectionReason: previousDoc.rejectionReason,
      },
      newState: {
        verificationStatus,
        rejectionReason: verificationStatus === "rejected" ? rejectionReason?.trim() : null,
        verifiedBy: session.uid,
        verifiedAt: nowIso,
      },
      metadata: {
        cadetId: previousDoc.cadetId,
        fileName: previousDoc.fileName,
        version: previousDoc.version,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDoc,
      message: `Document has been marked as ${verificationStatus}.`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    const err = error as Error;
    if (err.message?.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: err.message.replace("NOT_FOUND: ", "") }, { status: 404 });
    }
    if (err.message?.startsWith("CANNOT_MODIFY:")) {
      return NextResponse.json({ error: err.message.replace("CANNOT_MODIFY: ", "") }, { status: 400 });
    }

    console.error("POST /api/admin/documents/[documentId]/verify error:", error);
    return NextResponse.json(
      { error: "Internal server error during document verification." },
      { status: 500 }
    );
  }
}
