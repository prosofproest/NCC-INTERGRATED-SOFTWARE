import { NextResponse } from "next/server";
import { verifyOTP } from "@/lib/auth/otp";
import { OtpInputSchema } from "@/lib/validation/user";
import { checkRateLimit, getClientIp, RateLimitProfiles } from "@/lib/security/rate-limit";
import { validateRequestBody } from "@/lib/security/validate";
import { logAuditEvent } from "@/lib/security/audit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 1. IP-level Rate Limiting against brute forcing
  const ipLimit = await checkRateLimit(`otp_verify_ip:${ip}`, RateLimitProfiles.OTP_VERIFY);
  if (!ipLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many failed attempts. Please try again in ${ipLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      }
    );
  }

  // 2. Input Sanitization & Zod Schema Validation
  const validation = await validateRequestBody(request, OtpInputSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { email, otp } = validation.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const result = await verifyOTP(normalizedEmail, otp);

    if (!result.valid) {
      await logAuditEvent({
        actorId: "unauthenticated",
        actorEmail: normalizedEmail,
        actorRole: "system",
        action: "OTP_VERIFICATION_FAILED",
        entityType: "user",
        entityId: normalizedEmail,
        metadata: {
          reason: result.message,
          attemptsRemaining: result.attemptsRemaining,
        },
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.message || "Invalid OTP code.",
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 400 }
      );
    }

    await logAuditEvent({
      actorId: normalizedEmail,
      actorEmail: normalizedEmail,
      actorRole: "system",
      action: "OTP_VERIFIED_SUCCESS",
      entityType: "user",
      entityId: normalizedEmail,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify OTP.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
