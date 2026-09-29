import { Metadata } from "next";
import { requireCto } from "@/lib/authorization";
import { CtoReportsExportView } from "@/features/excel/components/CtoReportsExportView";

export const metadata: Metadata = {
  title: "Reports & Excel Export | NCC Officer Portal",
  description: "Generate compliant nominal rolls and attendance reports with ctoExportable controls",
};

export const dynamic = "force-dynamic";

export default async function CtoReportsPage() {
  await requireCto();

  return <CtoReportsExportView />;
}
