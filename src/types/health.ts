export type HealthStatus = "operational" | "warning" | "failed" | "not_applicable";

export type HealthServiceId =
  | "database"
  | "auth"
  | "google_drive"
  | "smtp"
  | "excel"
  | "notifications"
  | "data_requests"
  | "background_jobs";

export type HealthCategory = "core" | "storage" | "communication" | "features";

export interface ServiceHealthCheck {
  serviceId: HealthServiceId;
  serviceName: string;
  category: HealthCategory;
  status: HealthStatus;
  message: string;
  latencyMs?: number;
  lastChecked: string; // ISO 8601
  details?: Record<string, unknown>;
  consecutiveFailures?: number;
  firstFailedAt?: string;
  retryAttempted?: boolean;
  recovered?: boolean;
}

export interface HealthIncident {
  serviceId: HealthServiceId;
  serviceName: string;
  status: "failing" | "recovered";
  firstFailedAt: string;
  lastFailedAt: string;
  consecutiveFailures: number;
  lastError: string;
  recoveredAt?: string;
}

export interface SystemHealthReport {
  overallStatus: HealthStatus;
  checkedAt: string;
  services: ServiceHealthCheck[];
  summary: {
    total: number;
    operational: number;
    warning: number;
    failed: number;
    notApplicable: number;
  };
  activeIncidents: HealthIncident[];
}
