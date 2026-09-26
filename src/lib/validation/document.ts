import { z } from "zod";

export const DocumentVerificationStatusSchema = z.enum(["pending", "verified", "rejected"]);
export const DocumentLifecycleStatusSchema = z.enum(["active", "archived", "superseded"]);

export const CadetDocumentMetadataSchema = z.object({
  documentId: z.string().regex(/^DOC_\d{5,}$/, "Invalid Document ID format"),
  cadetId: z.string().regex(/^CADET_\d{4,}$/, "Invalid Cadet ID format"),
  categoryId: z.string().regex(/^CAT_\d{3,}$/, "Invalid Category ID format"),
  fieldId: z.string().regex(/^FIELD_\d{5,}$/).optional(),
  title: z.string().min(1, "Document title is required"),
  fileName: z.string().min(1, "File name is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  sizeBytes: z.number().int().positive("File size must be positive"),
  driveFolderId: z.string().min(1, "Drive folder ID is required"),
  driveFileId: z.string().min(1, "Drive file ID is required"),
  version: z.number().int().positive().default(1),
  status: DocumentLifecycleStatusSchema.default("active"),
  uploadDate: z.string(),
  uploadedBy: z.string().min(1),
  verificationStatus: DocumentVerificationStatusSchema.default("pending"),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const VerifyDocumentInputSchema = z.object({
  verificationStatus: z.enum(["verified", "rejected"]),
  rejectionReason: z.string().optional(),
});
