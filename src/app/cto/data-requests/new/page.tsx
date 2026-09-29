import React from "react";
import { CreateDataRequestForm } from "@/features/data-requests/components/CreateDataRequestForm";

export const metadata = {
  title: "Create Data Request | Officer Portal",
};

export default function CtoNewDataRequestPage() {
  return <CreateDataRequestForm basePath="/cto/data-requests" userRole="cto" />;
}
