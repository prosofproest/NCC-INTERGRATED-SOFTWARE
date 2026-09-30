import React from "react";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "outline"
  | "air";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-black/[0.05] text-[#1D1D1F] border-black/[0.06]",
  primary:
    "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20",
  success:
    "bg-[#34C759]/10 text-[#248A3D] border-[#34C759]/25",
  warning:
    "bg-[#FF9500]/10 text-[#B25000] border-[#FF9500]/25",
  danger:
    "bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/25",
  outline:
    "bg-transparent text-[#6E6E73] border-black/10",
  air: "bg-sky-500/10 text-sky-800 border-sky-500/25",
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
