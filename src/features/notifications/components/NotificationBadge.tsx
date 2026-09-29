"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NotificationBadgeProps {
  href: string;
}

export function NotificationBadge({ href }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (res.ok && isMounted) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // Ignore background fetch errors
      }
    }

    loadUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  return (
    <Link
      href={href}
      className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      title="Notifications"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full shadow-xs animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
