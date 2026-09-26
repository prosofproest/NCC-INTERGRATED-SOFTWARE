import { getSession } from "@/lib/auth/session";

export default async function CadetDashboardPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Cadet Session Verified
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Jai Hind Cadet
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
          Logged in as <strong>{session?.email}</strong> with role: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 font-mono">cadet</code>.
        </p>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400">
            Stage 3: Authentication Foundation Complete. Cadet single master record boundaries verified.
          </p>
        </div>
      </div>
    </div>
  );
}
