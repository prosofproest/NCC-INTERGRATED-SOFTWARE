import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const COUNTERS_COLLECTION = "system_counters";

export type IdType =
  | "cadet"
  | "category"
  | "field"
  | "document"
  | "data_request"
  | "change_request"
  | "audit_log";

interface IdConfig {
  prefix: string;
  padding: number;
}

const ID_CONFIGS: Record<IdType, IdConfig> = {
  cadet: { prefix: "CADET_", padding: 4 }, // e.g. CADET_0001
  category: { prefix: "CAT_", padding: 3 }, // e.g. CAT_001
  field: { prefix: "FIELD_", padding: 5 }, // e.g. FIELD_00127
  document: { prefix: "DOC_", padding: 5 }, // e.g. DOC_00001
  data_request: { prefix: "REQ_", padding: 5 }, // e.g. REQ_00001
  change_request: { prefix: "CR_", padding: 5 }, // e.g. CR_00001
  audit_log: { prefix: "LOG_", padding: 7 }, // e.g. LOG_0000001
};

/**
 * Atomically generates a collision-safe sequential permanent identifier.
 * Uses Firestore transactions on the `system_counters` collection.
 * 
 * @param type The entity type for which to generate an ID
 * @returns Formatted permanent ID string (e.g. CADET_0001, FIELD_00127)
 */
export async function generatePermanentId(type: IdType): Promise<string> {
  const config = ID_CONFIGS[type];
  if (!config) {
    throw new Error(`Unsupported ID entity type: ${type}`);
  }

  const counterRef = adminDb.collection(COUNTERS_COLLECTION).doc(type);

  const nextSeq = await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);

    let nextValue = 1;
    if (doc.exists) {
      const current = doc.data()?.currentSequence;
      if (typeof current === "number") {
        nextValue = current + 1;
      }
    }

    transaction.set(
      counterRef,
      {
        type,
        currentSequence: nextValue,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return nextValue;
  });

  const paddedNum = String(nextSeq).padStart(config.padding, "0");
  return `${config.prefix}${paddedNum}`;
}

export const generateCadetId = () => generatePermanentId("cadet");
export const generateCategoryId = () => generatePermanentId("category");
export const generateFieldId = () => generatePermanentId("field");
export const generateDocumentId = () => generatePermanentId("document");
export const generateDataRequestId = () => generatePermanentId("data_request");
export const generateChangeRequestId = () => generatePermanentId("change_request");
export const generateAuditLogId = () => generatePermanentId("audit_log");
