import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  const session = await getSession();
  if (session) {
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "AUTH_LOGOUT",
      entityType: "user",
      entityId: session.uid,
      ipAddress: ip,
      userAgent,
    });
  }

  await clearSession();
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.delete("__session");
  return response;
}

export async function GET(request: Request) {
  return POST(request);
}
