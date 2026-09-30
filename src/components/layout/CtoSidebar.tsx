"use client";

import React from "react";
import { SidebarShell, NavSectionConfig } from "./SidebarShell";
import {
  CadetsIcon,
  DashboardIcon,
  DataRequestsIcon,
  NotificationsIcon,
  ReportsIcon,
  SecurityIcon,
} from "./icons";

interface CtoSidebarProps {
  userEmail: string;
}

const ctoSections: NavSectionConfig[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/cto",
        label: "Dashboard",
        exact: true,
        icon: DashboardIcon,
      },
    ],
  },
  {
    title: "Cadet Management",
    items: [
      {
        href: "/cto/cadets",
        label: "Cadets Directory",
        exact: false,
        icon: CadetsIcon,
      },
      {
        href: "/cto/data-requests",
        label: "Data Requests",
        exact: false,
        icon: DataRequestsIcon,
      },
      {
        href: "/cto/reports",
        label: "Reports & Export",
        exact: false,
        icon: ReportsIcon,
      },
    ],
  },
  {
    title: "System & Security",
    items: [
      {
        href: "/cto/notifications",
        label: "Notifications",
        exact: false,
        icon: NotificationsIcon,
        isNotification: true,
      },
      {
        href: "/cto/security",
        label: "Security",
        exact: false,
        icon: SecurityIcon,
      },
    ],
  },
];

export function CtoSidebar({ userEmail }: CtoSidebarProps) {
  return (
    <SidebarShell
      brand={{
        badgeText: "CTO",
        badgeBg: "bg-amber-600 text-white",
        title: "Officer Portal",
        subtitle: "NCC Integrated System",
        href: "/cto",
      }}
      sections={ctoSections}
      user={{
        email: userEmail,
        role: "CTO Officer",
        roleBadgeClass: "bg-amber-500/10 text-amber-700",
        avatarBg: "bg-amber-600",
      }}
      themeColor="amber"
      notificationsHref="/cto/notifications"
    />
  );
}
