"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ChangeRequest } from "@/types/request";

interface SummaryMetrics {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export function AdminChangeRequestsList() {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics>({
    totalCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewerComments, setReviewerComments] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadRequests() {
      try {
        const queryParams = new URLSearchParams();
        if (filter !== "all") queryParams.set("status", filter);
        if (search.trim()) queryParams.set("search", search.trim());

        const res = await fetch(`/api/admin/change-requests?${queryParams.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load change requests.");
        }
        const data = await res.json();
        if (!ignore) {
          setChangeRequests(data.changeRequests || []);
          if (data.summary) setSummary(data.summary);
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) {
          setErrorMessage(error.message || "An unexpected error occurred.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadRequests();
    return () => {
      ignore = true;
    };
  }, [filter, search, refreshKey]);

  const openReviewModal = (cr: ChangeRequest, defaultAction: "approve" | "reject" = "approve") => {
    setSelectedRequest(cr);
    setReviewAction(defaultAction);
    setReviewerComments("");
    setModalError(null);
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (reviewAction === "reject" && (!reviewerComments.trim() || reviewerComments.trim().length < 3)) {
      setModalError("Please provide a reason for rejecting this change request (at least 3 characters).");
      return;
    }

    try {
      setIsProcessing(true);
      setModalError(null);

      const res = await fetch(`/api/admin/change-requests/${selectedRequest.changeRequestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          reviewerComments: reviewerComments.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process review.");
      }

      setIsReviewModalOpen(false);
      setSelectedRequest(null);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const error = err as Error;
      setModalError(error.message || "An error occurred while processing the request.");
    } finally {
      setIsProcessing(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Change Requests Review
            </h1>
            <Badge variant="primary" size="sm">
              Section 11
            </Badge>
            <Badge variant="default" size="sm">
              Admin Exclusive
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and adjudicate profile modification requests submitted by cadets for protected regimental attributes.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          onClick={() => setFilter("pending")}
          className={`cursor-pointer transition hover:border-amber-400 ${
            filter === "pending" ? "border-amber-400 bg-amber-50/20" : ""
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending Review
            </span>
            <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.pendingCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting admin adjudication</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilter("approved")}
          className={`cursor-pointer transition hover:border-emerald-400 ${
            filter === "approved" ? "border-emerald-400 bg-emerald-50/20" : ""
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Approved
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.approvedCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Updated to master profile</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilter("rejected")}
          className={`cursor-pointer transition hover:border-rose-400 ${
            filter === "rejected" ? "border-rose-400 bg-rose-50/20" : ""
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Rejected
            </span>
            <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary.rejectedCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">History preserved</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilter("all")}
          className={`cursor-pointer transition hover:border-slate-400 ${
            filter === "all" ? "border-slate-400 bg-slate-50/20" : ""
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Lifetime
            </span>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summary.totalCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">All submitted requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab === "all" ? "All Requests" : `${tab}`}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by cadet, ID, field, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Table / List */}
      {isLoading ? (
        <Card>
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p className="text-xs">Loading change requests...</p>
          </div>
        </Card>
      ) : changeRequests.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No {filter !== "all" ? filter : ""} change requests found
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {filter === "pending"
                ? "All change requests have been processed! No pending items in queue."
                : "No matching change requests were found for the current query."}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Request ID</th>
                  <th className="px-5 py-3">Cadet</th>
                  <th className="px-5 py-3">Field &amp; Values</th>
                  <th className="px-5 py-3">Cadet Reason</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {changeRequests.map((cr) => {
                  const isPending = cr.status === "pending";

                  return (
                    <tr
                      key={cr.changeRequestId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <Link
                          href={`/admin/change-requests/${cr.changeRequestId}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {cr.changeRequestId}
                        </Link>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {cr.cadetName || cr.cadetId}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {cr.cadetId}
                        </div>
                      </td>

                      <td className="px-5 py-4 min-w-[200px]">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {cr.fieldLabel}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                          <span className="text-slate-400 line-through truncate max-w-[100px]" title={String(cr.oldValue)}>
                            {cr.oldValue ? String(cr.oldValue) : "empty"}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[120px]" title={String(cr.newValue)}>
                            {String(cr.newValue)}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="truncate text-slate-600 dark:text-slate-400 italic" title={cr.reason}>
                          &ldquo;{cr.reason}&rdquo;
                        </p>
                        {cr.reviewerComments && (
                          <p className="text-[10px] text-slate-400 mt-1 truncate" title={cr.reviewerComments}>
                            Notes: {cr.reviewerComments}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {formatDate(cr.requestedAt || cr.createdAt)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(cr.status)} size="sm">
                          {cr.status.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openReviewModal(cr, "approve")}
                                className="text-xs py-1 px-2.5 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReviewModal(cr, "reject")}
                                className="text-xs py-1 px-2.5 cursor-pointer hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Link href={`/admin/change-requests/${cr.changeRequestId}`}>
                              <Button variant="ghost" size="sm" className="text-xs py-1 cursor-pointer">
                                Details &rarr;
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Review Change Request: ${selectedRequest.changeRequestId}`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            {/* Request Context Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Cadet:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedRequest.cadetName || selectedRequest.cadetId} ({selectedRequest.cadetId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Field:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedRequest.fieldLabel} ({selectedRequest.fieldId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current / Old Value:</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono">
                  {selectedRequest.oldValue ? String(selectedRequest.oldValue) : "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600 font-semibold">Requested New Value:</span>
                <span className="text-blue-700 dark:text-blue-300 font-bold font-mono">
                  {String(selectedRequest.newValue)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block mb-0.5">Cadet Reason:</span>
                <p className="italic text-slate-700 dark:text-slate-300">
                  &ldquo;{selectedRequest.reason}&rdquo;
                </p>
              </div>
            </div>

            {/* Action Segmented Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReviewAction("approve")}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  reviewAction === "approve"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Approve Request
              </button>
              <button
                type="button"
                onClick={() => setReviewAction("reject")}
                className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                  reviewAction === "reject"
                    ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Reject Request
              </button>
            </div>

            {/* Reviewer Comments Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {reviewAction === "reject" ? (
                  <span>
                    Reason for Rejection <span className="text-rose-500">* (Required)</span>
                  </span>
                ) : (
                  <span>Reviewer Notes (Optional)</span>
                )}
              </label>
              <textarea
                rows={3}
                value={reviewerComments}
                onChange={(e) => setReviewerComments(e.target.value)}
                placeholder={
                  reviewAction === "reject"
                    ? "State the reason why this modification is rejected (visible to cadet)..."
                    : "Add optional notes or audit remarks..."
                }
                required={reviewAction === "reject"}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReviewModalOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={reviewAction === "approve" ? "primary" : "danger"}
                size="sm"
                isLoading={isProcessing}
                disabled={isProcessing}
                className={reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {reviewAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
