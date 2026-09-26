import { NextResponse } from "next/server";
import { verifyOTP } from "@/lib/auth/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: "Email and OTP code are required." }, { status: 400 });
    }

    const result = await verifyOTP(email, otp);

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          error: result.message || "Invalid OTP.",
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP verified successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify OTP.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
