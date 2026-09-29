import React from "react";
import { AdminNotificationsManager } from "@/features/notifications/components/AdminNotificationsManager";

export const metadata = {
  title: "Notifications | Admin Portal",
};

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications &amp; Announcements
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dispatch announcements, communicate alerts across portals, and track read rates.
          </p>
        </div>
      </div>

      <AdminNotificationsManager />
    </div>
  );
}
