import React from "react";
import Link from "next/link";
import { NotificationsList } from "@/features/notifications/components/NotificationsList";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Notifications | Cadet Portal",
};

export default function CadetNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            System announcements, change request status updates, document reviews, and squadron alerts.
          </p>
        </div>
        <Link href="/cadet">
          <Button variant="outline" size="sm">
            &larr; Back to Dashboard
          </Button>
        </Link>
      </div>

      <NotificationsList portalRole="cadet" />
    </div>
  );
}
