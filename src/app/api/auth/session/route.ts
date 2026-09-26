import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookieFromIdToken } from "@/lib/auth/session";
import { checkRateLimit, getClientIp, RateLimitProfiles } from "@/lib/security/rate-limit";
import { validateRequestBody } from "@/lib/security/validate";
import { logAuditEvent } from "@/lib/security/audit";

const SessionInputSchema = z.object({
  idToken: z.string().min(10, "A valid Firebase ID token is required"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 1. Rate Limiting Check (5 attempts / min)
  const rateLimit = await checkRateLimit(`login:${ip}`, RateLimitProfiles.LOGIN);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // 2. Input Sanitization & Zod Schema Validation
  const validation = await validateRequestBody(request, SessionInputSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { idToken } = validation.data;

  try {
    // 3. Verify ID Token & Create HTTP-Only Session Cookie
    const sessionData = await createSessionCookieFromIdToken(idToken);

    let redirectTo = "/login";
    if (sessionData.mustChangePassword) {
      redirectTo = "/change-password";
    } else if (sessionData.role === "admin") {
      redirectTo = "/admin";
    } else if (sessionData.role === "cto") {
      redirectTo = "/cto";
    } else if (sessionData.role === "cadet") {
      redirectTo = "/cadet";
    }

    // 4. Record Audit Log for successful authentication
    await logAuditEvent({
      actorId: sessionData.uid,
      actorEmail: sessionData.email,
      actorRole: sessionData.role,
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "user",
      entityId: sessionData.uid,
      metadata: {
        mustChangePassword: sessionData.mustChangePassword,
        cadetId: sessionData.cadetId || null,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      role: sessionData.role,
      mustChangePassword: sessionData.mustChangePassword,
      redirectTo,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to establish session.";

    // Record Audit Log for failed authentication attempt
    await logAuditEvent({
      actorId: "unauthenticated",
      actorEmail: "unknown",
      actorRole: "system",
      action: "AUTH_LOGIN_FAILED",
      entityType: "user",
      entityId: "unknown",
      metadata: { failureReason: message },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
