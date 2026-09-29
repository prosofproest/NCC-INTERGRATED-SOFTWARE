import { requireAuth } from "@/lib/auth/server-guard";
import { CtoNav } from "@/components/layout/CtoNav";

export default async function CtoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth(["cto"]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      <CtoNav userEmail={session.email} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-6 text-center text-xs text-slate-400">
        NCC Data Collection &amp; Organization System &bull; Caretaker Officer (CTO) Portal &bull; Unity and Discipline
      </footer>
    </div>
  );
}
