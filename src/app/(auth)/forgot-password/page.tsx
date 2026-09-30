"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process request.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to submit password reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7] dark:bg-[#0A0D14] overflow-hidden selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Ambient Mesh Background */}
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-[#0071E3]/20 via-sky-300/15 to-purple-300/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] rounded-full bg-gradient-to-br from-indigo-300/15 via-blue-400/20 to-sky-200/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/80 border border-white/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-black/[0.04] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#86868B] uppercase">
            Account Recovery
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
            Reset Your Password
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-slate-400 leading-relaxed">
            Enter your registered email address and we will dispatch a secure reset link.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#D70015] dark:text-red-400 text-xs font-medium backdrop-blur-md">
            {errorMessage}
          </div>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] dark:text-[#0A84FF] text-xs leading-relaxed font-medium">
              If an account is associated with <strong>{email}</strong>, a password reset link has been dispatched to your inbox. Please check your email and follow the instructions.
            </div>
            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-block py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm transition shadow-sm w-full text-center"
              >
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#1D1D1F] dark:text-slate-200">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@organization.org"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white/80 dark:bg-slate-800/60 text-[#1D1D1F] dark:text-white placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium text-sm transition-all duration-150 shadow-sm shadow-[#0071E3]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
            >
              {loading ? "Sending Reset Link..." : "Send Reset Link"}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-xs font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors"
              >
                Remembered your password? Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
