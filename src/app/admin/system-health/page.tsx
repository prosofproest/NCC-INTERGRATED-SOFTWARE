import React from "react";
import { requireAdmin } from "@/lib/authorization";
import { SystemHealthView } from "@/features/health/components/SystemHealthView";

export const metadata = {
  title: "System Health & Diagnostics | Admin Portal",
  description: "Live health status, reachability, latency diagnostics, and active incidents for NCC Integrated Software.",
};

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  // Enforce Admin-only access per spec Section 21
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Infrastructure Telemetry Active
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Health Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time diagnostic checks, latency monitoring, failover recovery tracking, and external service status.
          </p>
        </div>
      </div>

      <SystemHealthView />
    </div>
  );
}
