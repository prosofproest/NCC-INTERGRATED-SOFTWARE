"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { FieldDefinition } from "@/types/fields";

interface PendingRequestItem {
  requestId: string;
  title: string;
  purpose: string;
  requesterRole: "admin" | "cto";
  requesterEmail?: string;
  deadline?: string;
  createdAt: string;
  totalRequiredCount: number;
  missingFieldIds: string[];
  missingFields: FieldDefinition[];
}

interface CompletedRequestItem {
  requestId: string;
  title: string;
  purpose: string;
  requesterRole: "admin" | "cto";
  requesterEmail?: string;
  completedAt?: string;
  submittedValues: Record<string, unknown>;
  requiredFields: FieldDefinition[];
}

export function CadetDataRequestsView() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequestItem[]>([]);
  const [completedRequests, setCompletedRequests] = useState<CompletedRequestItem[]>([]);
  const [cadetName, setCadetName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form values state keyed by requestId -> fieldId -> value
  const [formValues, setFormValues] = useState<Record<string, Record<string, unknown>>>({});
  // Submitting state per request
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch("/api/cadet/data-requests");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load data requests.");
        }
        const data = await res.json();
        if (!ignore) {
          setPendingRequests(data.pendingRequests || []);
          setCompletedRequests(data.completedRequests || []);
          setCadetName(data.cadetName || "");
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) {
          setErrorMessage(error.message || "Failed to load your data requests.");
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
  }, [refreshKey]);

  const handleInputChange = (requestId: string, fieldId: string, value: unknown) => {
    setFormValues((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const handleSubmitResponse = async (request: PendingRequestItem) => {
    const { requestId, missingFields } = request;
    setSubmitErrors((prev) => ({ ...prev, [requestId]: "" }));
    setSuccessMessages((prev) => ({ ...prev, [requestId]: "" }));

    const currentReqValues = formValues[requestId] || {};

    // Validate that all missing required fields are provided
    for (const field of missingFields) {
      const val = currentReqValues[field.fieldId];
      if (val === undefined || val === null || String(val).trim() === "") {
        setSubmitErrors((prev) => ({
          ...prev,
          [requestId]: `Please fill in all requested fields: "${field.label}" is required.`,
        }));
        return;
      }
    }

    try {
      setSubmittingRequestId(requestId);
      const res = await fetch(`/api/cadet/data-requests/${requestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: currentReqValues }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit response.");
      }

      setSuccessMessages((prev) => ({
        ...prev,
        [requestId]: "Response recorded and saved to your master cadet profile!",
      }));

      // Reload list after brief delay
      setTimeout(() => {
        setRefreshKey((k) => k + 1);
      }, 1000);
    } catch (err: unknown) {
      const error = err as Error;
      setSubmitErrors((prev) => ({
        ...prev,
        [requestId]: error.message || "Failed to submit response.",
      }));
    } finally {
      setSubmittingRequestId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not specified";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Official Data Requests
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Data collection requests dispatched by Squadron Officers.
            {cadetName && <span className="font-semibold text-slate-700"> ({cadetName})</span>}
          </p>
        </div>

        <Link href="/cadet">
          <Button variant="outline" size="sm">
            &larr; Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeTab === "pending"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Action Required</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "pending"
                ? "bg-white/20 text-white"
                : "bg-amber-100 text-amber-800 font-bold"
            }`}
          >
            {pendingRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeTab === "completed"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Completed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "completed"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {completedRequests.length}
          </span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <Card>
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p className="text-xs">Loading data requests...</p>
          </div>
        </Card>
      ) : activeTab === "pending" ? (
        /* PENDING REQUESTS TAB */
        pendingRequests.length === 0 ? (
          <Card>
            <div className="p-12 text-center text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                You&apos;re All Caught Up!
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                There are currently no active data requests requiring information from you.
              </p>
              <div className="pt-2">
                <Link href="/cadet/profile">
                  <Button variant="outline" size="sm">
                    Review My Profile
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {pendingRequests.map((req) => {
              const isSubmittingThis = submittingRequestId === req.requestId;
              const reqValues = formValues[req.requestId] || {};
              const err = submitErrors[req.requestId];
              const success = successMessages[req.requestId];

              return (
                <Card key={req.requestId} className="overflow-hidden border-blue-200/80 shadow-sm">
                  {/* Banner */}
                  <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 text-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-blue-200">
                          {req.requestId}
                        </span>
                        <Badge variant="warning" size="sm">
                          ACTION REQUIRED
                        </Badge>
                        <Badge variant="outline" size="sm" className="text-white border-white/30">
                          {req.requesterRole.toUpperCase()} MANDATED
                        </Badge>
                      </div>

                      {req.deadline && (
                        <div className="text-xs text-amber-300 font-medium flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Deadline: {formatDate(req.deadline)}
                        </div>
                      )}
                    </div>

                    <h2 className="text-lg font-bold tracking-tight text-white mt-2">
                      {req.title}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      {req.purpose}
                    </p>
                  </div>

                  <CardContent className="p-5 sm:p-6 space-y-5">
                    {/* Section 10 Intelligence Callout */}
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-3">
                      <span className="text-lg leading-none">🎯</span>
                      <div className="text-xs text-blue-950">
                        <span className="font-semibold">Intelligent Targeting: </span>
                        This campaign targets <strong>{req.totalRequiredCount}</strong> fields overall, but your profile is only missing <strong>{req.missingFields.length}</strong> of them. Already verified data on your profile has been preserved.
                      </div>
                    </div>

                    {err && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                        {err}
                      </div>
                    )}

                    {success && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                        ✓ {success}
                      </div>
                    )}

                    {/* Missing Fields Form Inputs */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Please Fill Missing Information:
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {req.missingFields.map((field) => {
                          const val = reqValues[field.fieldId] ?? "";

                          return (
                            <div key={field.fieldId} className="space-y-1.5">
                              <label className="block text-xs font-semibold text-slate-800">
                                {field.label} <span className="text-rose-500">*</span>
                              </label>

                              {field.type === "select" ? (
                                <select
                                  value={String(val)}
                                  onChange={(e) => handleInputChange(req.requestId, field.fieldId, e.target.value)}
                                  required
                                  disabled={isSubmittingThis}
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">-- Select {field.label} --</option>
                                  {(field.options || []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === "textarea" ? (
                                <textarea
                                  rows={2}
                                  value={String(val)}
                                  onChange={(e) => handleInputChange(req.requestId, field.fieldId, e.target.value)}
                                  required
                                  disabled={isSubmittingThis}
                                  placeholder={`Enter ${field.label}...`}
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                  value={String(val)}
                                  onChange={(e) =>
                                    handleInputChange(
                                      req.requestId,
                                      field.fieldId,
                                      field.type === "number" ? Number(e.target.value) : e.target.value
                                    )
                                  }
                                  required
                                  disabled={isSubmittingThis}
                                  placeholder={`Enter ${field.label}...`}
                                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {field.fieldId} &bull; Type: {field.type}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between gap-3 bg-slate-50 border-t border-slate-100 p-4 sm:p-5">
                    <span className="text-xs text-slate-500">
                      Submitting writes directly to your verified profile.
                    </span>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={isSubmittingThis}
                      disabled={isSubmittingThis}
                      onClick={() => handleSubmitResponse(req)}
                      className="cursor-pointer shadow-sm"
                    >
                      Submit Missing Information &rarr;
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* COMPLETED REQUESTS TAB */
        completedRequests.length === 0 ? (
          <Card>
            <div className="p-12 text-center text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                No Completed Requests Yet
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When you respond to official data requests, their history and your submitted values will appear here.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {completedRequests.map((req) => (
              <Card key={req.requestId}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {req.requestId}
                      </span>
                      <Badge variant="success" size="sm">
                        COMPLETED
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {req.requesterRole.toUpperCase()}
                      </Badge>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Completed {formatDate(req.completedAt)}
                    </span>
                  </div>

                  <CardTitle className="mt-2">{req.title}</CardTitle>
                  <CardDescription>{req.purpose}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Submitted Values:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(req.submittedValues).map(([fId, val]) => {
                        const fDef = req.requiredFields.find((f) => f.fieldId === fId);
                        return (
                          <div
                            key={fId}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-0.5"
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
