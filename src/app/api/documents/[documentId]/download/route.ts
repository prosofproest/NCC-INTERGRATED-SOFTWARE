import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSession, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { getDocumentStreamFromDrive } from "@/lib/google-drive/upload";
import type { CadetDocumentMetadata } from "@/types/document";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    documentId: string;
  }>;
}

/**
 * GET /api/documents/[documentId]/download
 * Secure, authorization-gated document streaming proxy via Google Drive API.
 * Never exposes raw public Drive links.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthorizedSession();
    const { documentId } = await context.params;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `Document '${documentId}' was not found.` },
        { status: 404 }
      );
    }

    const doc = docSnap.data() as CadetDocumentMetadata;

    // Authorization Gate
    if (session.role === "cadet") {
      if (!session.cadetId || session.cadetId !== doc.cadetId) {
        return NextResponse.json(
          { error: "Access denied. You may only download documents attached to your own record." },
          { status: 403 }
        );
      }
    } else if (session.role !== "admin" && session.role !== "cto") {
      return NextResponse.json(
        { error: "Forbidden: Unauthorized role." },
        { status: 403 }
      );
    }

    // Stream from Google Drive API
    let nodeStream;
    try {
      nodeStream = await getDocumentStreamFromDrive(doc.driveFileId);
    } catch (driveErr: unknown) {
      const err = driveErr as Error;
      console.error(`Failed to stream file '${doc.driveFileId}' from Drive:`, err);
      return NextResponse.json(
        { error: `Failed to retrieve document binary from Google Drive: ${err.message}` },
        { status: 502 }
      );
    }

    // Audit log download event (tracked)
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "DOCUMENT_DOWNLOADED",
      entityType: "document",
      entityId: documentId,
      metadata: {
        cadetId: doc.cadetId,
        fileName: doc.fileName,
        version: doc.version,
        driveFileId: doc.driveFileId,
      },
    });

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        const readable = nodeStream as Readable;
        readable.on("data", (chunk) => controller.enqueue(chunk));
        readable.on("end", () => controller.close());
        readable.on("error", (err) => controller.error(err));
      },
      cancel() {
        if ("destroy" in (nodeStream as object)) {
          (nodeStream as { destroy: () => void }).destroy();
        }
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    );
    if (doc.sizeBytes && doc.sizeBytes > 0) {
      headers.set("Content-Length", String(doc.sizeBytes));
    }
    headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(webStream, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/documents/[documentId]/download error:", error);
    return NextResponse.json(
      { error: "Internal server error retrieving document." },
      { status: 500 }
    );
  }
}
