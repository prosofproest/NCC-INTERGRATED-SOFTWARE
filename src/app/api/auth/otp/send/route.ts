import { NextResponse } from "next/server";
import { z } from "zod";
import { requestAndSendOTP } from "@/lib/auth/otp";
import { adminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp, RateLimitProfiles } from "@/lib/security/rate-limit";
import { validateRequestBody } from "@/lib/security/validate";
import { logAuditEvent } from "@/lib/security/audit";
import type { AuditActorRole } from "@/types/audit";

const OtpSendInputSchema = z.object({
  email: z.string().email("A valid email address is required"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 1. IP-level Rate Limiting
  const ipLimit = await checkRateLimit(`otp_send_ip:${ip}`, RateLimitProfiles.OTP_SEND);
  if (!ipLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Please wait ${ipLimit.retryAfterSeconds} seconds before requesting another verification code.`,
        cooldownRemaining: ipLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  // 2. Input Sanitization & Zod Schema Validation
  const validation = await validateRequestBody(request, OtpSendInputSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { email } = validation.data;
  const normalizedEmail = email.toLowerCase();

  try {
    // 3. Verify user exists in Firebase Auth before dispatching OTP
    let user;
    try {
      user = await adminAuth.getUserByEmail(normalizedEmail);
    } catch {
      return NextResponse.json(
        { success: false, error: "No account registered with this email address." },
        { status: 404 }
      );
    }

    // 4. Request & Dispatch OTP via SMTP
    const result = await requestAndSendOTP(normalizedEmail);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          cooldownRemaining: result.cooldownRemaining,
        },
        { status: 429 }
      );
    }

    // 5. Audit Log Event
    await logAuditEvent({
      actorId: user.uid,
      actorEmail: normalizedEmail,
      actorRole: (user.customClaims?.role as AuditActorRole) || "system",
      action: "OTP_DISPATCHED",
      entityType: "user",
      entityId: user.uid,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: true, message: "OTP sent successfully to your email." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send OTP.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
