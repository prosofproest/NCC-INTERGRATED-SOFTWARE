import React from "react";
import { DataRequestDetailView } from "@/features/data-requests/components/DataRequestDetailView";

interface PageProps {
  params: Promise<{
    requestId: string;
  }>;
}

export const metadata = {
  title: "Data Request Details | Admin Portal",
};

export default async function AdminDataRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;

  return (
    <DataRequestDetailView
      requestId={requestId}
      basePath="/admin/data-requests"
      userRole="admin"
    />
  );
}
