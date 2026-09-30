import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { restoreFromBackup } from "@/features/backups/services/backupService";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  props: { params: Promise<{ backupId: string }> }
) {
  try {
    const session = await requireAdmin();
    const { backupId } = await props.params;

    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "RESTORE") {
      return NextResponse.json(
        {
          error: "Explicit safety confirmation required. Please type 'RESTORE' to execute system restoration.",
          code: "INVALID_CONFIRMATION",
        },
        { status: 400 }
      );
    }

    const collections = Array.isArray(body.collections) && body.collections.length > 0
      ? body.collections
      : undefined;

    const result = await restoreFromBackup(
      backupId,
      collections,
      session.uid,
      session.email || "admin@ncc.system"
    );

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/admin/backups/[backupId]/restore error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to execute system restoration",
      },
      { status: 500 }
    );
  }
}
