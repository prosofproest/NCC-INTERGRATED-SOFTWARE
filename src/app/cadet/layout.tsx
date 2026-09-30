import { requireAuth } from "@/lib/auth/server-guard";
import { adminDb } from "@/lib/firebase/admin";
import { CadetSidebar } from "@/components/layout/CadetSidebar";

export default async function CadetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth(["cadet"]);

  // Optionally fetch cadet's name for display in sidebar
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
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col md:flex-row font-sans antialiased">
      <CadetSidebar userEmail={session.email} cadetName={cadetName} />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-black/[0.04] dark:border-white/[0.06] py-6 text-center text-xs text-[#86868B]">
          NCC Data Collection &amp; Organization System &bull; Cadet Personal Portal &bull; Unity and Discipline
        </footer>
      </div>
    </div>
  );
}
