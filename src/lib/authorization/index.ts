import { getSession } from "@/lib/auth/session";
import type { AuthSessionUser, UserRole } from "@/types/user";
import type { FieldDefinition } from "@/types/fields";

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 401, code = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Retrieves the verified session or throws a 401 AuthError.
 */
export async function getAuthorizedSession(): Promise<AuthSessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
  }
  return session;
}

/**
 * Enforces that the caller has one of the allowed roles.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthSessionUser> {
  const session = await getAuthorizedSession();

  if (!allowedRoles.includes(session.role)) {
    throw new AuthError(
      `Access denied. Role '${session.role}' is not authorized for this operation.`,
      403,
      "FORBIDDEN"
    );
  }

  return session;
}

/**
 * Enforces Admin role strictly.
 */
export async function requireAdmin(): Promise<AuthSessionUser> {
  return requireRole(["admin"]);
}

/**
 * Enforces CTO role strictly.
 */
export async function requireCto(): Promise<AuthSessionUser> {
  return requireRole(["cto"]);
}

/**
 * Enforces Cadet role strictly.
 */
export async function requireCadet(): Promise<AuthSessionUser> {
  return requireRole(["cadet"]);
}

/**
 * Enforces that the caller is either an Administrator or the specific Cadet
 * matching the target Cadet ID.
 */
export async function requireCadetOwnership(targetCadetId: string): Promise<AuthSessionUser> {
  const session = await getAuthorizedSession();

  if (session.role === "admin") {
    return session;
  }

  if (session.role === "cadet") {
    if (!session.cadetId || session.cadetId !== targetCadetId) {
      throw new AuthError(
        "Access denied. You may only view or update your own cadet record.",
        403,
        "FORBIDDEN_CADET_MISMATCH"
      );
    }
    return session;
  }

  throw new AuthError("Access denied for this cadet record.", 403, "FORBIDDEN");
}

// ==============================================================================
// FIELD-LEVEL PERMISSION ENFORCEMENT (§25–§27 in Architecture)
// ==============================================================================

/**
 * Evaluates whether a user with the specified role is permitted to view a dynamic field.
 */
export function canViewField(
  role: UserRole,
  field: Pick<FieldDefinition, "permissions" | "isActive">
): boolean {
  if (!field.isActive && role !== "admin") {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  if (role === "cto") {
    return Boolean(field.permissions?.ctoVisible);
  }

  if (role === "cadet") {
    return true; // Cadets can view active fields defined on their profile
  }

  return false;
}

/**
 * Evaluates whether a user with the specified role is permitted to edit a dynamic field directly.
 * If false for cadets, the cadet must submit a Change Request rather than editing in place.
 */
export function canEditField(
  role: UserRole,
  field: Pick<FieldDefinition, "permissions" | "isActive">,
  isCadetOwner = false
): boolean {
  if (!field.isActive) {
    return false;
  }

  if (role === "admin") {
    return true; // Admin has full edit privileges on all fields
  }

  if (role === "cto") {
    return false; // CTO has read-only access to cadet records; cannot edit fields
  }

  if (role === "cadet") {
    if (!isCadetOwner) return false;
    return Boolean(field.permissions?.cadetEditable);
  }

  return false;
}

/**
 * Evaluates whether a user with the specified role is permitted to export a dynamic field.
 */
export function canExportField(
  role: UserRole,
  field: Pick<FieldDefinition, "permissions" | "isActive">
): boolean {
  if (role === "admin") {
    return true;
  }

  if (role === "cto") {
    return Boolean(field.permissions?.ctoExportable);
  }

  return false; // Cadets cannot export data in bulk
}

/**
 * Filters an array of field definitions based on the user's role and intended action.
 */
export function filterFieldsForRole<T extends FieldDefinition>(
  role: UserRole,
  fields: T[],
  mode: "view" | "edit" | "export",
  isCadetOwner = false
): T[] {
  return fields.filter((field) => {
    if (mode === "view") return canViewField(role, field);
    if (mode === "edit") return canEditField(role, field, isCadetOwner);
    if (mode === "export") return canExportField(role, field);
    return false;
  });
}
