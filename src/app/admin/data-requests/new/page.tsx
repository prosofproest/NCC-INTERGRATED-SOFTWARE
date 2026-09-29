import React from "react";
import { CreateDataRequestForm } from "@/features/data-requests/components/CreateDataRequestForm";

export const metadata = {
  title: "Create Data Request | Admin Portal",
};

export default function AdminNewDataRequestPage() {
  return <CreateDataRequestForm basePath="/admin/data-requests" userRole="admin" />;
}
