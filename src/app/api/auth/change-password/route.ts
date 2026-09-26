import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters in length." },
        { status: 400 }
      );
    }

    // Update password in Firebase Auth
    await adminAuth.updateUser(session.uid, {
      password: newPassword,
    });

    // Update mustChangePassword flag in Firestore user document
    await adminDb.collection("users").doc(session.uid).set(
      {
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

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
    const message = error instanceof Error ? error.message : "Failed to update password.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
