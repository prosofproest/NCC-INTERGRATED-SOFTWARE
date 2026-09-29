import React from "react";
import { DataRequestsList } from "@/features/data-requests/components/DataRequestsList";

export const metadata = {
  title: "Data Requests | Officer Portal",
};

export default function CtoDataRequestsPage() {
  return <DataRequestsList basePath="/cto/data-requests" userRole="cto" />;
}
