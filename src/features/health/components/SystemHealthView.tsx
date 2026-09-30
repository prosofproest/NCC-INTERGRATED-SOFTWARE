"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type {
  SystemHealthReport,
  ServiceHealthCheck,
  HealthStatus,
} from "@/types/health";

export function SystemHealthView() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const fetchHealth = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load system health report.");
      }

      const data = await res.json();
      setReport(data.report);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "An unexpected error occurred during health check.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/admin/health", { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load system health report.");
        }
        const data = await res.json();
        if (!ignore) {
          setReport(data.report);
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) setErrorMessage(error.message || "Failed to load health status.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const getStatusBadge = (status: HealthStatus): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "operational":
        return { variant: "success", label: "Operational" };
      case "warning":
        return { variant: "warning", label: "Warning" };
      case "failed":
        return { variant: "danger", label: "Failed" };
      case "not_applicable":
      default:
        return { variant: "outline", label: "N/A" };
    }
  };

  const getCategoryBadge = (category: string): { variant: BadgeVariant; label: string } => {
    switch (category) {
      case "core":
        return { variant: "primary", label: "Core Infra" };
      case "storage":
        return { variant: "primary", label: "Cloud Storage" };
      case "communication":
        return { variant: "air", label: "Communication" };
      case "features":
      default:
        return { variant: "default", label: "Features" };
    }
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Status Banner */}
      <div
        className={`rounded-3xl p-6 sm:p-8 text-white shadow-sm transition-all ${
          !report || report.overallStatus === "operational"
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border border-emerald-900/50"
            : report.overallStatus === "warning"
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 border border-amber-900/50"
            : "bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 border border-rose-900/50"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/10 text-white">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !report || report.overallStatus === "operational"
                    ? "bg-emerald-400 animate-pulse"
                    : report.overallStatus === "warning"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-400 animate-pulse"
                }`}
              />
              <span>
                {!report || report.overallStatus === "operational"
                  ? "All Systems Operational"
                  : report.overallStatus === "warning"
                  ? "Performance Warning Detected"
                  : "Critical Service Outage Detected"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              NCC System Health & Connectivity
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
              Live diagnostic verification of Cloud Firestore, Firebase Authentication, Google Drive OAuth integration, and SMTP Email dispatch services.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {report && (
              <span className="text-xs text-slate-300">
                Last checked:{" "}
                <span className="font-mono text-white font-medium">
                  {formatTimestamp(report.checkedAt)}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchHealth(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-100 disabled:opacity-50 transition shadow-sm cursor-pointer"
            >
              {isRefreshing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Checking Services...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Run Health Check Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Active Incidents Alert (Prominent per Spec Section 21) */}
      {report && report.activeIncidents && report.activeIncidents.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
            <span className="text-lg">⚠️</span>
            <span>Active Service Incidents ({report.activeIncidents.length})</span>
          </div>
          <p className="text-xs text-rose-700">
            The following services failed automated health checks and require administrative attention:
          </p>
          <div className="space-y-2">
            {report.activeIncidents.map((incident) => (
              <div
                key={incident.serviceId}
                className="p-3 rounded-xl bg-white border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {incident.serviceName}
                    </span>
                    <Badge variant="danger" size="sm">
                      {incident.consecutiveFailures} Consecutive Failure
                      {incident.consecutiveFailures > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    {incident.lastError}
                  </p>
                </div>
                <div className="text-[11px] text-slate-500 sm:text-right">
                  <div>First failed: {formatTimestamp(incident.firstFailedAt)}</div>
                  <div>Last failed: {formatTimestamp(incident.lastFailedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Metric Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Total Services Checked
                </span>
                <div className="text-2xl font-bold text-slate-900">
                  {report.summary.total}
                </div>
                <p className="text-[10px] text-slate-500">Live components monitored</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                🖥️
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">
                  Fully Operational
                </span>
                <div className="text-2xl font-bold text-emerald-700">
                  {report.summary.operational}
                </div>
                <p className="text-[10px] text-slate-500">Healthy & verified</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                ✓
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-amber-600 uppercase">
                  Degraded / Warnings
                </span>
                <div className="text-2xl font-bold text-amber-700">
                  {report.summary.warning}
                </div>
                <p className="text-[10px] text-slate-500">Slow latency or retries</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                ⚠️
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-rose-600 uppercase">
                  Service Failures
                </span>
                <div className="text-2xl font-bold text-rose-700">
                  {report.summary.failed}
                </div>
                <p className="text-[10px] text-slate-500">Requires investigation</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
                ❌
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Detailed Services List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Monitored Component Services
          </h2>
          <span className="text-xs text-slate-500">
            Real connectivity tests executed via server API
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <div className="inline-block w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="font-medium text-slate-700">
              Running live diagnostics across all system services...
            </p>
            <p className="text-[11px] text-slate-400">
              Verifying Firestore, Firebase Auth, Google Drive OAuth, and SMTP connections
            </p>
          </div>
        ) : !report ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No health report available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.services.map((service: ServiceHealthCheck) => {
              const statusBadge = getStatusBadge(service.status);
              const catBadge = getCategoryBadge(service.category);
              const isExpanded = expandedService === service.serviceId;

              return (
                <Card
                  key={service.serviceId}
                  className={`border transition-all ${
                    service.status === "failed"
                      ? "border-rose-300 bg-rose-50/20"
                      : service.status === "warning"
                      ? "border-amber-300 bg-amber-50/20"
                      : "border-slate-200/80 bg-white"
                  }`}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {service.serviceName}
                          </h3>
                          <Badge variant={catBadge.variant} size="sm">
                            {catBadge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {service.message}
                        </p>
                      </div>

                      <Badge variant={statusBadge.variant} size="sm">
                        {statusBadge.label}
                      </Badge>
                    </div>

                    {/* Latency and Status Bar */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {service.latencyMs !== undefined ? (
                          <span className="font-mono text-slate-700 font-semibold">
                            {service.latencyMs} ms
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No latency</span>
                        )}
                        {service.retryAttempted && (
                          <Badge variant="warning" size="sm">
                            Retried Once
                          </Badge>
                        )}
                        {service.recovered && (
                          <Badge variant="success" size="sm">
                            Recovered
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {formatTimestamp(service.lastChecked)}
                        </span>
                        {service.details && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedService(isExpanded ? null : service.serviceId)
                            }
                            className="text-blue-600 hover:underline text-[11px] cursor-pointer"
                          >
                            {isExpanded ? "Hide Details" : "Details"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Technical Details */}
                    {isExpanded && service.details && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] font-mono space-y-1">
                        {Object.entries(service.details).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-slate-500 uppercase">{k}:</span>
                            <span className="text-slate-800 font-medium">
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
