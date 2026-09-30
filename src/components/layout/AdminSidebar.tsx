"use client";

import React from "react";
import { SidebarShell, NavSectionConfig } from "./SidebarShell";
import {
  AuditLogsIcon,
  BackupsIcon,
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
      {
        href: "/admin/backups",
        label: "Backups & Recovery",
        exact: false,
        icon: BackupsIcon,
      },
    ],
  },
];

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  return (
    <SidebarShell
      brand={{
        badgeText: "NCC",
        badgeBg: "bg-[#0071E3] text-white",
        title: "NCC Admin",
        subtitle: "Integrated System",
        href: "/admin",
      }}
      sections={adminSections}
      user={{
        email: userEmail,
        role: "Admin",
        roleBadgeClass: "bg-[#0071E3]/10 text-[#0071E3]",
        avatarBg: "bg-[#0071E3]",
      }}
      themeColor="slate"
      notificationsHref="/admin/notifications"
    />
  );
}
