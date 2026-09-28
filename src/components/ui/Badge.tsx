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
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  primary:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  danger:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
  outline:
    "bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
  army: "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  navy: "bg-indigo-100/70 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800",
  air: "bg-sky-100/70 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 border-sky-300 dark:border-sky-800",
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
