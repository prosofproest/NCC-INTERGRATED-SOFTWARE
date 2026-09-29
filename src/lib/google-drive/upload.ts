import { getDriveClient, getDriveOAuthClient } from "./client";
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
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
  details?: unknown;
}

/**
 * Uploads a binary document to Google Drive inside the specified cadet subfolder.
 * Requires actual binary file creation in Google Drive using delegated human user OAuth.
 * If Drive upload fails for ANY reason, strictly returns an error.
 * Never fakes success, never creates fallback records.
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
  } = params;

  let drive;
  try {
    drive = getDriveOAuthClient();
  } catch (err: unknown) {
    const errorMsg =
      (err as { message?: string })?.message ||
      "Google OAuth refresh token is not configured. Please run 'node scripts/authorize-drive.mjs' to authenticate.";
    return {
      success: false,
      error: errorMsg,
    };
  }

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
  let drive;
  try {
    drive = getDriveOAuthClient();
  } catch {
    drive = getDriveClient();
  }
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return res.data;
}
