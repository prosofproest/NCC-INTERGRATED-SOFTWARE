"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { DataRequest, CadetResponseRecord } from "@/types/request";
import type { FieldDefinition } from "@/types/fields";

interface DataRequestDetailViewProps {
  requestId: string;
  basePath: "/admin/data-requests" | "/cto/data-requests";
  userRole: "admin" | "cto";
}

export function DataRequestDetailView({
  requestId,
  basePath,
  userRole,
}: DataRequestDetailViewProps) {
  const [dataRequest, setDataRequest] = useState<DataRequest | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [summary, setSummary] = useState({
    totalTargeted: 0,
    completedCount: 0,
    pendingCount: 0,
    completionRate: 0,
  });
  const [canClose, setCanClose] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Close Request Modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Expanded Cadet for Detailed Values View
  const [expandedCadetId, setExpandedCadetId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch(`/api/data-requests/${requestId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load request details.");
        }
        const data = await res.json();
        if (!ignore) {
          setDataRequest(data.dataRequest);
          setFields(data.fields || []);
          setSummary(data.summary || {});
          setCanClose(Boolean(data.permissions?.canClose));
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) {
          setErrorMessage(error.message || "Failed to load data request.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [requestId, refreshKey]);

  const handleCloseRequest = async () => {
    try {
      setIsClosing(true);
      const res = await fetch(`/api/data-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to close data request.");
      }

      setIsCloseModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while closing the request.");
    } finally {
      setIsClosing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not specified";
    try {
      return new Date(dateStr).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Build field lookup map
  const fieldMap = new Map<string, FieldDefinition>();
  fields.forEach((f) => fieldMap.set(f.fieldId, f));

  // Cadets list preparation
  const cadetEntries: { cadetId: string; response: CadetResponseRecord }[] =
    dataRequest?.cadetResponses
      ? Object.entries(dataRequest.cadetResponses).map(([cadetId, response]) => ({
          cadetId,
          response,
        }))
      : [];

  const filteredCadets = cadetEntries.filter(({ cadetId, response }) => {
    if (statusFilter !== "all" && response.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inId = cadetId.toLowerCase().includes(q);
      const inName = response.cadetName?.toLowerCase().includes(q) || false;
      return inId || inName;
    }
    return true;
  });

  if (isLoading) {
    return (
      <Card>
        <div className="p-12 text-center text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading data request details...</p>
        </div>
      </Card>
    );
  }

  if (errorMessage || !dataRequest) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMessage || "Data request not found."}
        </div>
        <Link href={basePath}>
          <Button variant="outline" size="sm">
            &larr; Back to Requests
          </Button>
        </Link>
      </div>
    );
  }

  const isClosed = dataRequest.status === "closed";
  const statusBadgeVariant: BadgeVariant = isClosed ? "default" : "success";

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={basePath}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              &larr; Data Requests
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-xs font-semibold text-slate-700">
              {dataRequest.requestId}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {dataRequest.title}
            </h1>
            <Badge variant={statusBadgeVariant} size="sm">
              {dataRequest.status.toUpperCase()}
            </Badge>
            <Badge variant="outline" size="sm">
              {dataRequest.requesterRole.toUpperCase()} INITIATED
            </Badge>
            <Badge variant={userRole === "admin" ? "default" : "warning"} size="sm">
              {userRole === "admin" ? "Admin Audit" : "Officer View"}
            </Badge>
          </div>
        </div>

        {/* Close Button */}
        {!isClosed && canClose && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsCloseModalOpen(true)}
            className="cursor-pointer whitespace-nowrap shadow-sm"
          >
            Close Request
          </Button>
        )}
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Purpose & Metadata */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Campaign Overview</CardTitle>
            <CardDescription>
              Dispatched purpose and administrative parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Purpose &amp; Instructions
              </span>
              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                {dataRequest.purpose}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 block">Created By</span>
                <span className="font-medium text-slate-900">
                  {dataRequest.requesterEmail || dataRequest.requestedBy}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Created On</span>
                <span className="font-medium text-slate-900">
                  {formatDate(dataRequest.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Deadline</span>
                <span className="font-medium text-slate-900">
                  {dataRequest.deadline ? formatDate(dataRequest.deadline) : "No deadline"}
                </span>
              </div>
            </div>

            {/* Requested Fields Tags */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Requested Fields ({fields.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {fields.map((f) => (
                  <span
                    key={f.fieldId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-800 border border-slate-200"
                  >
                    <span className="font-medium">{f.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({f.fieldId})</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Response Progress</CardTitle>
            <CardDescription>Live completion telemetry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-2">
              <div className="text-4xl font-bold tracking-tight text-blue-600">
                {summary.completionRate}%
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {summary.completedCount} of {summary.totalTargeted} cadets responded
              </p>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.completionRate === 100 ? "bg-emerald-500" : "bg-blue-600"
                }`}
                style={{ width: `${summary.completionRate}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/50">
                <span className="text-emerald-700 font-semibold block text-base">
                  {summary.completedCount}
                </span>
                <span className="text-[11px] text-emerald-600">Completed</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/50">
                <span className="text-amber-700 font-semibold block text-base">
                  {summary.pendingCount}
                </span>
                <span className="text-[11px] text-amber-600">Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cadets Responses Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Targeted Cadets Roster</CardTitle>
              <CardDescription>
                Detailed breakdown of cadet response status and submitted values.
              </CardDescription>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Search cadet or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />

              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {(["all", "completed", "pending"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition cursor-pointer ${
                      statusFilter === tab
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Cadet ID</th>
                  <th className="px-6 py-3">Cadet Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Completed At</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCadets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No cadet responses match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCadets.map(({ cadetId, response }) => {
                    const isCompleted = response.status === "completed";
                    const isExpanded = expandedCadetId === cadetId;

                    return (
                      <React.Fragment key={cadetId}>
                        <tr className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                            {cadetId}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {response.cadetName || cadetId}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={isCompleted ? "success" : "warning"}
                              size="sm"
                            >
                              {response.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {response.completedAt ? formatDate(response.completedAt) : "&mdash;"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedCadetId(isExpanded ? null : cadetId)}
                              className="text-xs py-1 cursor-pointer"
                            >
                              {isExpanded ? "Hide" : "View Values"} &darr;
                            </Button>
                          </td>
                        </tr>

                        {/* Expandable Values Panel */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={5} className="px-6 py-4 border-t border-b border-slate-200/60">
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-slate-700">
                                  {isCompleted
                                    ? "Submitted Field Values:"
                                    : "Fields Missing From Cadet (Required to Fill):"}
                                </div>

                                {isCompleted ? (
                                  response.submittedValues && Object.keys(response.submittedValues).length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {Object.entries(response.submittedValues).map(([fId, val]) => {
                                        const fDef = fieldMap.get(fId);
                                        return (
                                          <div
                                            key={fId}
                                            className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1"
                                          >
                                            <span className="text-[11px] text-slate-400 font-medium">
                                              {fDef?.label || fId}
                                            </span>
                                            <p className="font-semibold text-slate-900">
                                              {String(val ?? "—")}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">
                                      Cadet already had all requested fields populated at dispatch time.
                                    </p>
                                  )
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {(response.missingFieldIds || []).map((fId) => {
                                      const fDef = fieldMap.get(fId);
                                      return (
                                        <span
                                          key={fId}
                                          className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium"
                                        >
                                          {fDef?.label || fId}
                                        </span>
                                      );
                                    })}
                                    {(!response.missingFieldIds || response.missingFieldIds.length === 0) && (
                                      <span className="text-xs text-slate-400 italic">
                                        No missing fields identified for this cadet.
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Close Confirmation Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Close Data Request"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600">
            Are you sure you want to close this data request? Once closed, cadets will no longer be able to submit responses.
          </p>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <strong>Current Progress:</strong> {summary.completedCount} of {summary.totalTargeted} cadets completed ({summary.completionRate}%).
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCloseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isClosing}
              onClick={handleCloseRequest}
              className="cursor-pointer"
            >
              Confirm Close Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
