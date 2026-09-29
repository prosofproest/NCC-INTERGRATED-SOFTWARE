/**
 * Types for Stage 11: Excel Import and Export Operations (Spec Sections 16, 17, 18)
 */

export interface CadetImportRow {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  isValid: boolean;
  errors: string[];
  isDuplicateInFile?: boolean;
  isDuplicateInDb?: boolean;
}

export interface CadetImportSummary {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateEmailsInBatch: string[];
  existingEmailsInDb: string[];
}

export interface CadetCandidateMatch {
  cadetId: string;
  fullName: string;
  rank: string;
  wing: string;
  unit: string;
  enrollmentNo: string | null;
}

export interface EnrollmentImportRow {
  rowNumber: number;
  name: string;
  enrollmentNo: string;
  matchedCadetId?: string | null;
  matchStatus: "exact" | "ambiguous" | "unmatched" | "invalid";
  candidateCadets?: CadetCandidateMatch[];
  errors: string[];
}

export interface EnrollmentImportSummary {
  totalRows: number;
  exactCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  invalidCount: number;
}

export interface ExportFieldOption {
  id: string;
  label: string;
  category: string;
  isCore: boolean;
  ctoExportable: boolean;
}

export interface ExportFilterOptions {
  wing?: string;
  status?: string;
  rank?: string;
  search?: string;
  selectedFieldIds: string[];
}
