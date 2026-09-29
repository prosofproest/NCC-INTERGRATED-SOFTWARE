"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloseIcon, LogoutIcon, MenuIcon, NotificationsIcon } from "./icons";

export interface NavItemConfig {
  href: string;
  label: string;
  exact?: boolean;
  icon: (props: { className?: string }) => React.ReactNode;
  isNotification?: boolean;
}

export interface NavSectionConfig {
  title?: string;
  items: NavItemConfig[];
}

export interface SidebarShellProps {
  brand: {
    badgeText: string;
    badgeBg: string;
    title: string;
    subtitle: string;
    href: string;
  };
  sections: NavSectionConfig[];
  user: {
    email: string;
    name?: string;
    role: string;
    roleBadgeClass: string;
    avatarBg: string;
  };
  themeColor: "slate" | "amber" | "blue";
  notificationsHref: string;
}

export function SidebarShell({
  brand,
  sections,
  user,
  themeColor,
  notificationsHref,
}: SidebarShellProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Close mobile drawer on route change (render-time state adjustment per React 19)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    if (isMobileOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  // Polling unread notifications count
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
        // Silently catch background errors
      }
    }

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  const isActive = (item: NavItemConfig) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const getActiveItemClasses = () => {
    switch (themeColor) {
      case "amber":
        return "bg-amber-600 text-white shadow-xs font-semibold";
      case "blue":
        return "bg-blue-600 text-white shadow-xs font-semibold";
      case "slate":
      default:
        return "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold";
    }
  };

  const getInactiveItemClasses = () => {
    return "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium";
  };

  // Reusable Nav Content
  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-4 pb-3 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
        <Link href={brand.href} className="flex items-center gap-3 group">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105 ${brand.badgeBg}`}
          >
            {brand.badgeText}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white transition">
              {brand.title}
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
              {brand.subtitle}
            </span>
          </div>
        </Link>
        <div className="flex items-center" title="System Online">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Sidebar Navigation">
        {sections.map((section, idx) => (
          <div key={section.title || `section-${idx}`} className="space-y-1">
            {section.title && (
              <div className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm transition-all group ${
                    active ? getActiveItemClasses() : getInactiveItemClasses()
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      active
                        ? "text-inherit"
                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                    }`}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.isNotification && unreadCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 min-w-[18px] text-[10px] font-bold rounded-full transition-colors ${
                        active
                          ? themeColor === "slate"
                            ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                            : "bg-white/25 text-white"
                          : "bg-rose-500 text-white"
                      }`}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom User Card & Sign Out */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${user.avatarBg}`}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {user.name || user.email}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${user.roleBadgeClass}`}
              >
                {user.role}
              </span>
              {user.name && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[110px]">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/api/auth/logout"
          className="mt-2.5 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/40 transition cursor-pointer"
        >
          <LogoutIcon className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* ========================================================= */}
      {/* Desktop Persistent Sidebar (Apple-inspired macOS style)   */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-screen sticky top-0 z-30 select-none">
        {renderNavContent()}
      </aside>

      {/* ========================================================= */}
      {/* Mobile Top Header (Sticky Bar)                            */}
      {/* ========================================================= */}
      <div className="md:hidden sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Open Navigation Menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <Link href={brand.href} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] tracking-wider shadow-xs ${brand.badgeBg}`}
            >
              {brand.badgeText}
            </div>
            <span className="font-semibold text-xs tracking-tight text-slate-900 dark:text-white">
              {brand.title}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Notifications Button */}
          <Link
            href={notificationsHref}
            className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Notifications"
          >
            <NotificationsIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-600 rounded-full shadow-xs animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* User Initial Badge */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-white shadow-xs ${user.avatarBg}`}
            title={`${user.email} (${user.role})`}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Mobile Slide-Out Drawer (with Backdrop Blur Overlay)      */}
      {/* ========================================================= */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {/* Drawer Close Button */}
            <div className="absolute top-3.5 right-3 z-10">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close Navigation Menu"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Inner Content */}
            <div className="h-full flex flex-col">{renderNavContent()}</div>
          </div>
        </div>
      )}
    </>
  );
}
