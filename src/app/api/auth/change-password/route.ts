import { NextResponse } from "next/server";
import { getAuthorizedSession, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ChangePasswordInputSchema } from "@/lib/validation/user";
import { validateRequestBody } from "@/lib/security/validate";
import { logAuditEvent } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // 1. Enforce Authentication via Centralized Authorization Helper
    const session = await getAuthorizedSession();

    // 2. Input Sanitization & Zod Schema Validation
    const validation = await validateRequestBody(request, ChangePasswordInputSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { newPassword } = validation.data;

    // 3. Update password in Firebase Auth
    await adminAuth.updateUser(session.uid, {
      password: newPassword,
    });

    // 4. Clear mustChangePassword flag in Firestore
    await adminDb.collection("users").doc(session.uid).set(
      {
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 5. Audit Log Event
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "USER_PASSWORD_CHANGED",
      entityType: "user",
      entityId: session.uid,
      ipAddress: ip,
      userAgent,
    });

    let redirectTo = "/login";
    if (session.role === "admin") redirectTo = "/admin";
    else if (session.role === "cto") redirectTo = "/cto";
    else if (session.role === "cadet") redirectTo = "/cadet";

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      redirectTo,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to update password.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
