import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AuthSessionUser, UserRole } from "@/types/user";

export const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function createSessionCookieFromIdToken(idToken: string) {
  // 1. Verify the ID token to ensure it's authentic and recent
  const decodedIdToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedIdToken.uid;
  const email = decodedIdToken.email || "";

  // 2. Fetch role and status from Firestore user document
  const userDocRef = adminDb.collection("users").doc(uid);
  const userDoc = await userDocRef.get();

  let role = decodedIdToken.role as UserRole | undefined;
  let mustChangePassword = false;
  let cadetId = decodedIdToken.cadetId as string | undefined;

  if (userDoc.exists) {
    const userData = userDoc.data();
    role = userData?.role || role;
    mustChangePassword = Boolean(userData?.mustChangePassword);
    cadetId = userData?.cadetId || cadetId;
  }

  // If user role is present in DB but missing from custom claims, sync it to Firebase Auth custom claims
  if (role && decodedIdToken.role !== role) {
    await adminAuth.setCustomUserClaims(uid, {
      role,
      cadetId: cadetId || null,
    });
  }

  if (!role) {
    throw new Error("No authorized role assigned to this account. Contact your administrator.");
  }

  // 3. Create the Firebase session cookie
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY_MS,
  });

  // 4. Store in HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    maxAge: Math.floor(SESSION_EXPIRY_MS / 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return {
    uid,
    email,
    role,
    mustChangePassword,
    cadetId,
  };
}

export async function getSession(): Promise<AuthSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return null;
    }

    // Verify session cookie with revocation check
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    const email = decodedClaims.email || "";
    const role = (decodedClaims.role as UserRole) || null;

    if (!role) {
      return null;
    }

    // Check if user still exists and whether mustChangePassword is required
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const mustChangePassword = Boolean(userData?.mustChangePassword);
    const cadetId = userData?.cadetId || (decodedClaims.cadetId as string | undefined);

    return {
      uid,
      email,
      role: userData?.role || role,
      mustChangePassword,
      cadetId,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Ignore if expired or revoked
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
