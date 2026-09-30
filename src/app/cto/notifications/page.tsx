import React from "react";
import Link from "next/link";
import { NotificationsList } from "@/features/notifications/components/NotificationsList";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Notifications | CTO Portal",
};

export default function CtoNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official announcements, system notifications, and battalion status alerts.
          </p>
        </div>
        <Link href="/cto">
          <Button variant="outline" size="sm">
            &larr; Back to Dashboard
          </Button>
        </Link>
      </div>

      <NotificationsList portalRole="cto" />
    </div>
  );
}
