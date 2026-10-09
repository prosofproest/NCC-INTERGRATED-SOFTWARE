import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { sendCadetWelcomeEmail } from "@/lib/email/mailer";
import type { CadetRecord } from "@/types/cadet";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ cadetId: string }>;
}

/**
 * POST /api/admin/cadets/[cadetId]/resend-invite
 * Resends the welcome & password setup email for an existing cadet account.
 * Strictly Admin-only.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    const { cadetId } = await params;

    const cadetDoc = await adminDb.collection("cadets").doc(cadetId).get();
    if (!cadetDoc.exists) {
      return NextResponse.json(
        { error: `Cadet record '${cadetId}' was not found.` },
        { status: 404 }
      );
    }

    const cadet = cadetDoc.data() as CadetRecord;
    const cadetEmail = cadet.email?.toLowerCase().trim();

    if (!cadetEmail) {
      return NextResponse.json(
        { error: "Cadet does not have a registered email address." },
        { status: 400 }
      );
    }

    // Generate fresh password reset / activation link
    let setupLink: string | undefined;
    try {
      setupLink = await adminAuth.generatePasswordResetLink(cadetEmail);
    } catch (linkErr: unknown) {
      console.warn("Could not generate password reset link for cadet:", linkErr);
    }

    // Dispatch welcome email
    await sendCadetWelcomeEmail({
      to: cadetEmail,
      cadetName: cadet.fullName,
      cadetId: cadet.cadetId,
      setupLink,
    });

    // Record audit event
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "CADET_INVITE_RESENT",
      entityType: "cadet",
      entityId: cadetId,
      metadata: {
        cadetId,
        cadetEmail,
        cadetName: cadet.fullName,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Welcome invitation email sent successfully to ${cadetEmail}.`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/cadets/[cadetId]/resend-invite error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to resend welcome email." },
      { status: 500 }
    );
  }
}
