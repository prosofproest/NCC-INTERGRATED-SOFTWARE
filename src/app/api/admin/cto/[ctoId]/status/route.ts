import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";

const statusActionSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ctoId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { ctoId } = await context.params;

    const body = await req.json();
    const parsed = statusActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'deactivate' or 'reactivate'." },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    // Check if target user exists and has CTO role
    const userDocRef = adminDb.collection("users").doc(ctoId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return NextResponse.json(
        { error: "Target officer account does not exist." },
        { status: 404 }
      );
    }

    const userData = userDocSnap.data();
    if (userData?.role !== "cto") {
      return NextResponse.json(
        { error: "Target user is not a Care Taker Officer." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === "deactivate") {
      // 1. Disable in Firebase Auth
      await adminAuth.updateUser(ctoId, { disabled: true });
      // 2. Revoke active refresh tokens immediately
      await adminAuth.revokeRefreshTokens(ctoId);
      // 3. Update Firestore status
      await userDocRef.update({
        status: "locked",
        disabled: true,
        updatedAt: now,
      });

      // 4. Audit Log
      await logAuditEvent({
        actorId: session.uid,
        actorEmail: session.email,
        actorRole: "admin",
        action: "CTO_ACCOUNT_DEACTIVATED",
        entityType: "user",
        entityId: ctoId,
        previousState: { status: userData.status || "active", disabled: false },
        newState: { status: "locked", disabled: true },
        metadata: { officerEmail: userData.email, officerName: userData.name },
      });

      return NextResponse.json({
        success: true,
        status: "locked",
        message: `Account for ${userData.name || userData.email} has been deactivated and active sessions revoked.`,
      });
    } else {
      // Reactivate
      // 1. Enable in Firebase Auth
      await adminAuth.updateUser(ctoId, { disabled: false });
      // 2. Update Firestore status
      await userDocRef.update({
        status: "active",
        disabled: false,
        updatedAt: now,
      });

      // 3. Audit Log
      await logAuditEvent({
        actorId: session.uid,
        actorEmail: session.email,
        actorRole: "admin",
        action: "CTO_ACCOUNT_REACTIVATED",
        entityType: "user",
        entityId: ctoId,
        previousState: { status: userData.status || "locked", disabled: true },
        newState: { status: "active", disabled: false },
        metadata: { officerEmail: userData.email, officerName: userData.name },
      });

      return NextResponse.json({
        success: true,
        status: "active",
        message: `Account for ${userData.name || userData.email} has been reactivated.`,
      });
    }
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("PATCH /api/admin/cto/[ctoId]/status error:", err);
    return NextResponse.json(
      { error: "Failed to update officer status: " + err.message },
      { status: 500 }
    );
  }
}
