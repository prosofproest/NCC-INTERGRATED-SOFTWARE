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
        badgeBg: "bg-[#0071E3] text-white",
        title: "Cadet Portal",
        subtitle: "Unity & Discipline",
        href: "/cadet",
      }}
      sections={cadetSections}
      user={{
        email: userEmail,
        name: cadetName,
        role: "Cadet",
        roleBadgeClass: "bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-[#0A84FF]",
        avatarBg: "bg-[#0071E3]",
      }}
      themeColor="blue"
      notificationsHref="/cadet/notifications"
    />
  );
}
