"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // 1. Authenticate with Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await userCredential.user.getIdToken();

      // 2. Exchange ID token for server-side verified HTTP-only session cookie & role check
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Role unassigned.");
      }

      // 3. Server dictates redirect target (never client chosen)
      window.location.href = data.redirectTo || "/login";
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setErrorMessage("Invalid email or password. Please verify your credentials.");
      } else if (error.code === "auth/too-many-requests") {
        setErrorMessage("Access to this account has been temporarily disabled due to many failed login attempts. Try again later.");
      } else {
        setErrorMessage(error.message || "An unexpected error occurred during login.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7] dark:bg-[#0A0D14] overflow-hidden selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Apple Ambient Mesh Radiant Background Orbs */}
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-[#0071E3]/20 via-sky-300/15 to-purple-300/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] rounded-full bg-gradient-to-br from-indigo-300/15 via-blue-400/20 to-sky-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[46rem] rounded-full bg-gradient-to-r from-blue-100/35 via-white/50 to-indigo-100/35 blur-[120px] pointer-events-none" />

      {/* Floating Frosted Glass Login Panel */}
      <div className="w-full max-w-[420px] relative z-10 backdrop-blur-2xl bg-white/75 dark:bg-slate-900/80 border border-white/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.02)] space-y-7">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#1D1D1F] to-[#2C2C2E] dark:from-white dark:to-slate-200 text-white dark:text-slate-950 flex items-center justify-center font-bold text-sm tracking-wider shadow-md shadow-black/10 mx-auto">
            NCC
          </div>
          <div className="pt-2">
            <span className="text-[11px] font-semibold tracking-widest text-[#86868B] uppercase">
              National Cadet Corps
            </span>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-white mt-0.5">
              Unified Portal
            </h1>
            <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Sign in with your authorized credentials to access system records
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#D70015] dark:text-red-400 text-xs font-medium backdrop-blur-md flex items-start gap-2.5 animate-in fade-in duration-200">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-[#D70015]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F] dark:text-slate-200">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@organization.org or cadet@domain.com"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white/80 dark:bg-slate-800/60 text-[#1D1D1F] dark:text-white placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#1D1D1F] dark:text-slate-200">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white/80 dark:bg-slate-800/60 text-[#1D1D1F] dark:text-white placeholder-[#86868B] text-sm focus:outline-none focus:ring-4 focus:ring-[#0071E3]/15 focus:border-[#0071E3] transition-all duration-200 shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium text-sm transition-all duration-150 shadow-sm shadow-[#0071E3]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Security / System Footer Note */}
        <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.06] text-center">
          <p className="text-[11px] text-[#86868B] leading-normal">
            Protected National Cadet Corps Integrated System. All access sessions are logged and cryptographically audited.
          </p>
        </div>
      </div>
    </div>
  );
}
