import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { getClientIp, checkRateLimit, RateLimitProfiles } from "@/lib/security/rate-limit";
import { validateRequestBody } from "@/lib/security/validate";

const ResetCompleteSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  // 1. Rate Limiting Check
  const rateLimit = await checkRateLimit(`reset_complete:${ip}`, RateLimitProfiles.GENERAL_API);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // 2. Input Validation
  const validation = await validateRequestBody(req, ResetCompleteSchema);
  if (!validation.success) {
    return validation.response;
  }

  const normalizedEmail = validation.data.email.trim().toLowerCase();

  try {
    const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
    const userDocRef = adminDb.collection("users").doc(userRecord.uid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      await userDocRef.set(
        {
          mustChangePassword: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await logAuditEvent({
        actorId: userRecord.uid,
        actorEmail: normalizedEmail,
        actorRole: (userRecord.customClaims?.role as "admin" | "cto" | "cadet") || "cadet",
        action: "USER_PASSWORD_RESET_COMPLETED",
        entityType: "user",
        entityId: userRecord.uid,
        metadata: {
          flow: "activation_reset_link",
        },
        ipAddress: ip,
        userAgent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Avoid user enumeration
    console.warn("Reset password completion sync notice:", error);
    return NextResponse.json({ success: true });
  }
}
