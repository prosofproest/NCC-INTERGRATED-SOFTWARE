import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { createBackup, listBackups } from "@/features/backups/services/backupService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Internal server error while listing backups" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await requireAdmin();
    const backup = await createBackup(session.uid, session.email || "admin@ncc.system");
    return NextResponse.json({ success: true, backup }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Failed to create database backup archive" },
      { status: 500 }
    );
  }
}
