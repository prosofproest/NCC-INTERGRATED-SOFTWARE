import { z } from "zod";

export const CadetStatusSchema = z.enum(["active", "passed_out", "inactive", "suspended"]);
export const CadetWingSchema = z.enum(["Army", "Navy", "Air"]);

export const CadetRecordSchema = z.object({
  cadetId: z.string().regex(/^CADET_\d{4,}$/, "Invalid Cadet ID format"),
  userId: z.string().min(1, "User ID is required"),
  email: z.string().email("Valid email is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  enrollmentNo: z.string().nullable().optional(),
  rank: z.string().min(1, "Rank is required"),
  unit: z.string().min(1, "Unit is required"),
  wing: CadetWingSchema,
  status: CadetStatusSchema.default("active"),
  driveFolderId: z.string().nullable().optional(),
  driveFolderName: z.string().optional(),
  dynamicData: z.record(z.string(), z.unknown()).default({}),
  completionPercentage: z.number().min(0).max(100).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateCadetInputSchema = z.object({
  email: z.string().email("Valid email is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  enrollmentNo: z.string().nullable().optional(),
  rank: z.string().default("Cadet"),
  unit: z.string().min(1, "Unit is required"),
  wing: CadetWingSchema,
  status: CadetStatusSchema.default("active"),
  dynamicData: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateCadetInputSchema = z.object({
  fullName: z.string().min(2).optional(),
  enrollmentNo: z.string().nullable().optional(),
  rank: z.string().optional(),
  unit: z.string().optional(),
  wing: CadetWingSchema.optional(),
  status: CadetStatusSchema.optional(),
  dynamicData: z.record(z.string(), z.unknown()).optional(),
});
