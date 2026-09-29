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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Change Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track profile modification requests submitted for verified regimental attributes.
          </p>
        </div>

        <Link href="/cadet/profile">
          <Button variant="primary" size="sm">
            View Profile &rarr;
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
          {error}
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
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
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
      ) : (
        <div className="space-y-4">
          {changeRequests.map((cr) => (
            <Card key={cr.changeRequestId} className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                    {cr.changeRequestId}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Field: {cr.fieldLabel}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(cr.status)} size="sm">
                    {cr.status}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {new Date(cr.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Previous / Old Value:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {cr.oldValue ? String(cr.oldValue) : <span className="italic text-slate-400">None</span>}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-1">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Requested New Value:</span>
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    {String(cr.newValue)}
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <span className="text-slate-400 font-medium">Reason for Request:</span>
                <p className="text-slate-700 dark:text-slate-300 italic">
                  &ldquo;{cr.reason}&rdquo;
                </p>
              </div>

              {cr.reviewerComments && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs space-y-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Reviewer Notes:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">{cr.reviewerComments}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
