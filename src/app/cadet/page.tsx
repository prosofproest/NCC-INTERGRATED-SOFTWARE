import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition, CategoryDefinition } from "@/types/fields";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { CadetDocumentManager } from "@/features/documents/CadetDocumentManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CadetDashboardPage() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // 1. Resolve Cadet Record
  let cadet: CadetRecord | null = null;

  if (session.cadetId) {
    const docSnap = await adminDb.collection("cadets").doc(session.cadetId).get();
    if (docSnap.exists) {
      cadet = docSnap.data() as CadetRecord;
    }
  }

  if (!cadet) {
    // Fallback: check by userId
    const byUserSnap = await adminDb
      .collection("cadets")
      .where("userId", "==", session.uid)
      .limit(1)
      .get();
    if (!byUserSnap.empty) {
      cadet = byUserSnap.docs[0].data() as CadetRecord;
    } else {
      // Fallback: check by email
      const byEmailSnap = await adminDb
        .collection("cadets")
        .where("email", "==", session.email)
        .limit(1)
        .get();
      if (!byEmailSnap.empty) {
        cadet = byEmailSnap.docs[0].data() as CadetRecord;
      }
    }
  }

  // ==============================================================
  // SCENARIO A: Profile Not Yet Linked / Set Up
  // ==============================================================
  if (!cadet) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <Card className="border-amber-500/20 bg-amber-500/[0.03] backdrop-blur-xl p-8 text-center space-y-4 shadow-apple-card">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto shadow-xs border border-amber-500/20">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20">
              Profile Setup Pending
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
              Jai Hind Cadet 🇮🇳
            </h1>
            <p className="text-sm text-[#6E6E73] max-w-md mx-auto leading-relaxed">
              Your authentication account (<strong>{session.email}</strong>) is active, but your master NCC cadet record has not yet been linked by the Unit Administrator.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/80 border border-black/[0.06] text-xs text-[#6E6E73] text-left space-y-2">
            <p className="font-semibold text-[#1D1D1F]">Next Steps:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Contact your Associate NCC Officer (ANO) or Caretaker Officer (CTO).</li>
              <li>Provide your registered email address and regimental enrollment number.</li>
              <li>Once linked, your regimental profile, attendance, and record cards will activate automatically.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/cadet/security"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium bg-[#0071E3] text-white hover:bg-[#0077ED] transition"
            >
              Account Security &rarr;
            </Link>
            <Link
              href="/api/auth/logout"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium border border-black/[0.08] text-[#1D1D1F] hover:bg-black/[0.04] transition"
            >
              Sign Out
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ==============================================================
  // SCENARIO B: Cadet Record Exists
  // ==============================================================
  // Fetch active required fields to compute missing info
  const fieldsSnap = await adminDb.collection("fields").where("isActive", "==", true).get();
  const activeFields = fieldsSnap.docs.map((d) => d.data() as FieldDefinition);
  const requiredFields = activeFields.filter((f) => f.validation?.required);

  // Fetch active categories for document tagging
  const categoriesSnap = await adminDb.collection("categories").where("isActive", "==", true).get();
  const categories = categoriesSnap.docs
    .map((d) => d.data() as CategoryDefinition)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const missingFields: FieldDefinition[] = [];
  for (const f of requiredFields) {
    const val = cadet.dynamicData?.[f.fieldId];
    if (val === undefined || val === null || String(val).trim() === "") {
      missingFields.push(f);
    }
  }

  // Fetch pending change requests count
  let pendingChangeRequestsCount = 0;
  try {
    const crSnap = await adminDb
      .collection("change_requests")
      .where("cadetId", "==", cadet.cadetId)
      .where("status", "==", "pending")
      .count()
      .get();
    pendingChangeRequestsCount = crSnap.data().count;
  } catch {
    // If index or collection empty, fallback safely
  }

  // Fetch pending data requests count
  let pendingDataRequestsCount = 0;
  try {
    const drSnap = await adminDb
      .collection("data_requests")
      .where("status", "==", "open")
      .get();
    for (const d of drSnap.docs) {
      const data = d.data();
      if (data.cadetResponses?.[cadet.cadetId]?.status === "pending") {
        pendingDataRequestsCount++;
      }
    }
  } catch {
    // Safe fallback
  }


  const statusVariant: BadgeVariant =
    cadet.status === "active"
      ? "success"
      : cadet.status === "suspended"
      ? "danger"
      : "warning";

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 backdrop-blur-2xl bg-white/80 border border-black/[0.06] shadow-apple-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-[#0071E3]/10 to-indigo-300/10 blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
            <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.5)] animate-pulse" />
            Cadet Active Session
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Jai Hind, {cadet.fullName} 🇮🇳
          </h1>
          <p className="text-[#6E6E73] text-xs sm:text-sm max-w-xl leading-relaxed">
            Welcome to your unified cadet portal. Manage your regimental details, review profile completion, and track official data requests.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <Badge variant="air" size="sm">
              Air Wing
            </Badge>
            <Badge variant="outline" size="sm">
              {cadet.trainingYear || "1st Year"}
            </Badge>
            <Badge variant="outline" size="sm">
              {cadet.division || "SD"}
            </Badge>
            <Badge variant={statusVariant} size="sm">
              {cadet.status}
            </Badge>
            <span className="font-mono bg-black/[0.04] px-2.5 py-0.5 rounded-full text-[#6E6E73] border border-black/[0.06] text-[11px]">
              {cadet.cadetId}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
          <Link
            href="/cadet/profile"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#0071E3] text-white font-medium text-xs sm:text-sm hover:bg-[#0077ED] transition shadow-sm cursor-pointer"
          >
            My Profile &rarr;
          </Link>
          <Link
            href="/cadet/change-requests"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08] border border-black/[0.06] font-medium text-xs sm:text-sm transition cursor-pointer"
          >
            Change Requests
          </Link>
        </div>
      </div>

      {/* Action Required: Missing Required Profile Information */}
      {missingFields.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-amber-900">
                Action Required: {missingFields.length} Mandatory Profile Field(s) Incomplete
              </h2>
              <p className="text-xs text-amber-700">
                Please provide: {missingFields.map((f) => f.label).join(", ")}. Complete these to reach 100% profile readiness.
              </p>
            </div>
          </div>
          <Link
            href="/cadet/profile"
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold shrink-0 transition"
          >
            Fill Information &rarr;
          </Link>
        </div>
      )}

      {/* Metrics & Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Profile Completion */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Profile Completion
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {cadet.completionPercentage || 0}%
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {cadet.completionPercentage === 100 ? "Complete" : `${missingFields.length} pending`}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cadet.completionPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Requests */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Change Requests
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-purple-600">
                {pendingChangeRequestsCount}
              </span>
              <p className="text-xs text-slate-500 mt-1">Pending administrative review</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Data Requests */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Data Requests
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                0
              </span>
              <p className="text-xs text-slate-500 mt-1">Active requests from CTO/Admin</p>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Documents
              </span>
              <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                0
              </span>
              <p className="text-xs text-slate-500 mt-1">Attached certificates &amp; records</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section: NCC Regimental Information Summary */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>NCC Regimental Information</CardTitle>
            <CardDescription>
              Official battalion records. Protected attributes can be modified by submitting a Change Request.
            </CardDescription>
          </div>
          <Link
            href="/cadet/profile"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            View Complete Profile &rarr;
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Permanent Cadet ID</span>
              <p className="font-mono text-sm font-bold text-slate-900">
                {cadet.cadetId}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Regimental Enrollment No</span>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {cadet.enrollmentNo || <span className="text-slate-400 italic font-sans">Pending assignment</span>}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Training Year &amp; Division</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm">
                  {cadet.trainingYear || "1st Year"}
                </Badge>
                <Badge variant="outline" size="sm">
                  {cadet.division || "SD"} ({cadet.division === "SW" ? "Senior Wing" : "Senior Division"})
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Rank &amp; Wing</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {cadet.rank}
                </span>
                <Badge variant="air" size="sm">
                  Air Wing
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Battalion / Unit</span>
              <p className="text-sm font-semibold text-slate-900">
                {cadet.unit}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Registered Email</span>
              <p className="text-sm text-slate-700">
                {cadet.email}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Enrollment Status</span>
              <div>
                <Badge variant={statusVariant} size="sm">
                  {cadet.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholders Grid (Data Requests, Notifications, Documents) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Data Requests Card */}
        <Card className={`h-full ${pendingDataRequestsCount > 0 ? "border-amber-300 bg-amber-50/20" : ""}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Active Data Requests</CardTitle>
              {pendingDataRequestsCount > 0 ? (
                <Badge variant="warning" size="sm">
                  {pendingDataRequestsCount} Pending
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Up to Date
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-center py-6 space-y-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${
                  pendingDataRequestsCount > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {pendingDataRequestsCount > 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  )}
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {pendingDataRequestsCount > 0
                  ? `${pendingDataRequestsCount} Action${pendingDataRequestsCount > 1 ? "s" : ""} Required`
                  : "No active data requests"}
              </p>
              <p className="text-[11px] text-slate-400">
                {pendingDataRequestsCount > 0
                  ? "Battalion officers have requested information."
                  : "You are completely up to date."}
              </p>
              <div className="pt-2">
                <Link
                  href="/cadet/data-requests"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {pendingDataRequestsCount > 0 ? "Complete Now &rarr;" : "View Requests &rarr;"}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
              <Badge variant="outline" size="sm">Alerts</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-center py-6 space-y-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-xs font-medium text-slate-700">No notifications yet</p>
              <p className="text-[11px] text-slate-400">Broadcasts and alerts will appear here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Document Repository & Cloud Storage */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Documents</CardTitle>
                <CardDescription className="text-xs">
                  Upload and view verified certificates and attachments
                </CardDescription>
              </div>
              <Badge variant="success" size="sm">Drive Synced</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <CadetDocumentManager
              cadetId={cadet.cadetId}
              cadetName={cadet.fullName}
              userRole="cadet"
              categories={categories}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
