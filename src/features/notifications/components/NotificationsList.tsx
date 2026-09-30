"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNotification } from "@/types/notifications";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface NotificationsListProps {
  portalRole?: "cadet" | "cto" | "admin";
}

export function NotificationsList({ portalRole }: NotificationsListProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setNotifications(data.notifications || []);
          }
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadNotifications();
    return () => {
      ignore = true;
    };
  }, [refreshKey, portalRole]);

  const handleMarkAsRead = async (notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      )
    );

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "important") return n.importance === "important";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              filter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              filter === "unread"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter("important")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              filter === "important"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Important
          </button>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="text-xs"
          >
            {markingAll ? "Marking..." : "Mark all as read"}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2" />
          <p>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {filter === "unread" ? "No Unread Notifications" : "No Notifications"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {filter === "unread"
              ? "You're all caught up! You have read all notifications."
              : "No notifications have been received yet."}
          </p>
          <div className="pt-3">
            {filter !== "all" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show All Notifications
              </Button>
            ) : (
              <Link href={portalRole === "admin" ? "/admin" : portalRole === "cto" ? "/cto" : "/cadet"}>
                <Button variant="outline" size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.isRead;
            const isImportant = notif.importance === "important";

            return (
              <div
                key={notif.notificationId}
                className={`p-4 rounded-xl border transition-all ${
                  isUnread
                    ? "bg-blue-50/40 border-blue-200 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                      )}

                      {isImportant && (
                        <Badge variant="warning" size="sm">
                          Important
                        </Badge>
                      )}

                      <h4 className={`text-sm font-semibold ${isUnread ? "text-slate-900" : "text-slate-800"}`}>
                        {notif.title}
                      </h4>

                      <span className="text-[11px] text-slate-400">
                        • {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
                      <span>From: <strong className="text-slate-600 font-medium">{notif.sender?.name || "System"}</strong></span>
                      {notif.sender?.role && (
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold tracking-wider">
                          {notif.sender.role}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {notif.link && (
                      <Link href={notif.link}>
                        <Button variant="outline" size="sm" className="text-xs">
                          View &rarr;
                        </Button>
                      </Link>
                    )}

                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.notificationId)}
                        className="text-xs text-slate-500 hover:text-slate-900"
                        title="Mark as read"
                      >
                        ✓
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
