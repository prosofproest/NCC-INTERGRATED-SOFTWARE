export type DataRequestStatus = "draft" | "open" | "closed";
export type CadetResponseStatus = "pending" | "completed";

export interface CadetResponseRecord {
  status: CadetResponseStatus;
  completedAt?: string;
  cadetName?: string;
  submittedValues?: Record<string, unknown>;
  missingFieldIds?: string[];
}

export interface DataRequest {
  requestId: string; // Permanent ID, e.g. REQ_00001
  title: string;
  purpose: string;
  requestedBy: string; // Firebase Auth UID
  requesterRole: "admin" | "cto";
  requesterEmail?: string;
  requesterName?: string;
  targetCadetIds: string[] | "all"; // Specific cadets or all active cadets
  requiredFieldIds: string[]; // Field IDs required to be populated
  deadline?: string;
  status: DataRequestStatus;
  cadetResponses: Record<string, CadetResponseRecord>; // Keyed by Cadet ID
  createdAt: string;
  updatedAt: string;
}

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  changeRequestId: string; // Permanent ID, e.g. CR_00001
  cadetId: string; // References Cadet ID
  fieldId: string; // References Field ID
  fieldLabel: string; // Snapshot of field label for historical display
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  status: ChangeRequestStatus;
  requestedBy: string; // Cadet UID
  requestedAt: string;
  reviewedBy?: string; // Admin UID
  reviewedAt?: string;
  reviewerComments?: string;
  createdAt: string;
  updatedAt: string;
}
