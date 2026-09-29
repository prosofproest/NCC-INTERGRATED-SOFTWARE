import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { markAllNotificationsAsRead } from "@/lib/notifications/service";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await markAllNotificationsAsRead({
      uid: session.uid,
      role: session.role,
      cadetId: session.cadetId,
    });

    return NextResponse.json({
      success: true,
      markedCount: res.count,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("POST /api/notifications/read-all error:", error);
    return NextResponse.json(
      { error: "Failed to mark all as read: " + error.message },
      { status: 500 }
    );
  }
}
