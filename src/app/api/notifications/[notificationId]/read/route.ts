import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { markNotificationAsRead } from "@/lib/notifications/service";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = await params;
    if (!notificationId) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const res = await markNotificationAsRead(notificationId, session.uid);
    return NextResponse.json(res);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("PATCH /api/notifications/[notificationId]/read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read: " + error.message },
      { status: 500 }
    );
  }
}
