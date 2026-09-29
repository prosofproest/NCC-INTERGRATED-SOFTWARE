import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendCtoWelcomeEmail } from "@/lib/email/mailer";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ctoId: string }> }
) {
  try {
    await requireAdmin();
    const { ctoId } = await context.params;

    const userDocRef = adminDb.collection("users").doc(ctoId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return NextResponse.json(
        { error: "Officer account does not exist." },
        { status: 404 }
      );
    }

    const userData = userDocSnap.data();
    if (userData?.role !== "cto") {
      return NextResponse.json(
        { error: "Target account is not a CTO officer." },
        { status: 400 }
      );
    }

    if (userData?.disabled || userData?.status === "locked") {
      return NextResponse.json(
        { error: "Cannot send invitation to a deactivated officer account. Reactivate the account first." },
        { status: 400 }
      );
    }

    const setupLink = await adminAuth.generatePasswordResetLink(userData.email);
    await sendCtoWelcomeEmail({
      to: userData.email,
      officerName: userData.name || "Care Taker Officer",
      setupLink,
    });

    return NextResponse.json({
      success: true,
      message: `Activation invitation email resent to ${userData.email}.`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("POST /api/admin/cto/[ctoId]/resend-invite error:", err);
    return NextResponse.json(
      { error: "Failed to resend invite: " + err.message },
      { status: 500 }
    );
  }
}
