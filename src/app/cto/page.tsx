import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CtoDashboardPage() {
  const session = await getSession();

  // CTO has authorized read access only to active/operational cadet records
  let activeCadetsCount = 0;
  let armyCadetsCount = 0;
  let navyCadetsCount = 0;
  let airCadetsCount = 0;
  let recentCadets: CadetRecord[] = [];

  try {
    const [
      activeSnap,
      armySnap,
      navySnap,
      airSnap,
      recentSnap,
    ] = await Promise.all([
      adminDb.collection("cadets").where("status", "==", "active").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("wing", "==", "Army").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("wing", "==", "Navy").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").where("wing", "==", "Air").count().get(),
      adminDb.collection("cadets").where("status", "==", "active").limit(5).get(),
    ]);

    activeCadetsCount = activeSnap.data().count;
    armyCadetsCount = armySnap.data().count;
    navyCadetsCount = navySnap.data().count;
    airCadetsCount = airSnap.data().count;

    recentCadets = recentSnap.docs.map((d) => d.data() as CadetRecord);
  } catch (err) {
    console.error("Error loading CTO dashboard data:", err);
  }

  const getWingVariant = (wing: string): BadgeVariant => {
    switch (wing) {
      case "Army":
        return "army";
      case "Navy":
        return "navy";
      case "Air":
        return "air";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-8">
      {/* Officer Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm border border-amber-900/20">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/30 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Caretaker Officer Session Active
          </div>
          {/* Section 29 Mandatory Greeting */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Jai Hind Sir 🇮🇳
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
            Battalion Officer Portal. Browse enrolled cadet profiles, filter records across wings, and monitor readiness metrics.
          </p>
          <div className="pt-1 text-xs text-slate-400">
            Authenticated Officer: <span className="text-slate-200 font-mono">{session?.email}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/cto/cadets"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-xs sm:text-sm hover:bg-amber-500 transition shadow-sm cursor-pointer"
          >
            Cadets Directory &rarr;
          </Link>
          <Link
            href="/cto/reports"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 font-medium text-xs sm:text-sm hover:bg-white/20 transition cursor-pointer"
          >
            Reports &amp; Export
          </Link>
        </div>
      </div>

      {/* Authorized Metrics Grid (Strictly Officer-Visible Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Active Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Cadets
              </span>
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeCadetsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Operational battalion strength</p>
            </div>
          </CardContent>
        </Card>

        {/* Army Wing Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Army Wing
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {armyCadetsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Enrolled infantry cadets</p>
            </div>
          </CardContent>
        </Card>

        {/* Navy Wing Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Naval Wing
              </span>
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                {navyCadetsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Enrolled naval cadets</p>
            </div>
          </CardContent>
        </Card>

        {/* Air Wing Cadets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Air Wing
              </span>
              <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
                {airCadetsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Enrolled flying squadron cadets</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/cto/cadets" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-600 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Search &amp; Filter &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Cadets Directory</CardTitle>
              <CardDescription>
                Search and inspect verified cadet records. Access is automatically restricted to officer-permitted profile attributes.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/cto/reports" className="group">
          <Card className="h-full border border-slate-200/80 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600 transition-all hover:shadow-md">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs text-slate-500 font-semibold group-hover:translate-x-1 transition-transform">
                  Stage 11 &rarr;
                </span>
              </div>
              <CardTitle className="mt-4 text-base font-bold">Reports &amp; Excel Export</CardTitle>
              <CardDescription>
                Export filtered officer reports to formatted Excel spreadsheets. Feature unlocks in Stage 11.
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
              Snapshot of operational cadet profiles currently enrolled in your unit.
            </CardDescription>
          </div>
          <Link
            href="/cto/cadets"
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
          >
            View all {activeCadetsCount} active cadets &rarr;
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentCadets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No active cadet records found.
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
                    <th className="px-6 py-3.5">Unit</th>
                    <th className="px-6 py-3.5">Completion</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {recentCadets.map((cadet) => (
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
                          <Badge variant={getWingVariant(cadet.wing)} size="sm">
                            {cadet.wing}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {cadet.unit}
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
                          href={`/cto/cadets/${cadet.cadetId}`}
                          className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
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
