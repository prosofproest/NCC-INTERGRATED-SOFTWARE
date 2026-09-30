import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CtoDashboardPage() {
  const session = await getSession();

  // CTO has authorized read access only to active/operational cadet records
  let activeCadetsCount = 0;
  let firstYearCount = 0;
  let secondYearCount = 0;
  let thirdYearCount = 0;
  let sdCount = 0;
  let swCount = 0;
  let recentCadets: CadetRecord[] = [];

  try {
    const [
      activeSnap,
      firstYearSnap,
      secondYearSnap,
      thirdYearSnap,
      sdSnap,
      swSnap,
      recentSnap,
    ] = await Promise.all([
      adminDb.collection("cadets").where("status", "==", "active").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("trainingYear", "==", "1st Year").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("trainingYear", "==", "2nd Year").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("trainingYear", "==", "3rd Year").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("division", "==", "SD").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("division", "==", "SW").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").limit(5).get(),
    ]);

    activeCadetsCount = activeSnap.data().count;
    firstYearCount = firstYearSnap.data().count;
    secondYearCount = secondYearSnap.data().count;
    thirdYearCount = thirdYearSnap.data().count;
    sdCount = sdSnap.data().count;
    swCount = swSnap.data().count;

    recentCadets = recentSnap.docs.map((d) => d.data() as CadetRecord);
  } catch (err) {
    console.error("Error loading CTO dashboard data:", err);
  }



  return (
    <div className="space-y-8">
      {/* Officer Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 backdrop-blur-2xl bg-white/80 border border-black/[0.06] shadow-apple-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-300/10 blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Caretaker Officer Session Active
          </div>
          {/* Section 29 Mandatory Greeting */}
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Jai Hind Sir 🇮🇳
          </h1>
          <p className="text-[#6E6E73] text-xs sm:text-sm max-w-xl leading-relaxed">
            Battalion Officer Portal. Browse enrolled Air Wing cadet profiles, inspect training year progress, and monitor squadron readiness metrics.
          </p>
          <div className="pt-1 text-xs text-[#86868B]">
            Authenticated Officer: <span className="text-[#1D1D1F] font-medium">{session?.email}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
          <Link
            href="/cto/cadets"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-600 text-white font-medium text-xs sm:text-sm hover:bg-amber-500 transition shadow-sm cursor-pointer"
          >
            Cadets Directory &rarr;
          </Link>
          <Link
            href="/cto/data-requests"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Data Requests
          </Link>
          <Link
            href="/cto/reports"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Reports
          </Link>
        </div>
      </div>

      {/* Authorized Metrics Grid: Training Year Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Active Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Cadets
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {activeCadetsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Operational Air Wing strength</p>
            </div>
          </CardContent>
        </Card>

        {/* 1st Year Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                1st Year
              </span>
              <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-sky-600">
                {firstYearCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Fresh entrant cadets</p>
            </div>
          </CardContent>
        </Card>

        {/* 2nd Year Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                2nd Year
              </span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-indigo-600">
                {secondYearCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Intermediate year cadets</p>
            </div>
          </CardContent>
        </Card>

        {/* 3rd Year Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                3rd Year
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-purple-600">
                {thirdYearCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Senior certificate cadets</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Division Breakdown (SD / SW) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Senior Division (SD)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Male cadets enrolled in squadron</p>
              </div>
              <Badge variant="outline" size="sm">
                SD
              </Badge>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {sdCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Senior Wing (SW)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Female cadets enrolled in squadron</p>
              </div>
              <Badge variant="outline" size="sm">
                SW
              </Badge>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {swCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/cto/cadets" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-amber-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <span className="text-xs text-amber-600 font-semibold group-hover:translate-x-1 transition-transform">
                  Search &amp; Filter &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Cadets Directory</CardTitle>
              <CardDescription>
                Search and inspect verified Air Wing cadet records filtered by training year and division.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/cto/data-requests" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-amber-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xs text-amber-600 font-semibold group-hover:translate-x-1 transition-transform">
                  Manage &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Data Requests</CardTitle>
              <CardDescription>
                Dispatch ad-hoc mandatory data collection batches to targeted cadet rosters. Ask only for what is missing.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/cto/reports" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-amber-400 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs text-amber-700 font-semibold group-hover:translate-x-1 transition-transform">
                  Export Reports &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Reports &amp; Excel Export</CardTitle>
              <CardDescription>
                Export filtered officer nominal rolls and attendance reports to formatted Excel spreadsheets.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Active Cadets Preview Snapshot */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Active Cadets Overview</CardTitle>
            <CardDescription>
              Snapshot of operational Air Wing cadet profiles currently enrolled in your unit.
            </CardDescription>
          </div>
          {activeCadetsCount > 0 && (
            <Link
              href="/cto/cadets"
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              View all {activeCadetsCount} active cadets &rarr;
            </Link>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {recentCadets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm space-y-2">
              <p className="font-semibold text-slate-800">No active cadet records found.</p>
              <p className="text-xs text-slate-400">Cadets will appear here once registered and activated by the administrator.</p>
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
                    <th className="px-6 py-3.5">Unit</th>
                    <th className="px-6 py-3.5">Completion</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentCadets.map((cadet) => (
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
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {cadet.unit}
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
                          href={`/cto/cadets/${cadet.cadetId}`}
                          className="text-xs font-semibold text-amber-700 hover:underline"
                        >
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
