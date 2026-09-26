export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "file"
  | "textarea";

export interface FieldValidationRules {
  required: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  allowedMimeTypes?: string[];
  maxFileSizeMb?: number;
}

export interface FieldPermissions {
  cadetEditable: boolean; // If false, cadet cannot edit directly and must submit Change Request
  ctoVisible: boolean;
  ctoExportable: boolean;
}

export interface FieldDefinition {
  fieldId: string; // Permanent ID, e.g. FIELD_00127
  categoryId: string; // Reference to Category ID, e.g. CAT_001
  label: string; // Human-readable label (e.g. "Blood Group")
  type: FieldType;
  options?: string[]; // Allowed choices for select / multiselect
  validation: FieldValidationRules;
  permissions: FieldPermissions;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDefinition {
  categoryId: string; // Permanent ID, e.g. CAT_001
  name: string; // e.g. "Personal", "Academic", "NCC Regimental", "Physical & Medical"
  description: string;
  sortOrder: number;
  isSystem: boolean; // Core categories cannot be removed
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
