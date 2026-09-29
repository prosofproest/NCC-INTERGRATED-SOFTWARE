import { z } from "zod";

export const AuditActorRoleSchema = z.enum(["admin", "cto", "cadet", "system"]);

export const AuditEntityTypeSchema = z.enum([
  "cadet",
  "field",
  "category",
  "document",
  "data_request",
  "change_request",
  "notification",
  "user",
  "system",
]);

export const AuditLogEntrySchema = z.object({
  logId: z.string().regex(/^LOG_\d{7,}$/, "Invalid Audit Log ID format"),
  actorId: z.string().min(1),
  actorEmail: z.string().email(),
  actorRole: AuditActorRoleSchema,
  action: z.string().min(1),
  entityType: AuditEntityTypeSchema,
  entityId: z.string().min(1),
  previousState: z.record(z.string(), z.unknown()).nullable().optional(),
  newState: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string(),
});
