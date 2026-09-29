import { getDriveClient } from "./client";
import { Readable } from "stream";

export interface DriveUploadParams {
  folderId: string;
  cadetId: string;
  categoryId: string;
  version: number;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  title: string;
  allowMetadataFallback?: boolean;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
  details?: unknown;
  usedFallback?: boolean;
}

/**
 * Uploads a document to Google Drive inside the specified cadet subfolder.
 * Attempts binary media upload. If Google rejects due to 0-quota on personal drives
 * and fallback is enabled, provisions the file node in Drive.
 * Otherwise returns a clear error without creating false success.
 */
export async function uploadDocumentFileToDrive(
  params: DriveUploadParams
): Promise<DriveUploadResult> {
  const {
    folderId,
    cadetId,
    categoryId,
    version,
    fileName,
    mimeType,
    buffer,
    title,
    allowMetadataFallback,
  } = params;

  const drive = getDriveClient();
  const cleanName = fileName.replace(/[/\\?%*:|"<>]/g, "_");
  const driveFileName = `${cadetId}_${categoryId}_v${version}_${cleanName}`;

  try {
    const stream = Readable.from(buffer);
    const res = await drive.files.create({
      requestBody: {
        name: driveFileName,
        parents: [folderId],
        mimeType,
        description: `Document: ${title} | Cadet: ${cadetId} | Category: ${categoryId} | Version: ${version}`,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: "id, name, mimeType, size",
      supportsAllDrives: true,
    });

    if (!res.data.id) {
      return {
        success: false,
        error: "Google Drive API did not return a valid file ID.",
      };
    }

    return {
      success: true,
      fileId: res.data.id,
      fileName: res.data.name || driveFileName,
    };
  } catch (err: unknown) {
    const errorObj = err as {
      message?: string;
      code?: number;
      response?: { data?: { error?: { message?: string } } };
    };

    const errorMessage =
      errorObj.response?.data?.error?.message ||
      errorObj.message ||
      "Unknown Drive upload failure";

    const isQuotaError =
      errorMessage.includes("Service Accounts do not have storage quota") ||
      errorObj.code === 403;

    const allowFallback =
      allowMetadataFallback ??
      (process.env.GOOGLE_DRIVE_ALLOW_METADATA_FALLBACK === "true");

    if (isQuotaError && allowFallback) {
      try {
        const fallbackRes = await drive.files.create({
          requestBody: {
            name: driveFileName,
            parents: [folderId],
            mimeType,
            description: `Document: ${title} | Cadet: ${cadetId} | Version: ${version} | Size: ${buffer.length} bytes (Drive metadata fallback mode)`,
            properties: {
              originalFileName: fileName,
              sizeBytes: String(buffer.length),
              cadetId,
              categoryId,
              version: String(version),
            },
          },
          fields: "id, name, mimeType",
          supportsAllDrives: true,
        });

        if (fallbackRes.data.id) {
          return {
            success: true,
            fileId: fallbackRes.data.id,
            fileName: fallbackRes.data.name || driveFileName,
            usedFallback: true,
          };
        }
      } catch (fallbackErr) {
        console.error("Fallback Drive file creation also failed:", fallbackErr);
      }
    }

    return {
      success: false,
      error: errorMessage,
      details: errorObj.response?.data || null,
    };
  }
}

/**
 * Downloads a binary file stream from Google Drive by its file ID.
 */
export async function getDocumentStreamFromDrive(fileId: string) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return res.data;
}
