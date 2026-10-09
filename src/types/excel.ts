/**
 * Types for Excel Import and Export Operations (Spec Sections 16, 17, 18)
 */

export interface CadetImportRow {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  enrollmentNo: string | null;
  trainingYear: "1st Year" | "2nd Year" | "3rd Year";
  division: "SD" | "SW";
  gender?: string | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicateInFile?: boolean;
  isDuplicateInDb?: boolean;
  isDuplicateEnrollmentInFile?: boolean;
  isDuplicateEnrollmentInDb?: boolean;
}

export interface CadetImportSummary {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  detectedSheet: string;
  allSheets: string[];
  columnMapping: Record<string, string>;
  duplicateEmailsInBatch: string[];
  duplicateEnrollmentsInBatch: string[];
  existingEmailsInDb: string[];
  existingEnrollmentsInDb: string[];
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
  trainingYear?: string;
  division?: string;
  wing?: string;
  status?: string;
  rank?: string;
  search?: string;
  selectedFieldIds: string[];
}
