import React from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "outline"
  | "army"
  | "navy"
  | "air";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-black/[0.05] text-[#1D1D1F] dark:bg-white/[0.1] dark:text-[#F5F5F7] border-black/[0.06] dark:border-white/[0.1]",
  primary:
    "bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-[#0A84FF] border-[#0071E3]/20",
  success:
    "bg-[#34C759]/10 text-[#248A3D] dark:bg-[#30D158]/20 dark:text-[#30D158] border-[#34C759]/25",
  warning:
    "bg-[#FF9500]/10 text-[#B25000] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A] border-[#FF9500]/25",
  danger:
    "bg-[#FF3B30]/10 text-[#D70015] dark:bg-[#FF453A]/20 dark:text-[#FF453A] border-[#FF3B30]/25",
  outline:
    "bg-transparent text-[#6E6E73] dark:text-[#86868B] border-black/10 dark:border-white/15",
  army: "bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/25",
  navy: "bg-blue-500/10 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/25",
  air: "bg-sky-500/10 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/25",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  const sizeClasses =
    size === "sm" ? "text-xs px-2.5 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-wide transition-colors ${sizeClasses} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
