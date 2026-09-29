import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserNotifications } from "@/lib/notifications/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const notifications = await getUserNotifications({
      uid: session.uid,
      role: session.role,
      cadetId: session.cadetId,
      limit,
    });

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications: " + error.message },
      { status: 500 }
    );
  }
}
