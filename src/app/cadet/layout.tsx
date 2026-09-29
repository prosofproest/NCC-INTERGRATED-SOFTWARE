import { requireAuth } from "@/lib/auth/server-guard";
import { adminDb } from "@/lib/firebase/admin";
import { CadetNav } from "@/components/layout/CadetNav";

export default async function CadetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth(["cadet"]);

  // Optionally fetch cadet's name for display in top nav
  let cadetName: string | undefined;
  if (session.cadetId) {
    const cadetDoc = await adminDb.collection("cadets").doc(session.cadetId).get();
    if (cadetDoc.exists) {
      cadetName = cadetDoc.data()?.fullName;
    }
  } else {
    // Fallback: look up by userId
    const cadetSnap = await adminDb
      .collection("cadets")
      .where("userId", "==", session.uid)
      .limit(1)
      .get();
    if (!cadetSnap.empty) {
      cadetName = cadetSnap.docs[0].data()?.fullName;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      <CadetNav userEmail={session.email} cadetName={cadetName} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-6 text-center text-xs text-slate-400">
        NCC Data Collection &amp; Organization System &bull; Cadet Personal Portal &bull; Unity and Discipline
      </footer>
    </div>
  );
}
