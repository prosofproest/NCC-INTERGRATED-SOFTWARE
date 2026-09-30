import React from "react";
import { requireAdmin } from "@/lib/authorization";
import { AuditLogsView } from "@/features/audit/components/AuditLogsView";

export const metadata = {
  title: "Audit Logs | Admin Portal",
  description: "Immutable, append-only system audit trails and security activity logs.",
};

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  // Enforce Admin-only access per spec Section 20
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Append-Only Security Audit Trail
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitor real-time system events, cadet profile modifications, document validations, role updates, and administrative actions.
          </p>
        </div>
      </div>

      <AuditLogsView />
    </div>
  );
}
