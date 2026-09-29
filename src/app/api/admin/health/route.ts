import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/authorization";
import { runSystemHealthCheck } from "@/features/health/services/healthChecker";
import type { HealthServiceId } from "@/types/health";

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce strict Admin-only authorization
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const simulateFailure = (searchParams.get("simulateFailure") as HealthServiceId) || undefined;

    // 2. Execute health checks
    const report = await runSystemHealthCheck({
      simulateFailureServiceId: simulateFailure,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("GET /api/admin/health error:", err);
    return NextResponse.json(
      { error: "Failed to run system health check: " + err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    let simulateFailure: HealthServiceId | undefined;
    try {
      const body = await req.json();
      simulateFailure = body?.simulateFailure;
    } catch {
      // Body is optional
    }

    const report = await runSystemHealthCheck({
      forceRetry: true,
      simulateFailureServiceId: simulateFailure,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const err = error as Error;
    console.error("POST /api/admin/health error:", err);
    return NextResponse.json(
      { error: "Failed to trigger system health check: " + err.message },
      { status: 500 }
    );
  }
}
