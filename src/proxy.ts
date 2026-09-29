import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "__session";

interface DecodedTokenPayload {
  uid?: string;
  user_id?: string;
  sub?: string;
  role?: "admin" | "cto" | "cadet";
  exp?: number;
}

function parseJwtPayload(token: string): DecodedTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload) as DecodedTokenPayload;
    return {
      ...parsed,
      uid: parsed.uid || parsed.user_id || parsed.sub,
    };
  } catch {
    return null;
  }
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const decoded = sessionCookie ? parseJwtPayload(sessionCookie) : null;
  const isExpired = decoded?.exp ? decoded.exp * 1000 < Date.now() : true;
  const uid = decoded?.uid || decoded?.user_id || decoded?.sub;
  const isAuthenticated = Boolean(uid && !isExpired);
  const userRole = decoded?.role;

  // Protect role-based routes: /admin, /cto, /cadet
  if (!isAuthenticated || !userRole) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Explicitly delete session cookie so stale/revoked cookies do not cause redirect loops
    if (sessionCookie) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
    return applySecurityHeaders(response);
  }

  // Role-specific authorization boundaries
  if (pathname.startsWith("/admin") && userRole !== "admin") {
    const target = userRole === "cto" ? "/cto" : "/cadet";
    return applySecurityHeaders(NextResponse.redirect(new URL(target, request.url)));
  }

  if (pathname.startsWith("/cto") && userRole !== "cto") {
    const target = userRole === "admin" ? "/admin" : "/cadet";
    return applySecurityHeaders(NextResponse.redirect(new URL(target, request.url)));
  }

  if (pathname.startsWith("/cadet") && userRole !== "cadet") {
    const target = userRole === "admin" ? "/admin" : "/cto";
    return applySecurityHeaders(NextResponse.redirect(new URL(target, request.url)));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Only match protected role routes. Never intercept /login or public auth routes.
  matcher: [
    "/admin/:path*",
    "/cto/:path*",
    "/cadet/:path*",
  ],
};
