import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { sendCtoWelcomeEmail } from "@/lib/email/mailer";
import type { UserProfile } from "@/types/user";

const createCtoSchema = z.object({
  email: z.string().email("A valid email address is required"),
  name: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
});

/**
 * GET /api/admin/cto
 * Lists all existing CTO accounts from Firestore users collection
 */
export async function GET() {
  try {
    await requireAdmin();

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "cto")
      .get();

    const ctoUsers: UserProfile[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      ctoUsers.push({
        uid: doc.id,
        email: data.email,
        name: data.name || "Care Taker Officer",
        role: "cto",
        status: data.status || (data.disabled ? "locked" : "active"),
        disabled: Boolean(data.disabled),
        mustChangePassword: Boolean(data.mustChangePassword),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    // Sort descending by creation date
    ctoUsers.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      officers: ctoUsers,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("GET /api/admin/cto error:", err);
    return NextResponse.json(
      { error: "Failed to fetch CTO officers: " + err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cto
 * Creates a new CTO officer account with Auth credentials, custom claim, Firestore doc, and activation email
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const parsed = createCtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, name } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists in Firebase Auth
    let userExists = false;
    try {
      await adminAuth.getUserByEmail(normalizedEmail);
      userExists = true;
    } catch {
      // User doesn't exist, proceed
    }

    if (userExists) {
      return NextResponse.json(
        { error: `An account with email "${normalizedEmail}" already exists.` },
        { status: 409 }
      );
    }

    // 2. Create Firebase Auth user with random temporary password
    const tempPassword = `NccCto@${Math.random().toString(36).substring(2, 8)}!${Date.now().toString().slice(-4)}`;
    const userRecord = await adminAuth.createUser({
      email: normalizedEmail,
      displayName: name.trim(),
      password: tempPassword,
    });

    // 3. Set custom claim for CTO role
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: "cto",
    });

    // 4. Create Firestore user document
    const now = new Date().toISOString();
    const userDocData: UserProfile = {
      uid: userRecord.uid,
      email: normalizedEmail,
      name: name.trim(),
      role: "cto",
      status: "active",
      disabled: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("users").doc(userRecord.uid).set(userDocData);

    // 5. Generate secure activation link and dispatch welcome email
    let setupLink: string | undefined;
    try {
      setupLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
    } catch (linkErr) {
      console.warn("Could not generate password setup link for CTO:", linkErr);
    }

    let emailSent = false;
    try {
      await sendCtoWelcomeEmail({
        to: normalizedEmail,
        officerName: name.trim(),
        setupLink,
      });
      emailSent = true;
    } catch (mailErr) {
      console.error("Non-blocking error dispatching CTO welcome email:", mailErr);
    }

    // 6. Record Audit Log
    await logAuditEvent({
      actorId: session.uid,
      actorEmail: session.email,
      actorRole: "admin",
      action: "CTO_ACCOUNT_CREATED",
      entityType: "user",
      entityId: userRecord.uid,
      newState: {
        uid: userRecord.uid,
        email: normalizedEmail,
        name: name.trim(),
        role: "cto",
        status: "active",
        emailSent,
      },
      metadata: {
        officerName: name.trim(),
        officerEmail: normalizedEmail,
      },
    });

    return NextResponse.json({
      success: true,
      officer: userDocData,
      setupLink, // Available for fallback or direct admin preview if needed
      emailSent,
      message: `CTO officer account created successfully for ${name.trim()}.`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("POST /api/admin/cto error:", err);
    return NextResponse.json(
      { error: "Failed to create CTO officer: " + err.message },
      { status: 500 }
    );
  }
}
