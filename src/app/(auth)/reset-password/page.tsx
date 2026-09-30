"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!oobCode) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7] overflow-hidden selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
        <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-[#0071E3]/20 via-sky-300/15 to-purple-300/10 blur-[100px] pointer-events-none" />
        <div className="w-full max-w-[420px] relative z-10 backdrop-blur-2xl bg-white/75 border border-white/80 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-4 text-center">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#B25000] text-xs font-medium">
            Invalid or missing password reset link.
          </div>
          <p className="text-xs text-[#86868B]">
            Please request a fresh reset link from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm transition shadow-sm w-full"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters in length.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, newPassword);

      // Notify server to clear mustChangePassword in Firestore so cadet lands directly on dashboard
      try {
        await fetch("/api/auth/reset-password/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch (syncErr) {
        console.warn("Could not notify server of password reset completion:", syncErr);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/invalid-action-code") {
        setErrorMessage("The password reset link has expired or has already been used.");
      } else {
        setErrorMessage(error.message || "Failed to reset password.");
      }
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
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-black/[0.04] text-[#6E6E73] uppercase">
            Account Recovery
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Create New Password
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
            Enter and confirm your new permanent password
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#D70015] text-xs font-medium backdrop-blur-md">
            {errorMessage}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#248A3D] text-xs font-medium">
              Your password has been successfully reset! Redirecting to login...
            </div>
            <Link
              href="/login"
              className="inline-block py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm transition shadow-sm w-full text-center"
            >
              Sign In Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#1D1D1F]">
                New Password
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
                Confirm New Password
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
              {loading ? "Resetting Password..." : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
