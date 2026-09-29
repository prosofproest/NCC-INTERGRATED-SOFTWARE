import { Metadata } from "next";
import { requireAdmin } from "@/lib/authorization";
import { AdminImportExportView } from "@/features/excel/components/AdminImportExportView";

export const metadata: Metadata = {
  title: "Import & Export | NCC Admin",
  description: "Bulk cadet account onboarding, enrollment numbers assignment, and data exports",
};

export const dynamic = "force-dynamic";

export default async function AdminImportExportPage() {
  await requireAdmin();

  return <AdminImportExportView />;
}
