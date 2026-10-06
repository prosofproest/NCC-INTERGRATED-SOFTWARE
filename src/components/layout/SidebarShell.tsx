"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
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

  // Polling unread notifications count (on mount + periodic 60s + visibilitychange)
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
    const interval = setInterval(loadUnreadCount, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadUnreadCount();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const isActive = (item: NavItemConfig) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const getActiveItemClasses = () => {
    switch (themeColor) {
      case "amber":
        return "bg-amber-600 text-white shadow-xs font-medium";
      case "blue":
      case "slate":
      default:
        return "bg-[#0071E3] text-white shadow-xs font-medium";
    }
  };

  const getInactiveItemClasses = () => {
    return "text-[#48484A] hover:text-[#1D1D1F] hover:bg-black/[0.04] font-normal";
  };

  // Reusable Nav Content
  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-4 pb-3 border-b border-black/[0.05] flex items-center justify-between">
        <Link href={brand.href} className="flex items-center gap-3 group">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105 ${brand.badgeBg}`}
          >
            {brand.badgeText}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-[#1D1D1F] transition">
              {brand.title}
            </span>
            <span className="text-[10px] text-[#86868B] font-medium tracking-wide uppercase">
              {brand.subtitle}
            </span>
          </div>
        </Link>
        <div className="flex items-center" title="System Online">
          <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.5)] animate-pulse" />
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Sidebar Navigation">
        {sections.map((section, idx) => (
          <div key={section.title || `section-${idx}`} className="space-y-1">
            {section.title && (
              <div className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
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
                  className={`flex items-center gap-3 px-3 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm transition-all group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                    active ? getActiveItemClasses() : getInactiveItemClasses()
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      active
                        ? "text-inherit"
                        : "text-[#86868B] group-hover:text-[#1D1D1F]"
                    }`}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.isNotification && unreadCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 min-w-[18px] text-[10px] font-bold rounded-full transition-colors ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-[#FF3B30] text-white"
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
      <div className="p-3 border-t border-black/[0.05] bg-black/[0.015]">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${user.avatarBg}`}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#1D1D1F] truncate">
              {user.name || user.email}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${user.roleBadgeClass}`}
              >
                {user.role}
              </span>
              {user.name && (
                <span className="text-[10px] text-[#86868B] truncate max-w-[110px]">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } finally {
              router.push("/login");
              router.refresh();
            }
          }}
          className="mt-2.5 w-full min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-black/[0.06] text-xs font-medium text-[#48484A] hover:bg-red-500/10 hover:text-[#FF3B30] hover:border-red-500/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FF3B30] transition cursor-pointer"
        >
          <LogoutIcon className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ========================================================= */}
      {/* Desktop Persistent Sidebar (Apple-inspired macOS style)   */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-black/[0.06] bg-white/70 backdrop-blur-2xl h-screen sticky top-0 z-30 select-none">
        {renderNavContent()}
      </aside>

      {/* ========================================================= */}
      {/* Mobile Top Header (Sticky Bar)                            */}
      {/* ========================================================= */}
      <div className="md:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/[0.06] h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-xl text-[#1D1D1F] hover:bg-black/[0.05] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] transition"
            aria-label="Open Navigation Menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <Link href={brand.href} className="flex items-center gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] rounded-lg">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] tracking-wider shadow-xs ${brand.badgeBg}`}
            >
              {brand.badgeText}
            </div>
            <span className="font-semibold text-xs tracking-tight text-[#1D1D1F]">
              {brand.title}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Notifications Button */}
          <Link
            href={notificationsHref}
            className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#1D1D1F] hover:bg-black/[0.05] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] transition"
            aria-label="View notifications"
          >
            <NotificationsIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-[#FF3B30] rounded-full shadow-xs animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* User Initial Badge */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] text-white shadow-xs ${user.avatarBg}`}
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
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation Menu">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white/95 backdrop-blur-2xl border-r border-black/[0.06] shadow-apple-modal flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {/* Drawer Close Button */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] transition"
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
