import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check if user exists
      await adminAuth.getUserByEmail(normalizedEmail);

      // Generate cryptographically secure Firebase password reset link
      const resetLink = await adminAuth.generatePasswordResetLink(normalizedEmail);

      // Dispatch branded email via configured SMTP
      await sendPasswordResetEmail(normalizedEmail, resetLink);
    } catch {
      // Return success message regardless to prevent user enumeration
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, password reset instructions have been sent.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate password reset.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
