import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0071E3] text-white hover:bg-[#0077ED] active:scale-[0.98] shadow-sm font-medium",
  secondary:
    "bg-black/[0.05] text-[#1D1D1F] hover:bg-black/[0.08] dark:bg-white/[0.1] dark:text-[#F5F5F7] dark:hover:bg-white/[0.15] active:scale-[0.98]",
  danger:
    "bg-[#FF3B30] text-white hover:bg-[#D70015] active:scale-[0.98] shadow-sm font-medium",
  ghost:
    "bg-transparent text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] dark:text-[#86868B] dark:hover:text-white dark:hover:bg-white/[0.06] active:scale-[0.98]",
  outline:
    "bg-white/60 dark:bg-black/20 backdrop-blur-md text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.08] dark:border-white/[0.1] hover:bg-white/90 dark:hover:bg-white/10 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-xl font-medium",
  lg: "text-base px-5 py-2.5 rounded-2xl font-medium",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
