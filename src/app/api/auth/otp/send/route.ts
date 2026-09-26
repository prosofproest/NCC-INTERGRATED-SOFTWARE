import { NextResponse } from "next/server";
import { requestAndSendOTP } from "@/lib/auth/otp";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify user exists in Firebase Auth before dispatching OTP
    try {
      await adminAuth.getUserByEmail(normalizedEmail);
    } catch {
      // Return a generic success to prevent email enumeration attacks, or inform user
      return NextResponse.json(
        { success: false, error: "No account registered with this email address." },
        { status: 404 }
      );
    }

    const result = await requestAndSendOTP(normalizedEmail);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message, cooldownRemaining: result.cooldownRemaining }, { status: 429 });
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully to your email." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send OTP.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
