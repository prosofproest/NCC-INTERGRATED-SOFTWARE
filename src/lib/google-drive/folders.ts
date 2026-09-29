import { getDriveClient, getDriveRootFolderId } from "./client";
import { adminDb } from "@/lib/firebase/admin";

export const STANDARD_SUBFOLDERS = [
  "Personal Documents",
  "NCC Documents",
  "Academic Documents",
  "Other Documents",
] as const;

export type StandardSubfolderName = (typeof STANDARD_SUBFOLDERS)[number];

export interface CadetFolderStructure {
  cadetFolderId: string;
  cadetFolderName: string;
  subfolders: Record<StandardSubfolderName, string>;
}

/**
 * Maps a Category ID or Name to one of the 4 standard subfolder categories.
 */
export function resolveSubfolderName(
  categoryId?: string,
  categoryName?: string
): StandardSubfolderName {
  const normalizedId = (categoryId || "").toUpperCase();
  const normalizedName = (categoryName || "").toLowerCase();

  if (normalizedId === "CAT_001" || normalizedName.includes("personal")) {
    return "Personal Documents";
  }
  if (
    normalizedId === "CAT_003" ||
    normalizedName.includes("ncc") ||
    normalizedName.includes("regimental")
  ) {
    return "NCC Documents";
  }
  if (normalizedId === "CAT_002" || normalizedName.includes("academic")) {
    return "Academic Documents";
  }
  if (normalizedId === "CAT_004" || normalizedName.includes("medical") || normalizedName.includes("physical")) {
    return "Personal Documents";
  }

  return "Other Documents";
}

/**
 * Sanitizes a cadet name for safe folder naming.
 */
export function sanitizeFolderName(cadetId: string, cadetFullName: string): string {
  const cleanedName = cadetFullName.trim().replace(/[/\\?%*:|"<>]/g, "_");
  return `${cadetId}_${cleanedName}`;
}

/**
 * Ensures a cadet directory [CadetID]_[Name] and its 4 standard subfolders exist under the root Drive folder.
 * Completely idempotent: avoids creating duplicates if folder or subfolders already exist.
 *
 * @param cadetId Primary permanent Cadet ID (e.g. CADET_0001)
 * @param cadetFullName Cadet's full name (e.g. Rahul Sharma)
 * @returns Cadet folder ID and subfolders mapping
 */
export async function getOrCreateCadetFolder(
  cadetId: string,
  cadetFullName: string
): Promise<CadetFolderStructure> {
  const rootFolderId = getDriveRootFolderId();
  if (!rootFolderId) {
    throw new Error(
      "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured in environment variables. Please run 'scripts/setup-drive-root.mjs' first."
    );
  }

  const drive = getDriveClient();
  const folderName = sanitizeFolderName(cadetId, cadetFullName);

  // 1. Check if cadet folder already exists under root
  // Query by exact name or name containing cadetId to avoid duplicates
  const escapedCadetId = cadetId.replace(/'/g, "\\'");
  const listFolderRes = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and name contains '${escapedCadetId}'`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    spaces: "drive",
  });

  let cadetFolderId: string;
  let finalFolderName = folderName;

  if (listFolderRes.data.files && listFolderRes.data.files.length > 0) {
    // Found existing folder for this cadet
    const existing = listFolderRes.data.files[0];
    cadetFolderId = existing.id!;
    finalFolderName = existing.name || folderName;
  } else {
    // Create new cadet folder
    const createFolderRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      },
      fields: "id, name",
      supportsAllDrives: true,
    });

    if (!createFolderRes.data.id) {
      throw new Error(`Failed to create Google Drive folder for cadet ${cadetId}.`);
    }

    cadetFolderId = createFolderRes.data.id;
  }

  // 2. Query existing subfolders inside cadet folder
  const listSubfoldersRes = await drive.files.list({
    q: `'${cadetFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    spaces: "drive",
  });

  const existingSubfolders = new Map<string, string>();
  if (listSubfoldersRes.data.files) {
    for (const f of listSubfoldersRes.data.files) {
      if (f.name && f.id) {
        existingSubfolders.set(f.name, f.id);
      }
    }
  }

  // 3. Ensure all 4 standard subfolders exist
  const subfoldersResult = {} as Record<StandardSubfolderName, string>;

  for (const subName of STANDARD_SUBFOLDERS) {
    if (existingSubfolders.has(subName)) {
      subfoldersResult[subName] = existingSubfolders.get(subName)!;
    } else {
      const createSubRes = await drive.files.create({
        requestBody: {
          name: subName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [cadetFolderId],
        },
        fields: "id, name",
        supportsAllDrives: true,
      });

      if (!createSubRes.data.id) {
        throw new Error(`Failed to create subfolder '${subName}' for cadet ${cadetId}.`);
      }

      subfoldersResult[subName] = createSubRes.data.id;
    }
  }

  // 4. Update cadet record in Firestore with driveFolderId and driveFolderName if needed
  try {
    const cadetRef = adminDb.collection("cadets").doc(cadetId);
    await cadetRef.set(
      {
        driveFolderId: cadetFolderId,
        driveFolderName: finalFolderName,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Warning: Failed to update Firestore cadet doc with driveFolderId:`, err);
  }

  return {
    cadetFolderId,
    cadetFolderName: finalFolderName,
    subfolders: subfoldersResult,
  };
}
