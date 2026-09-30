import { z } from "zod";

/**
 * Zod validation schemas for Excel Import & Export operations
 */

export const TrainingYearEnum = z.enum(["1st Year", "2nd Year", "3rd Year"], {
  message: "Training Year must be '1st Year', '2nd Year', or '3rd Year'",
});

export const DivisionEnum = z.enum(["SD", "SW"], {
  message: "Division must be 'SD' (Senior Division) or 'SW' (Senior Wing)",
});

export const CadetImportRowInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address format").toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\-\s]?)?[0]?[6-9]\d{9}$/, "Phone must be a valid 10-digit mobile number"),
  trainingYear: TrainingYearEnum,
  division: DivisionEnum,
});

export const CadetBatchConfirmInputSchema = z.object({
  cadets: z
    .array(
      z.object({
        name: z.string().trim().min(2),
        email: z.string().trim().email().toLowerCase(),
        phone: z.string().trim(),
        trainingYear: TrainingYearEnum,
        division: DivisionEnum,
      })
    )
    .min(1, "At least one valid cadet record must be provided for import"),
});

export const EnrollmentRowInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  enrollmentNo: z
    .string()
    .trim()
    .min(3, "Enrollment number must be at least 3 characters")
    .max(30, "Enrollment number cannot exceed 30 characters"),
});

export const EnrollmentBatchConfirmInputSchema = z.object({
  updates: z
    .array(
      z.object({
        cadetId: z.string().regex(/^CADET_\d{4,}$/, "Invalid Cadet ID format"),
        enrollmentNo: z.string().trim().min(3).max(30),
      })
    )
    .min(1, "At least one enrollment update must be confirmed"),
});

export const ExportRequestInputSchema = z.object({
  selectedFieldIds: z
    .array(z.string())
    .min(1, "At least one field must be selected for export"),
  trainingYear: z.string().optional(),
  division: z.string().optional(),
  wing: z.string().optional(),
  status: z.string().optional(),
  rank: z.string().optional(),
  search: z.string().optional(),
});
