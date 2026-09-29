"use client";

import React from "react";
import { SidebarShell, NavSectionConfig } from "./SidebarShell";
import {
  ChangeRequestsIcon,
  DashboardIcon,
  DataRequestsIcon,
  NotificationsIcon,
  ProfileIcon,
  SecurityIcon,
} from "./icons";

interface CadetSidebarProps {
  userEmail: string;
  cadetName?: string;
}

const cadetSections: NavSectionConfig[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/cadet",
        label: "Dashboard",
        exact: true,
        icon: DashboardIcon,
      },
    ],
  },
  {
    title: "My Records",
    items: [
      {
        href: "/cadet/profile",
        label: "My Profile",
        exact: false,
        icon: ProfileIcon,
      },
      {
        href: "/cadet/change-requests",
        label: "Change Requests",
        exact: false,
        icon: ChangeRequestsIcon,
      },
      {
        href: "/cadet/data-requests",
        label: "Data Requests",
        exact: false,
        icon: DataRequestsIcon,
      },
    ],
  },
  {
    title: "Communication & Security",
    items: [
      {
        href: "/cadet/notifications",
        label: "Notifications",
        exact: false,
        icon: NotificationsIcon,
        isNotification: true,
      },
      {
        href: "/cadet/security",
        label: "Security Settings",
        exact: false,
        icon: SecurityIcon,
      },
    ],
  },
];

export function CadetSidebar({ userEmail, cadetName }: CadetSidebarProps) {
  return (
    <SidebarShell
      brand={{
        badgeText: "NCC",
        badgeBg: "bg-blue-600 text-white",
        title: "Cadet Portal",
        subtitle: "Unity & Discipline",
        href: "/cadet",
      }}
      sections={cadetSections}
      user={{
        email: userEmail,
        name: cadetName,
        role: "Cadet",
        roleBadgeClass: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300",
        avatarBg: "bg-blue-600",
      }}
      themeColor="blue"
      notificationsHref="/cadet/notifications"
    />
  );
}
