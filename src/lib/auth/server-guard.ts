import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { AuthSessionUser, UserRole } from "@/types/user";

export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthSessionUser> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // Redirect to their own dashboard
    if (session.role === "admin") redirect("/admin");
    if (session.role === "cto") redirect("/cto");
    if (session.role === "cadet") redirect("/cadet");
    redirect("/login");
  }

  return session;
}
