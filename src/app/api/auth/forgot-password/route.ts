import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { checkRateLimit, getClientIp, RateLimitProfiles } from "@/lib/security/rate-limit";
import { validateRequestBody } from "@/lib/security/validate";
import { logAuditEvent } from "@/lib/security/audit";

const ForgotPasswordInputSchema = z.object({
  email: z.string().email("A valid email address is required"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 1. IP-level Rate Limiting against email bombing
  const rateLimit = await checkRateLimit(`forgot_pw:${ip}`, RateLimitProfiles.FORGOT_PASSWORD);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many password reset requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // 2. Input Sanitization & Zod Schema Validation
  const validation = await validateRequestBody(request, ForgotPasswordInputSchema);
  if (!validation.success) {
    return validation.response;
  }

  const { email } = validation.data;
  const normalizedEmail = email.toLowerCase();

  try {
    let userFound = false;
    let userId = "unknown";

    try {
      const user = await adminAuth.getUserByEmail(normalizedEmail);
      userFound = true;
      userId = user.uid;

      // Generate cryptographically secure Firebase password reset link
      const resetLink = await adminAuth.generatePasswordResetLink(normalizedEmail);

      // Dispatch branded email via configured SMTP
      await sendPasswordResetEmail(normalizedEmail, resetLink);
    } catch {
      // Intentionally suppress user not found to prevent user enumeration
    }

    // 3. Audit Log Event
    await logAuditEvent({
      actorId: userFound ? userId : "unauthenticated",
      actorEmail: normalizedEmail,
      actorRole: "system",
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "user",
      entityId: userFound ? userId : normalizedEmail,
      metadata: { userFound },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, password reset instructions have been sent.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate password reset.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
