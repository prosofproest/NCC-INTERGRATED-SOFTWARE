import { NextResponse } from "next/server";
import { createSessionCookieFromIdToken } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { success: false, error: "ID token is required." },
        { status: 400 }
      );
    }

    const sessionData = await createSessionCookieFromIdToken(idToken);

    let redirectTo = "/login";
    if (sessionData.mustChangePassword) {
      redirectTo = "/change-password";
    } else if (sessionData.role === "admin") {
      redirectTo = "/admin";
    } else if (sessionData.role === "cto") {
      redirectTo = "/cto";
    } else if (sessionData.role === "cadet") {
      redirectTo = "/cadet";
    }

    return NextResponse.json({
      success: true,
      role: sessionData.role,
      mustChangePassword: sessionData.mustChangePassword,
      redirectTo,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to establish session.";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
