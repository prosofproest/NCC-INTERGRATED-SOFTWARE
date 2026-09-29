import { Metadata } from "next";
import { requireAdmin } from "@/lib/authorization";
import { AdminChangeRequestsList } from "@/features/change-requests/components/AdminChangeRequestsList";

export const metadata: Metadata = {
  title: "Change Requests Review | NCC Admin",
  description: "Review and adjudicate cadet profile change requests",
};

export const dynamic = "force-dynamic";

export default async function AdminChangeRequestsPage() {
  await requireAdmin();

  return <AdminChangeRequestsList />;
}
