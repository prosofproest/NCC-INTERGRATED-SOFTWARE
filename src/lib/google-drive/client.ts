import { google, type drive_v3 } from "googleapis";

let cachedDriveClient: drive_v3.Drive | null = null;

/**
 * Sanitizes an environment variable value by stripping surrounding quotes and normalising escaped newlines.
 */
function sanitizeEnvValue(val?: string): string {
  if (!val) return "";
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed.replace(/\\n/g, "\n");
}

/**
 * Returns an authenticated Google Drive API client using service account credentials.
 * Scoped to https://www.googleapis.com/auth/drive
 */
export function getDriveClient(): drive_v3.Drive {
  if (cachedDriveClient) {
    return cachedDriveClient;
  }

  const clientEmail = sanitizeEnvValue(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const privateKey = sanitizeEnvValue(process.env.GOOGLE_DRIVE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Drive credentials. Ensure GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY are configured in environment variables."
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  cachedDriveClient = google.drive({ version: "v3", auth });
  return cachedDriveClient;
}

/**
 * Returns the configured root folder ID from environment variables.
 * Returns null if not set or blank.
 */
export function getDriveRootFolderId(): string | null {
  const rootId = sanitizeEnvValue(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  if (!rootId || rootId === "your-cadet-root-folder-id") {
    return null;
  }
  return rootId;
}

/**
 * Optional Shared Drive ID if configured, or null for regular personal Drive.
 */
export function getSharedDriveId(): string | null {
  const sharedId = sanitizeEnvValue(process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID);
  if (!sharedId || sharedId === "your-shared-drive-id") {
    return null;
  }
  return sharedId;
}
