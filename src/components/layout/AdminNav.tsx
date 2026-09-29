"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBadge } from "@/features/notifications/components/NotificationBadge";

interface AdminNavProps {
  userEmail: string;
}

const navItems = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/cadets", label: "Cadets", exact: false },
  { href: "/admin/cto-management", label: "CTO Management", exact: false },
  { href: "/admin/data-structure", label: "Data Structure", exact: false },
  { href: "/admin/data-requests", label: "Data Requests", exact: false },
  { href: "/admin/change-requests", label: "Change Requests", exact: false },
  { href: "/admin/notifications", label: "Notifications", exact: false },
  { href: "/admin/import-export", label: "Import / Export", exact: false },
];

export function AdminNav({ userEmail }: AdminNavProps) {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand & Badge */}
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-bold text-xs tracking-wider shadow-xs">
                NCC
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  NCC Data Collection
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                  Integrated System
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-slate-800">
              {navItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      active
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-3">
            <NotificationBadge href="/admin/notifications" />

            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                {userEmail}
              </span>
              <span className="font-semibold text-[10px] uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>

            <Link
              href="/api/auth/logout"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-200 dark:hover:border-rose-900/30 transition cursor-pointer"
            >
              Sign Out
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center gap-2 py-2 border-t border-slate-100 dark:border-slate-800/60 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
