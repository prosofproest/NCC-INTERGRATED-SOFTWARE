import React from "react";
import { DataRequestsList } from "@/features/data-requests/components/DataRequestsList";

export const metadata = {
  title: "Data Requests | Admin Portal",
};

export default function AdminDataRequestsPage() {
  return <DataRequestsList basePath="/admin/data-requests" userRole="admin" />;
}
