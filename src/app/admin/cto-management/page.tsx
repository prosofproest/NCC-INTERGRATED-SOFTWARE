import React from "react";
import { requireAdmin } from "@/lib/authorization";
import { CtoManagementView } from "@/features/cto-management/components/CtoManagementView";

export const metadata = {
  title: "CTO Management | Admin Portal",
};

export const dynamic = "force-dynamic";

export default async function AdminCtoManagementPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Care Taker Officer (CTO) Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Provision officer accounts, assign role permissions, monitor security status, and manage portal access.
          </p>
        </div>
      </div>

      <CtoManagementView />
    </div>
  );
}
