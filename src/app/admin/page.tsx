import { getSession } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Authenticated Session Active
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Jai Hind, Administrator
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
          Logged in as <strong>{session?.email}</strong> with role: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono">admin</code>.
        </p>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400">
            Stage 3: Authentication Foundation Complete. Administrator privileges and secure session cookies verified.
          </p>
        </div>
      </div>
    </div>
  );
}
