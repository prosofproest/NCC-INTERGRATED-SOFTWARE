export type UserRole = "admin" | "cto" | "cadet";

export interface UserCustomClaims {
  role: UserRole;
  cadetId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
  cadetId?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionUser {
  uid: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  cadetId?: string;
}

export interface LoginResponse {
  success: boolean;
  role?: UserRole;
  redirectTo?: string;
  requiresOtp?: boolean;
  mustChangePassword?: boolean;
  error?: string;
}
