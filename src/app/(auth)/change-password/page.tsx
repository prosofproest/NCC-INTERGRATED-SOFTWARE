"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters in length.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update password.");
      }

      window.location.href = data.redirectTo || "/login";
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7] overflow-hidden selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-[#0071E3]/20 via-sky-300/15 to-purple-300/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] rounded-full bg-gradient-to-br from-indigo-300/15 via-blue-400/20 to-sky-200/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 backdrop-blur-2xl bg-white/75 border border-white/80 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-amber-500/10 border border-amber-500/20 text-[#B25000] uppercase">
            Security Requirement
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Set Your Permanent Password
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
            You are logged in with a temporary password. For account protection, you must establish a permanent password before proceeding.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#D70015] text-xs font-medium backdrop-blur-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F]">
              New Permanent Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white/80 text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F]">
              Confirm Permanent Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white/80 text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium text-sm transition-all duration-150 shadow-sm shadow-[#0071E3]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
          >
            {loading ? "Updating Password..." : "Update Password & Continue"}
          </button>
        </form>

        <div className="pt-2 border-t border-black/[0.05] text-center">
          <button
            type="button"
            onClick={() => router.push("/api/auth/logout")}
            className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
          >
            Cancel and Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
