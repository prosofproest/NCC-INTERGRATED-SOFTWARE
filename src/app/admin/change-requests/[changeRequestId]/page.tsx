import { Metadata } from "next";
import { requireAdmin } from "@/lib/authorization";
import { AdminChangeRequestDetailView } from "@/features/change-requests/components/AdminChangeRequestDetailView";

export const metadata: Metadata = {
  title: "Review Change Request | NCC Admin",
  description: "Adjudicate cadet modification request for protected profile attributes",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    changeRequestId: string;
  }>;
}

export default async function AdminChangeRequestDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { changeRequestId } = await params;

  return <AdminChangeRequestDetailView changeRequestId={changeRequestId} />;
}
