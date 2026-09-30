"use client";

import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthStyles = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} bg-white/85 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-apple-modal overflow-hidden z-10 my-8 flex flex-col max-h-[90vh]`}
      >
        <div className="p-6 border-b border-black/[0.05] flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
              {title}
            </h2>
            {description && (
              <p className="text-xs sm:text-sm text-[#6E6E73] mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-full hover:bg-black/[0.05] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
