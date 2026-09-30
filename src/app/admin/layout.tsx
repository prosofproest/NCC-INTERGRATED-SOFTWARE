import { requireAuth } from "@/lib/auth/server-guard";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth(["admin"]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col md:flex-row font-sans antialiased">
      <AdminSidebar userEmail={session.email} />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-black/[0.04] py-6 text-center text-xs text-[#86868B]">
          NCC Data Collection &amp; Organization System &bull; Restricted Administrative Access
        </footer>
      </div>
    </div>
  );
}
