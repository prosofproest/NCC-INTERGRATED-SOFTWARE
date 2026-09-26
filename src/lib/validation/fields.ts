import { z } from "zod";

export const FieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
  "file",
  "textarea",
]);

export const FieldValidationRulesSchema = z.object({
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().optional(),
});

export const FieldPermissionsSchema = z.object({
  cadetEditable: z.boolean().default(true),
  ctoVisible: z.boolean().default(true),
  ctoExportable: z.boolean().default(true),
});

export const FieldDefinitionSchema = z.object({
  fieldId: z.string().regex(/^FIELD_\d{5,}$/, "Invalid Field ID format"),
  categoryId: z.string().regex(/^CAT_\d{3,}$/, "Invalid Category ID format"),
  label: z.string().min(1, "Field label is required"),
  type: FieldTypeSchema,
  options: z.array(z.string()).optional(),
  validation: FieldValidationRulesSchema,
  permissions: FieldPermissionsSchema,
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateFieldInputSchema = z.object({
  categoryId: z.string().regex(/^CAT_\d{3,}$/, "Invalid Category ID format"),
  label: z.string().min(1, "Field label is required"),
  type: FieldTypeSchema,
  options: z.array(z.string()).optional(),
  validation: FieldValidationRulesSchema.default({ required: false }),
  permissions: FieldPermissionsSchema.default({
    cadetEditable: true,
    ctoVisible: true,
    ctoExportable: true,
  }),
  sortOrder: z.number().int().default(0),
});

export const UpdateFieldInputSchema = z.object({
  label: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  validation: FieldValidationRulesSchema.partial().optional(),
  permissions: FieldPermissionsSchema.partial().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const CategoryDefinitionSchema = z.object({
  categoryId: z.string().regex(/^CAT_\d{3,}$/, "Invalid Category ID format"),
  name: z.string().min(1, "Category name is required"),
  description: z.string().default(""),
  sortOrder: z.number().int().default(0),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().default(""),
  sortOrder: z.number().int().default(0),
});

export const UpdateCategoryInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
