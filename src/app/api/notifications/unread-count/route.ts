import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications/service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const unreadCount = await getUnreadNotificationCount({
      uid: session.uid,
      role: session.role,
      cadetId: session.cadetId,
    });

    return NextResponse.json({
      success: true,
      unreadCount,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET /api/notifications/unread-count error:", error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
