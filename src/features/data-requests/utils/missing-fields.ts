/**
 * Utility functions for computing missing fields in Data Requests.
 * Specification Section 10: "Ask only for what's missing".
 */

/**
 * Checks whether a field value in cadet dynamicData is considered missing or blank.
 */
export function isFieldMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Computes which of the requested fields are missing from a cadet's dynamicData.
 *
 * @param requiredFieldIds The list of field IDs specified in the data request.
 * @param dynamicData The cadet's current dynamicData map.
 * @returns Array of field IDs that are currently missing or empty for this cadet.
 */
export function computeMissingFieldIds(
  requiredFieldIds: string[],
  dynamicData?: Record<string, unknown> | null
): string[] {
  const data = dynamicData || {};
  return requiredFieldIds.filter((fieldId) => isFieldMissing(data[fieldId]));
}
