"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ChangeRequest } from "@/types/request";

export default function CadetChangeRequestsPage() {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchRequests = useCallback(async () => {
    const res = await fetch("/api/cadet/change-requests");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load change requests");
    }
    const data = await res.json();
    return data.changeRequests || [];
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchRequests()
      .then((crs) => {
        if (!ignore) {
          setChangeRequests(crs);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load requests");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [fetchRequests]);

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

  const filteredRequests = changeRequests.filter((cr) => {
    if (filter === "all") return true;
    return cr.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Change Requests
            </h1>
            <Badge variant="primary" size="sm">
              Section 11
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track profile modification requests submitted for protected regimental attributes and review administrator decisions.
          </p>
        </div>

        <Link href="/cadet/profile">
          <Button variant="primary" size="sm">
            View Profile &rarr;
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      {!loading && changeRequests.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab === "all" ? `All (${changeRequests.length})` : `${tab} (${changeRequests.filter((r) => r.status === tab).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <Card className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-medium">Loading change requests...</span>
        </Card>
      ) : changeRequests.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              No Change Requests Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven&apos;t submitted any modification requests yet. To request a change for protected fields, visit your profile and click &quot;Request Change&quot;.
            </p>
            <Link href="/cadet/profile">
              <Button variant="outline" size="sm">
                Go to Profile
              </Button>
            </Link>
          </div>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-slate-500 text-xs">
            No change requests found with status &quot;{filter}&quot;.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((cr) => (
            <Card key={cr.changeRequestId} className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                    {cr.changeRequestId}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Field: {cr.fieldLabel}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(cr.status)} size="sm">
                    {cr.status.toUpperCase()}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    Submitted: {formatDate(cr.requestedAt || cr.createdAt)}
                  </span>
                </div>
              </div>

              {/* Status Outcome Banner */}
              {cr.status === "rejected" && (
                <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Request Rejected by Administrator</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <span className="text-[11px] font-semibold text-rose-900 block">
                      Reason for Rejection:
                    </span>
                    <p className="text-xs text-rose-800 italic font-medium">
                      &ldquo;{cr.reviewerComments || "No specific comments provided."}&rdquo;
                    </p>
                    {cr.reviewedAt && (
                      <span className="text-[10px] text-rose-600 block pt-1">
                        Reviewed on {formatDate(cr.reviewedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {cr.status === "approved" && (
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Request Approved &amp; Applied to Profile</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <p className="text-xs text-emerald-800">
                      The approved value <strong className="font-mono">{String(cr.newValue)}</strong> has been updated in your master profile for <strong>{cr.fieldLabel}</strong>.
                    </p>
                    {cr.reviewerComments && (
                      <p className="text-xs text-emerald-700 italic pt-0.5">
                        Admin Note: &ldquo;{cr.reviewerComments}&rdquo;
                      </p>
                    )}
                    {cr.reviewedAt && (
                      <span className="text-[10px] text-emerald-600 block pt-1">
                        Approved on {formatDate(cr.reviewedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {cr.status === "pending" && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-2 text-xs text-amber-800">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This request is awaiting review by Battalion Administrators.</span>
                </div>
              )}

              {/* Value Diff Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium">Previous / Old Value:</span>
                  <p className="font-semibold text-slate-800">
                    {cr.oldValue ? String(cr.oldValue) : <span className="italic text-slate-400">None</span>}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                  <span className="text-blue-600 font-medium">Requested New Value:</span>
                  <p className="font-semibold text-blue-900 font-mono">
                    {String(cr.newValue)}
                  </p>
                </div>
              </div>

              {/* Cadet Reason */}
              <div className="text-xs space-y-1">
                <span className="text-slate-400 font-medium">Your Reason for Request:</span>
                <p className="text-slate-700 italic">
                  &ldquo;{cr.reason}&rdquo;
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
