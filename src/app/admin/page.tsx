import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();

  // 1. Fetch real counts directly from Firestore
  let totalCadets = 0;
  let activeCadets = 0;
  let inactiveCadets = 0;
  let totalCtos = 0;
  let totalCategories = 0;
  let totalFields = 0;
  let pendingChangeRequests = 0;
  let firstYearCount = 0;
  let secondYearCount = 0;
  let thirdYearCount = 0;
  let sdCount = 0;
  let swCount = 0;
  let recentCadets: CadetRecord[] = [];

  try {
    const [
      totalCadetsSnap,
      activeCadetsSnap,
      ctosSnap,
      categoriesSnap,
      fieldsSnap,
      pendingChangeRequestsSnap,
      recentCadetsSnap,
      firstYearSnap,
      secondYearSnap,
      thirdYearSnap,
      sdSnap,
      swSnap,
    ] = await Promise.all([
      adminDb.collection("cadets").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").count().get(),
      adminDb.collection("users").where("role", "==", "cto").count().get(),
      adminDb.collection("categories").count().get(),
      adminDb.collection("fields").count().get(),
      adminDb.collection("change_requests").where("status", "==", "pending").count().get(),
      adminDb.collection("cadets").limit(5).get(),
      adminDb.collection("cadets").where("trainingYear", "==", "1st Year").count().get(),
      adminDb.collection("cadets").where("trainingYear", "==", "2nd Year").count().get(),
      adminDb.collection("cadets").where("trainingYear", "==", "3rd Year").count().get(),
      adminDb.collection("cadets").where("division", "==", "SD").count().get(),
      adminDb.collection("cadets").where("division", "==", "SW").count().get(),
    ]);

    totalCadets = totalCadetsSnap.data().count;
    activeCadets = activeCadetsSnap.data().count;
    inactiveCadets = Math.max(0, totalCadets - activeCadets);
    totalCtos = ctosSnap.data().count;
    totalCategories = categoriesSnap.data().count;
    totalFields = fieldsSnap.data().count;
    pendingChangeRequests = pendingChangeRequestsSnap.data().count;
    firstYearCount = firstYearSnap.data().count;
    secondYearCount = secondYearSnap.data().count;
    thirdYearCount = thirdYearSnap.data().count;
    sdCount = sdSnap.data().count;
    swCount = swSnap.data().count;

    recentCadets = recentCadetsSnap.docs.map((doc) => doc.data() as CadetRecord);
  } catch (error) {
    console.error("Error fetching dashboard statistics from Firestore:", error);
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 backdrop-blur-2xl bg-white/80 border border-black/[0.06] shadow-apple-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        {/* Soft background ambient radial highlight */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-[#0071E3]/10 to-indigo-300/10 blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
            <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.5)] animate-pulse" />
            Admin Operations Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Jai Hind, Administrator
          </h1>
          <p className="text-[#6E6E73] text-xs sm:text-sm max-w-xl leading-relaxed">
            Logged in as <span className="font-medium text-[#1D1D1F]">{session?.email}</span>. System overview for NCC Integrated Software. Manage master cadet records, dynamic profile definitions, and security policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <Link
            href="/admin/cadets"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#0071E3] text-white font-medium text-xs sm:text-sm hover:bg-[#0077ED] transition shadow-sm cursor-pointer"
          >
            Cadets Directory &rarr;
          </Link>
          <Link
            href="/admin/data-structure"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Data Structure
          </Link>
          <Link
            href="/admin/data-requests"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Data Requests
          </Link>
          <Link
            href="/admin/change-requests"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            <span>Change Requests</span>
            {pendingChangeRequests > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF9500] text-white">
                {pendingChangeRequests}
              </span>
            )}
          </Link>
          <Link
            href="/admin/cto-management"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            CTO Officers
          </Link>
          <Link
            href="/admin/import-export"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Import / Export
          </Link>
          <Link
            href="/admin/audit-logs"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Audit Logs
          </Link>
          <Link
            href="/admin/system-health"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            System Health
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Cadets
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {totalCadets}
              </span>
              <p className="text-xs text-slate-500 mt-1">Master enrolled profiles</p>
            </div>
          </CardContent>
        </Card>

        {/* CTO Officers */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                CTO Officers
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-amber-600">
                {totalCtos}
              </span>
              <p className="text-xs text-slate-500 mt-1">Care Taker Officers</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Accounts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Accounts
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-emerald-600">
                {activeCadets}
              </span>
              <p className="text-xs text-slate-500 mt-1">Verified and operational</p>
            </div>
          </CardContent>
        </Card>

        {/* Inactive / Suspended Accounts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inactive / Suspended
              </span>
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-rose-600">
                {inactiveCadets}
              </span>
              <p className="text-xs text-slate-500 mt-1">Deactivated or locked</p>
            </div>
          </CardContent>
        </Card>

        {/* Configured Data Model */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Data Model
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zm0 5h16" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-purple-600">
                {totalCategories} / {totalFields}
              </span>
              <p className="text-xs text-slate-500 mt-1">Categories / Dynamic Fields</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regimental Breakdown Grid: Training Year & Division (Air Wing Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Year Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Air Wing Cadets by Training Year</CardTitle>
                <CardDescription className="text-xs">
                  Cadet strength segregated by progressive training syllabus.
                </CardDescription>
              </div>
              <Badge variant="air" size="sm">
                Air Wing Unit
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/60">
                <span className="text-[11px] font-semibold uppercase text-sky-800 tracking-wider">
                  1st Year
                </span>
                <div className="text-2xl font-bold text-sky-950 mt-1">
                  {firstYearCount}
                </div>
                <p className="text-[10px] text-sky-700/80 mt-0.5">Fresh Entrants</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/60">
                <span className="text-[11px] font-semibold uppercase text-indigo-800 tracking-wider">
                  2nd Year
                </span>
                <div className="text-2xl font-bold text-indigo-950 mt-1">
                  {secondYearCount}
                </div>
                <p className="text-[10px] text-indigo-700/80 mt-0.5">Intermediate</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/60">
                <span className="text-[11px] font-semibold uppercase text-purple-800 tracking-wider">
                  3rd Year
                </span>
                <div className="text-2xl font-bold text-purple-950 mt-1">
                  {thirdYearCount}
                </div>
                <p className="text-[10px] text-purple-700/80 mt-0.5">Senior Cadets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Division Breakdown (SD / SW) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Cadets by NCC Division</CardTitle>
                <CardDescription className="text-xs">
                  Segregation across Senior Division (SD) and Senior Wing (SW).
                </CardDescription>
              </div>
              <Badge variant="outline" size="sm">
                SD / SW
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase text-slate-700 tracking-wider">
                  <span>Senior Division (SD)</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {sdCount}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Male Cadets</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase text-slate-700 tracking-wider">
                  <span>Senior Wing (SW)</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {swCount}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Female Cadets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/cadets" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-xs text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                  Manage Cadets &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Cadets Directory</CardTitle>
              <CardDescription>
                Search, filter, and edit enrolled Air Wing cadets by training year, division (SD/SW), and account status.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/data-structure" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-xs text-purple-600 font-semibold group-hover:translate-x-1 transition-transform">
                  Configure Schema &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Data Structure</CardTitle>
              <CardDescription>
                Create and manage categories, dynamic custom fields, and access permissions for Cadet and CTO portals.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/change-requests" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5">
                  {pendingChangeRequests > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-900">
                      {pendingChangeRequests} Pending
                    </span>
                  )}
                  <span className="text-xs text-amber-600 font-semibold group-hover:translate-x-1 transition-transform">
                    Review &rarr;
                  </span>
                </div>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Change Requests</CardTitle>
              <CardDescription>
                Review and approve cadet requests to update protected profile information with full audit tracking.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Cadets Preview */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Recent Cadets Overview</CardTitle>
            <CardDescription>
              Showing the latest enrolled Air Wing cadet records in your squadron.
            </CardDescription>
          </div>
          {totalCadets > 0 && (
            <Link
              href="/admin/cadets"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4"
            >
              View all {totalCadets} cadets &rarr;
            </Link>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {recentCadets.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No Cadets Enrolled Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Get started by importing your Air Wing squadron cadets using the standardized Excel template with Year and Division tagging.
                </p>
              </div>
              <Link href="/admin/import-export">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition shadow-xs cursor-pointer"
                >
                  Import Your First Cadets &rarr;
                </button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Cadet ID</th>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Enrollment No</th>
                    <th className="px-6 py-3.5">Year &amp; Div</th>
                    <th className="px-6 py-3.5">Rank</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Completion</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentCadets.map((cadet) => {
                    const statusVariant =
                      cadet.status === "active"
                        ? "success"
                        : cadet.status === "suspended"
                        ? "danger"
                        : "warning";

                    return (
                      <tr
                        key={cadet.cadetId}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900">
                          {cadet.cadetId}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {cadet.fullName}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {cadet.enrollmentNo || "Pending"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" size="sm">
                              {cadet.trainingYear || "1st Year"}
                            </Badge>
                            <Badge variant="outline" size="sm">
                              {cadet.division || "SD"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700">
                          {cadet.rank}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant} size="sm">
                            {cadet.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${cadet.completionPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-500">
                              {cadet.completionPercentage || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/cadets/${cadet.cadetId}`}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
