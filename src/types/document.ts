export type DocumentVerificationStatus = "pending" | "verified" | "rejected";
export type DocumentLifecycleStatus = "active" | "archived" | "superseded";

export interface CadetDocumentMetadata {
  documentId: string; // Permanent ID, e.g. DOC_00001
  cadetId: string; // References Cadet ID (CADET_0001)
  categoryId: string; // References Category ID (CAT_001)
  fieldId?: string; // Optional reference to dynamic field (FIELD_00127)
  title: string; // User-facing title (e.g. "Aadhaar Card Document")
  fileName: string; // Original uploaded file name
  mimeType: string; // Verified MIME type (e.g. application/pdf, image/jpeg)
  sizeBytes: number;
  driveFolderId: string; // Google Shared Drive parent directory ID
  driveFileId: string; // Google Shared Drive binary file ID
  version: number; // Document versioning
  status: DocumentLifecycleStatus;
  uploadDate: string; // ISO 8601
  uploadedBy: string; // Firebase Auth UID
  verificationStatus: DocumentVerificationStatus;
  verifiedBy?: string; // Admin UID
  verifiedAt?: string; // ISO 8601
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
