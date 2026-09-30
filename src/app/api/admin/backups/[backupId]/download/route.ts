import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { getBackupById } from "@/features/backups/services/backupService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ backupId: string }> }
) {
  try {
    await requireAdmin();
    const { backupId } = await props.params;
    const backup = await getBackupById(backupId, true);

    if (!backup || !backup.snapshot) {
      return NextResponse.json(
        { error: "Backup archive not found or snapshot missing" },
        { status: 404 }
      );
    }

    const payload = {
      backupId: backup.backupId,
      createdAt: backup.createdAt,
      createdBy: backup.createdBy,
      recordCounts: backup.recordCounts,
      totalRecords: backup.totalRecords,
      sizeBytes: backup.sizeBytes,
      retentionPolicy: backup.retentionPolicy,
      snapshot: backup.snapshot,
    };

    const jsonString = JSON.stringify(payload, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ncc_backup_${backupId}.json"`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/admin/backups/[backupId]/download error:", error);
    return NextResponse.json(
      { error: "Internal server error while downloading backup archive" },
      { status: 500 }
    );
  }
}
