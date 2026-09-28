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
  let totalCategories = 0;
  let totalFields = 0;
  let recentCadets: CadetRecord[] = [];

  try {
    const [
      totalCadetsSnap,
      activeCadetsSnap,
      categoriesSnap,
      fieldsSnap,
      recentCadetsSnap,
    ] = await Promise.all([
      adminDb.collection("cadets").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").count().get(),
      adminDb.collection("categories").count().get(),
      adminDb.collection("fields").count().get(),
      adminDb.collection("cadets").limit(5).get(),
    ]);

    totalCadets = totalCadetsSnap.data().count;
    activeCadets = activeCadetsSnap.data().count;
    inactiveCadets = Math.max(0, totalCadets - activeCadets);
    totalCategories = categoriesSnap.data().count;
    totalFields = fieldsSnap.data().count;

    recentCadets = recentCadetsSnap.docs.map((doc) => doc.data() as CadetRecord);
  } catch (error) {
    console.error("Error fetching dashboard statistics from Firestore:", error);
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-slate-200 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Admin Operations Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Jai Hind, Administrator
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
            Logged in as <span className="font-semibold text-white">{session?.email}</span>. System overview for NCC Integrated Software. Manage master cadet records, dynamic profile definitions, and security policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/cadets"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition shadow-sm cursor-pointer"
          >
            Cadets Directory &rarr;
          </Link>
          <Link
            href="/admin/data-structure"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 font-medium text-xs sm:text-sm hover:bg-white/20 transition cursor-pointer"
          >
            Data Structure
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Cadets
              </span>
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalCadets}
              </span>
              <p className="text-xs text-slate-500 mt-1">Master enrolled profiles</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Accounts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Accounts
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
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
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Inactive / Suspended
              </span>
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
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
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Data Model
              </span>
              <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zm0 5h16" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                {totalCategories} / {totalFields}
              </span>
              <p className="text-xs text-slate-500 mt-1">Categories / Dynamic Fields</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/cadets" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Manage Cadets &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Cadets Directory</CardTitle>
              <CardDescription>
                Search, filter, and review cadet master records across Army, Navy, and Air Wings with direct field editing privileges.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/data-structure" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Configure Schema &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Data Structure Management</CardTitle>
              <CardDescription>
                Define categories, dynamic profile fields, validation constraints, and granular visibility rules for Cadet and CTO portals.
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
              Showing the latest enrolled master cadet records in the system.
            </CardDescription>
          </div>
          <Link
            href="/admin/cadets"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-4"
          >
            View all {totalCadets} cadets &rarr;
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {recentCadets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No cadet records found in the database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Cadet ID</th>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Enrollment No</th>
                    <th className="px-6 py-3.5">Rank &amp; Wing</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Completion</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {recentCadets.map((cadet) => {
                    const wingVariant =
                      cadet.wing === "Army"
                        ? "army"
                        : cadet.wing === "Navy"
                        ? "navy"
                        : "air";
                    const statusVariant =
                      cadet.status === "active"
                        ? "success"
                        : cadet.status === "suspended"
                        ? "danger"
                        : "warning";

                    return (
                      <tr
                        key={cadet.cadetId}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900 dark:text-slate-100">
                          {cadet.cadetId}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                          {cadet.fullName}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {cadet.enrollmentNo || "Pending"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{cadet.rank}</span>
                            <Badge variant={wingVariant} size="sm">
                              {cadet.wing}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant} size="sm">
                            {cadet.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
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
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
