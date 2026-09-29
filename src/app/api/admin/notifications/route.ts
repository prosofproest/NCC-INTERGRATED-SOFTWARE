import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { createBroadcastNotification, getAdminSentBroadcasts } from "@/lib/notifications/service";
import { sendBroadcastNotificationSchema } from "@/types/notifications";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const broadcasts = await getAdminSentBroadcasts(limit);
    return NextResponse.json({
      success: true,
      broadcasts,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("GET /api/admin/notifications error:", err);
    return NextResponse.json(
      { error: "Failed to fetch broadcasts: " + err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const parsed = sendBroadcastNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { targetGroup, targetCadetIds, targetUserId, title, message, importance, link } =
      parsed.data;

    const result = await createBroadcastNotification({
      targetGroup,
      targetCadetIds,
      targetUserId,
      title,
      message,
      importance,
      link,
      sender: {
        id: session.uid,
        name: session.email || "System Admin",
        role: "admin",
      },
    });

    return NextResponse.json({
      success: true,
      broadcastId: result.broadcastId,
      recipientCount: result.recipientCount,
      message: `Notification broadcast sent successfully to ${result.recipientCount} recipient(s).`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("POST /api/admin/notifications error:", err);
    return NextResponse.json(
      { error: "Failed to send broadcast: " + err.message },
      { status: 500 }
    );
  }
}
