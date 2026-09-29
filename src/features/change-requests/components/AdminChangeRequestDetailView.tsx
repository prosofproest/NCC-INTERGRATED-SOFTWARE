"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ChangeRequest } from "@/types/request";
import type { CadetRecord } from "@/types/cadet";
import type { FieldDefinition } from "@/types/fields";

interface AdminChangeRequestDetailViewProps {
  changeRequestId: string;
}

export function AdminChangeRequestDetailView({
  changeRequestId,
}: AdminChangeRequestDetailViewProps) {
  const router = useRouter();
  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(null);
  const [cadet, setCadet] = useState<CadetRecord | null>(null);
  const [field, setField] = useState<FieldDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  // Review Action State
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewerComments, setReviewerComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadDetail() {
      try {
        const res = await fetch(`/api/admin/change-requests/${changeRequestId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load change request details.");
        }
        const data = await res.json();
        if (!ignore) {
          setChangeRequest(data.changeRequest);
          setCadet(data.cadet);
          setField(data.field);
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) {
          setErrorMessage(error.message || "Failed to load change request.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      ignore = true;
    };
  }, [changeRequestId, refreshKey]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeRequest) return;

    if (reviewAction === "reject" && (!reviewerComments.trim() || reviewerComments.trim().length < 3)) {
      setActionError("Please provide a reason for rejection (minimum 3 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);

      const res = await fetch(`/api/admin/change-requests/${changeRequestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          reviewerComments: reviewerComments.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process review action.");
      }

      setActionSuccess(data.message || `Change request successfully ${reviewAction}d.`);
      // Reload fresh state
      setRefreshKey((k) => k + 1);
      router.refresh();
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || "An error occurred while submitting review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: string): BadgeVariant => {
    switch (status) {
      case "approved":
        return "success";
      case "rejected":
        return "danger";
      case "pending":
      default:
        return "warning";
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/change-requests"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          &larr; Back to Change Requests
        </Link>
        <Card className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading change request details...</p>
        </Card>
      </div>
    );
  }

  if (errorMessage || !changeRequest) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/change-requests"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          &larr; Back to Change Requests
        </Link>
        <Card className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Change Request Not Found
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {errorMessage || "The requested change request record could not be retrieved."}
          </p>
          <Link href="/admin/change-requests">
            <Button variant="outline" size="sm">
              Return to Change Requests List
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isPending = changeRequest.status === "pending";

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/change-requests"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-2"
          >
            &larr; Back to All Change Requests
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {changeRequest.changeRequestId}
            </h1>
            <Badge variant={getStatusVariant(changeRequest.status)} size="md">
              {changeRequest.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submitted on {formatDate(changeRequest.requestedAt || changeRequest.createdAt)}
          </p>
        </div>

        {cadet && (
          <Link href={`/admin/cadets/${cadet.cadetId}`}>
            <Button variant="outline" size="sm">
              View Cadet Master Record &rarr;
            </Button>
          </Link>
        )}
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 font-medium">
          {actionSuccess}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Cadet Info & Request Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cadet Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Cadet Identity</span>
                <span className="font-mono text-xs font-normal text-slate-400">
                  {changeRequest.cadetId}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Cadet profile submitting the modification request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Full Name</span>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {cadet?.fullName || changeRequest.cadetName || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Rank &amp; Wing</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {cadet?.rank || "—"} • {cadet?.wing || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Unit</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {cadet?.unit || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium">Status</span>
                  <div>
                    <Badge variant={cadet?.status === "active" ? "success" : "warning"} size="sm">
                      {cadet?.status || "Unknown"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Value Comparison Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">
                Requested Attribute Modification
              </CardTitle>
              <CardDescription className="text-xs">
                Comparison of the registered value against the proposed update
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Field Target Header */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Target Field:</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {changeRequest.fieldLabel}
                    </span>
                    {field && (
                      <Badge variant="default" size="sm">
                        {field.type}
                      </Badge>
                    )}
                    {field?.validation?.required && (
                      <Badge variant="warning" size="sm">
                        Required
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {field?.categoryId && (
                    <span className="text-slate-500 font-mono text-[11px]">
                      Cat: {field.categoryId}
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    ID: {changeRequest.fieldId}
                  </span>
                </div>
              </div>

              {/* Side by side diff */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Previous Value */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      Previous / Current Value
                    </span>
                    <span className="text-[10px] text-slate-400">In Database</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[48px] flex items-center">
                    {changeRequest.oldValue ? (
                      <span className="font-mono text-slate-600 dark:text-slate-300 line-through">
                        {String(changeRequest.oldValue)}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">Empty / Not recorded</span>
                    )}
                  </div>
                </div>

                {/* Proposed New Value */}
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider text-[10px]">
                      Proposed New Value
                    </span>
                    <span className="text-[10px] text-blue-600 font-medium">To be applied</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 min-h-[48px] flex items-center">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                      {String(changeRequest.newValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cadet Stated Reason */}
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-1.5 text-xs">
                <span className="text-amber-800 dark:text-amber-400 font-semibold block text-[11px] uppercase tracking-wider">
                  Cadet Stated Justification
                </span>
                <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                  &ldquo;{changeRequest.reason}&rdquo;
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column: Adjudication Action / History Status */}
        <div className="space-y-6">
          {isPending ? (
            <Card className="border-2 border-slate-900 dark:border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Admin Adjudication</CardTitle>
                <CardDescription className="text-xs">
                  Review and make a final determination on this change request.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  {actionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {actionError}
                    </div>
                  )}

                  {/* Decision Toggle */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Determination
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewAction("approve")}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                          reviewAction === "approve"
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewAction("reject")}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                          reviewAction === "reject"
                            ? "border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 ring-2 ring-rose-500/20"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>

                  {/* Comments Box */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {reviewAction === "reject" ? (
                        <span>
                          Rejection Reason <span className="text-rose-500">* (Mandatory)</span>
                        </span>
                      ) : (
                        <span>Reviewer Remarks (Optional)</span>
                      )}
                    </label>
                    <textarea
                      rows={4}
                      value={reviewerComments}
                      onChange={(e) => setReviewerComments(e.target.value)}
                      placeholder={
                        reviewAction === "reject"
                          ? "Explain why this change request is rejected. This reason will be displayed directly to the cadet in their portal..."
                          : "Optional administrative note or reference..."
                      }
                      required={reviewAction === "reject"}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {reviewAction === "reject" && (
                      <p className="text-[10px] text-slate-400">
                        Rejected requests permanently preserve their history. The cadet will be notified of this reason.
                      </p>
                    )}
                  </div>

                  {/* Impact Notice */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 leading-relaxed border border-slate-200 dark:border-slate-700">
                    {reviewAction === "approve" ? (
                      <span>
                        Approving will immediately update the cadet&apos;s dynamic profile data for{" "}
                        <strong className="text-slate-800 dark:text-slate-200">{changeRequest.fieldLabel}</strong>{" "}
                        and recompute their profile completion score.
                      </span>
                    ) : (
                      <span>
                        Rejecting will leave the cadet&apos;s current profile record intact. The request is archived with status &ldquo;rejected&rdquo;.
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button
                    type="submit"
                    variant={reviewAction === "approve" ? "primary" : "danger"}
                    size="md"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    className={`w-full ${
                      reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                  >
                    {reviewAction === "approve" ? "Confirm & Apply Change" : "Reject Change Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {changeRequest.status === "approved" ? "Request Approved" : "Request Rejected"}
                </CardTitle>
                <CardDescription className="text-xs">
                  This change request has been adjudicated and finalized.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {changeRequest.status === "approved" ? (
                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Applied to Master Record
                    </div>
                    <p className="text-emerald-700 dark:text-emerald-400 text-xs">
                      The dynamic data field <strong>{changeRequest.fieldLabel}</strong> was updated to &ldquo;{String(changeRequest.newValue)}&rdquo;.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-sm">
                      <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Request Rejected
                    </div>
                    <p className="text-rose-700 dark:text-rose-400 text-xs">
                      The profile value remains unchanged. This record is preserved in history per Section 11 regulations.
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reviewed By:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {changeRequest.reviewedByEmail || changeRequest.reviewedBy || "Administrator"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reviewed On:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {formatDate(changeRequest.reviewedAt)}
                    </span>
                  </div>
                </div>

                {changeRequest.reviewerComments && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-1">
                    <span className="text-slate-500 font-semibold text-[11px] block uppercase tracking-wider">
                      Reviewer Reason / Comments:
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 italic font-medium">
                      &ldquo;{changeRequest.reviewerComments}&rdquo;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* System Audit Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                System Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Request Document ID:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {changeRequest.changeRequestId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cadet Permanent ID:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {changeRequest.cadetId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Created:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {formatDate(changeRequest.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Modified:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {formatDate(changeRequest.updatedAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
