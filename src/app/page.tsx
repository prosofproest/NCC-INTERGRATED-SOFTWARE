export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-lg mb-2">
          NCC
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          NCC Data Collection &amp; Organization System
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Under Construction — Project initialization and architectural scaffolding completed.
        </p>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
          Stage 2: Project Scaffolding
        </div>
      </div>
    </main>
  );
}
