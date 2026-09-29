"use client";

import React from "react";
import { SidebarShell, NavSectionConfig } from "./SidebarShell";
import {
  AuditLogsIcon,
  CadetsIcon,
  ChangeRequestsIcon,
  CtoIcon,
  DashboardIcon,
  DataRequestsIcon,
  DataStructureIcon,
  ImportExportIcon,
  NotificationsIcon,
  SystemHealthIcon,
} from "./icons";

interface AdminSidebarProps {
  userEmail: string;
}

const adminSections: NavSectionConfig[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        exact: true,
        icon: DashboardIcon,
      },
    ],
  },
  {
    title: "Personnel",
    items: [
      {
        href: "/admin/cadets",
        label: "Cadets Directory",
        exact: false,
        icon: CadetsIcon,
      },
      {
        href: "/admin/cto-management",
        label: "CTO Officers",
        exact: false,
        icon: CtoIcon,
      },
    ],
  },
  {
    title: "Data Operations",
    items: [
      {
        href: "/admin/data-structure",
        label: "Data Structure",
        exact: false,
        icon: DataStructureIcon,
      },
      {
        href: "/admin/data-requests",
        label: "Data Requests",
        exact: false,
        icon: DataRequestsIcon,
      },
      {
        href: "/admin/change-requests",
        label: "Change Requests",
        exact: false,
        icon: ChangeRequestsIcon,
      },
      {
        href: "/admin/import-export",
        label: "Import / Export",
        exact: false,
        icon: ImportExportIcon,
      },
    ],
  },
  {
    title: "System & Governance",
    items: [
      {
        href: "/admin/notifications",
        label: "Notifications",
        exact: false,
        icon: NotificationsIcon,
        isNotification: true,
      },
      {
        href: "/admin/audit-logs",
        label: "Audit Logs",
        exact: false,
        icon: AuditLogsIcon,
      },
      {
        href: "/admin/system-health",
        label: "System Health",
        exact: false,
        icon: SystemHealthIcon,
      },
    ],
  },
];

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  return (
    <SidebarShell
      brand={{
        badgeText: "NCC",
        badgeBg: "bg-slate-900 dark:bg-white text-white dark:text-slate-900",
        title: "NCC Admin",
        subtitle: "Integrated System",
        href: "/admin",
      }}
      sections={adminSections}
      user={{
        email: userEmail,
        role: "Admin",
        roleBadgeClass: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
        avatarBg: "bg-slate-900 dark:bg-slate-700",
      }}
      themeColor="slate"
      notificationsHref="/admin/notifications"
    />
  );
}
