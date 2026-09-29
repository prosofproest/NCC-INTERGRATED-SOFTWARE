import React from "react";
import { DataRequestDetailView } from "@/features/data-requests/components/DataRequestDetailView";

interface PageProps {
  params: Promise<{
    requestId: string;
  }>;
}

export const metadata = {
  title: "Data Request Details | Officer Portal",
};

export default async function CtoDataRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  return (
    <DataRequestDetailView
      requestId={requestId}
      basePath="/cto/data-requests"
      userRole="cto"
    />
  );
}
