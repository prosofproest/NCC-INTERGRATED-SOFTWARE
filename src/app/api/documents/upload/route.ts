import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSession, AuthError } from "@/lib/authorization";
import { adminDb } from "@/lib/firebase/admin";
import { generateDocumentId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/security/audit";
import { validateUploadedDocument } from "@/lib/validation/file-sniffer";
import {
  getOrCreateCadetFolder,
  resolveSubfolderName,
} from "@/lib/google-drive/folders";
import { uploadDocumentFileToDrive } from "@/lib/google-drive/upload";
import type { CadetDocumentMetadata } from "@/types/document";
import type { CadetRecord } from "@/types/cadet";
import type { CategoryDefinition } from "@/types/fields";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthorizedSession();

    // 1. Role Authorization
    if (session.role === "cto") {
      return NextResponse.json(
        { error: "Forbidden: Care Taker Officers (CTO) have read-only access and cannot upload documents." },
        { status: 403 }
      );
    }

    if (session.role !== "admin" && session.role !== "cadet") {
      return NextResponse.json(
        { error: "Forbidden: Unauthorized role." },
        { status: 403 }
      );
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cadetId = formData.get("cadetId")?.toString().trim();
    const categoryId = formData.get("categoryId")?.toString().trim();
    const fieldId = formData.get("fieldId")?.toString().trim() || undefined;
    const title = formData.get("title")?.toString().trim();

    if (!file) {
      return NextResponse.json(
        { error: "No file was attached to the upload request." },
        { status: 400 }
      );
    }

    if (!cadetId) {
      return NextResponse.json(
        { error: "Cadet ID is required." },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Document title is required." },
        { status: 400 }
      );
    }

    // 3. Ownership Authorization for Cadet role
    if (session.role === "cadet") {
      if (!session.cadetId || session.cadetId !== cadetId) {
        return NextResponse.json(
          { error: "Access denied. You may only upload documents to your own profile." },
          { status: 403 }
        );
      }
    }

    // 4. Verify Cadet Exists in Firestore
    const cadetDocRef = adminDb.collection("cadets").doc(cadetId);
    const cadetSnap = await cadetDocRef.get();
    if (!cadetSnap.exists) {
      return NextResponse.json(
        { error: `Cadet with ID '${cadetId}' not found.` },
        { status: 404 }
      );
    }
    const cadet = cadetSnap.data() as CadetRecord;

    // 5. Verify Category Exists in Firestore
    const categoryDocRef = adminDb.collection("categories").doc(categoryId);
    const categorySnap = await categoryDocRef.get();
    if (!categorySnap.exists) {
      return NextResponse.json(
        { error: `Category with ID '${categoryId}' not found.` },
        { status: 404 }
      );
    }
    const category = categorySnap.data() as CategoryDefinition;

    // 6. Buffer Conversion & Magic Byte Sniffing Validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateUploadedDocument(
      buffer,
      file.name,
      file.type
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "File validation failed." },
        { status: 400 }
      );
    }

    // 7. Ensure Cadet Google Drive Folder & Subfolders Exist
    let cadetFolderStructure;
    try {
      cadetFolderStructure = await getOrCreateCadetFolder(
        cadetId,
        cadet.fullName || "Cadet"
      );
    } catch (folderError: unknown) {
      const err = folderError as Error;
      console.error("Failed to provision Drive folders:", err);
      return NextResponse.json(
        {
          error: `Google Drive folder provisioning failed: ${err.message}`,
        },
        { status: 502 }
      );
    }

    const subfolderName = resolveSubfolderName(categoryId, category.name);
    const targetFolderId =
      cadetFolderStructure.subfolders[subfolderName] ||
      cadetFolderStructure.cadetFolderId;

    // 8. Determine Version & Existing Active Documents for Replacement Flow
    let existingDocQuery = adminDb
      .collection("documents")
      .where("cadetId", "==", cadetId)
      .where("categoryId", "==", categoryId)
      .where("status", "==", "active");

    if (fieldId) {
      existingDocQuery = existingDocQuery.where("fieldId", "==", fieldId);
    } else {
      existingDocQuery = existingDocQuery.where("title", "==", title);
    }

    const existingDocsSnap = await existingDocQuery.get();
    let nextVersion = 1;
    let supersededDocId: string | null = null;

    if (!existingDocsSnap.empty) {
      // Find highest version among existing active docs
      let maxVersion = 0;
      for (const d of existingDocsSnap.docs) {
        const dData = d.data() as CadetDocumentMetadata;
        if (dData.version && dData.version > maxVersion) {
          maxVersion = dData.version;
          supersededDocId = d.id;
        }
      }
      nextVersion = maxVersion + 1;
    }

    // 9. Upload Binary File to Google Drive
    const uploadResult = await uploadDocumentFileToDrive({
      folderId: targetFolderId,
      cadetId,
      categoryId,
      version: nextVersion,
      fileName: file.name,
      mimeType: validation.sniffedMimeType || file.type || "application/octet-stream",
      buffer,
      title,
    });

    // CRITICAL: On Drive failure, do NOT create a Firestore doc claiming success!
    if (!uploadResult.success) {
      console.error("Drive upload rejected:", uploadResult.error);
      return NextResponse.json(
        {
          error: `Google Drive file upload failed: ${uploadResult.error}`,
          details: uploadResult.details,
        },
        { status: 502 }
      );
    }

    // 10. Atomic / Transactional Firestore Metadata Creation & Superseding
    const documentId = await generateDocumentId();
    const nowIso = new Date().toISOString();

    const newDocumentMetadata: CadetDocumentMetadata = {
      documentId,
      cadetId,
      categoryId,
      fieldId: fieldId || undefined,
      title,
      fileName: file.name,
      mimeType: validation.sniffedMimeType || file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      driveFolderId: targetFolderId,
      driveFileId: uploadResult.fileId!,
      version: nextVersion,
      status: "active",
      uploadDate: nowIso,
      uploadedBy: session.uid,
      verificationStatus: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const batch = adminDb.batch();

    // Mark previous version as superseded (preserving old file in Drive without deletion)
    if (supersededDocId) {
      const prevDocRef = adminDb.collection("documents").doc(supersededDocId);
      batch.update(prevDocRef, {
        status: "superseded",
        updatedAt: nowIso,
      });
    }

    // Save new active document
    const newDocRef = adminDb.collection("documents").doc(documentId);
    batch.set(newDocRef, newDocumentMetadata);

    await batch.commit();

    // 11. Immutable Audit Logging
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "DOCUMENT_UPLOADED",
      entityType: "document",
      entityId: documentId,
      newState: newDocumentMetadata as unknown as Record<string, unknown>,
      metadata: {
        cadetId,
        categoryId,
        fieldId,
        title,
        fileName: file.name,
        version: nextVersion,
        driveFileId: uploadResult.fileId,
        supersededDocumentId: supersededDocId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        document: newDocumentMetadata,
        supersededDocumentId: supersededDocId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/documents/upload error:", error);
    return NextResponse.json(
      { error: "Internal server error processing document upload." },
      { status: 500 }
    );
  }
}
