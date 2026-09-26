import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearSession();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  await clearSession();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
