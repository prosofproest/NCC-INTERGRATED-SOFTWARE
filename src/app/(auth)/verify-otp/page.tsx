"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") || "";

  const [customEmail, setCustomEmail] = useState("");
  const email = emailParam || customEmail;
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Verification failed.");
      }

      setSuccessMessage("OTP verified successfully! Redirecting...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to verify OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setErrorMessage("Please specify your email address first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setResending(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        throw new Error(data.error || "Failed to send OTP.");
      }

      setSuccessMessage("A fresh One-Time Passcode has been dispatched to your email.");
      setCooldown(60);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7] overflow-hidden selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-[#0071E3]/20 via-sky-300/15 to-purple-300/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] rounded-full bg-gradient-to-br from-indigo-300/15 via-blue-400/20 to-sky-200/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 backdrop-blur-2xl bg-white/75 border border-white/80 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-black/[0.04] text-[#6E6E73] uppercase">
            Security Verification
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Enter Verification Code
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
            Enter the 6-digit passcode sent to your registered email
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#D70015] text-xs font-medium backdrop-blur-md">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#248A3D] text-xs font-medium">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          {!emailParam && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#1D1D1F]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="cadet@domain.com"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white/80 text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F] text-center">
              6-Digit One-Time Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 rounded-xl border border-black/[0.08] bg-white/80 text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium text-sm transition-all duration-150 shadow-sm shadow-[#0071E3]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
          >
            {loading ? "Verifying..." : "Verify Passcode"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-black/[0.05]">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="text-[#0071E3] hover:text-[#0077ED] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
          </button>
          <Link
            href="/login"
            className="text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
