import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "__session";

interface DecodedTokenPayload {
  uid?: string;
  role?: "admin" | "cto" | "cadet";
  exp?: number;
}

function parseJwtPayload(token: string): DecodedTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as DecodedTokenPayload;
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const decoded = sessionCookie ? parseJwtPayload(sessionCookie) : null;
  const isExpired = decoded?.exp ? decoded.exp * 1000 < Date.now() : true;
  const isAuthenticated = Boolean(decoded?.uid && !isExpired);
  const userRole = decoded?.role;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/verify-otp") ||
    pathname.startsWith("/reset-password");

  const isProtectedRoleRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/cto") ||
    pathname.startsWith("/cadet");

  // 1. If user is already authenticated and visits an auth page, redirect to their role portal
  if (isAuthRoute && isAuthenticated && userRole) {
    if (userRole === "admin") return applySecurityHeaders(NextResponse.redirect(new URL("/admin", request.url)));
    if (userRole === "cto") return applySecurityHeaders(NextResponse.redirect(new URL("/cto", request.url)));
    if (userRole === "cadet") return applySecurityHeaders(NextResponse.redirect(new URL("/cadet", request.url)));
  }

  // 2. Protect role-based routes
  if (isProtectedRoleRoute) {
    if (!isAuthenticated || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (sessionCookie && isExpired) {
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
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/cto/:path*",
    "/cadet/:path*",
    "/login",
    "/forgot-password",
    "/verify-otp",
    "/reset-password",
  ],
};
