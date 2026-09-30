import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { deleteBackup, getBackupById } from "@/features/backups/services/backupService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ backupId: string }> }
) {
  try {
    await requireAdmin();
    const { backupId } = await props.params;
    const backup = await getBackupById(backupId, false);

    if (!backup) {
      return NextResponse.json({ error: "Backup archive not found" }, { status: 404 });
    }

    return NextResponse.json({ backup });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/backups/[backupId] error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching backup details" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ backupId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { backupId } = await props.params;
    const success = await deleteBackup(backupId, session.uid, session.email || "admin@ncc.system");

    if (!success) {
      return NextResponse.json({ error: "Backup archive not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Backup archive deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/admin/backups/[backupId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete backup archive" },
      { status: 500 }
    );
  }
}
