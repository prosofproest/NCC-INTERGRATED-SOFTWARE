import { z } from "zod";

export const DataRequestStatusSchema = z.enum(["draft", "open", "closed"]);
export const CadetResponseStatusSchema = z.enum(["pending", "completed"]);

export const CadetResponseRecordSchema = z.object({
  status: CadetResponseStatusSchema.default("pending"),
  completedAt: z.string().optional(),
  cadetName: z.string().optional(),
  submittedValues: z.record(z.string(), z.unknown()).optional(),
  missingFieldIds: z.array(z.string()).optional(),
});

export const DataRequestSchema = z.object({
  requestId: z.string().regex(/^REQ_\d{5,}$/, "Invalid Data Request ID format"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  purpose: z.string().min(3, "Purpose must be provided"),
  requestedBy: z.string().min(1),
  requesterRole: z.enum(["admin", "cto"]),
  requesterEmail: z.string().optional(),
  requesterName: z.string().optional(),
  targetCadetIds: z.union([z.array(z.string()), z.literal("all")]),
  requiredFieldIds: z.array(z.string()).min(1, "At least one required field must be specified"),
  deadline: z.string().optional(),
  status: DataRequestStatusSchema.default("open"),
  cadetResponses: z.record(z.string(), CadetResponseRecordSchema).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateDataRequestInputSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  purpose: z.string().min(3, "Purpose must be specified"),
  targetCadetIds: z.union([z.array(z.string()).min(1, "Select at least one cadet"), z.literal("all")]),
  requiredFieldIds: z.array(z.string()).min(1, "Select at least one required field"),
  deadline: z.string().optional(),
});

export const SubmitDataRequestInputSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export const CloseDataRequestInputSchema = z.object({
  status: z.literal("closed"),
});

export const ChangeRequestStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const ChangeRequestSchema = z.object({
  changeRequestId: z.string().regex(/^CR_\d{5,}$/, "Invalid Change Request ID format"),
  cadetId: z.string().regex(/^CADET_\d{4,}$/, "Invalid Cadet ID format"),
  fieldId: z.string().regex(/^FIELD_\d{5,}$/, "Invalid Field ID format"),
  fieldLabel: z.string().min(1),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  reason: z.string().min(3, "Please provide a reason for the modification"),
  status: ChangeRequestStatusSchema.default("pending"),
  requestedBy: z.string().min(1),
  requestedAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewerComments: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateChangeRequestInputSchema = z.object({
  fieldId: z.string().regex(/^FIELD_\d{5,}$/, "Invalid Field ID format"),
  newValue: z.unknown(),
  reason: z.string().min(3, "Please provide a reason for the request"),
});

export const ReviewChangeRequestInputSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerComments: z.string().optional(),
});
