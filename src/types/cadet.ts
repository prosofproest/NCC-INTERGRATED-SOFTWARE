export type CadetStatus = "active" | "passed_out" | "inactive" | "suspended";

export type CadetWing = "Army" | "Navy" | "Air";

export interface CadetRecord {
  cadetId: string; // Permanent primary key (e.g. CADET_0001)
  userId: string; // References Firebase Auth UID
  email: string;
  fullName: string;
  enrollmentNo: string | null; // e.g. "KAR/23/SDF/..." (may be null initially)
  rank: string; // e.g. "Cadet", "Corporal", "Sergeant", "CSUO"
  unit: string; // e.g. "1 Kar Air Sqn NCC"
  wing: CadetWing;
  status: CadetStatus;
  driveFolderId: string | null; // e.g. "1A2B3C..." Google Shared Drive folder ID
  driveFolderName?: string; // "[CADET_0001] John Doe"
  dynamicData: Record<string, unknown>; // Keyed by Field ID (e.g. FIELD_00127: "A+")
  completionPercentage: number; // 0 to 100
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CadetSummary {
  cadetId: string;
  fullName: string;
  email: string;
  enrollmentNo: string | null;
  rank: string;
  unit: string;
  wing: CadetWing;
  status: CadetStatus;
  completionPercentage: number;
}
