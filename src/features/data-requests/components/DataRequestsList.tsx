"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface RequestSummary {
  totalTargeted: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number;
}

interface RequestItem {
  requestId: string;
  title: string;
  purpose: string;
  requestedBy: string;
  requesterRole: "admin" | "cto";
  requesterEmail?: string;
  deadline?: string;
  status: "draft" | "open" | "closed";
  createdAt: string;
  summary: RequestSummary;
}

interface DataRequestsListProps {
  basePath: "/admin/data-requests" | "/cto/data-requests";
  userRole: "admin" | "cto";
}

export function DataRequestsList({ basePath, userRole }: DataRequestsListProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const res = await fetch("/api/data-requests");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load data requests.");
        }
        const data = await res.json();
        setRequests(data.requests || []);
      } catch (err: unknown) {
        const error = err as Error;
        setErrorMessage(error.message || "An error occurred while loading requests.");
      } finally {
        setIsLoading(false);
      }
    }

    loadRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const totalRequests = requests.length;
  const openRequests = requests.filter((r) => r.status === "open").length;
  const totalTargetedAll = requests.reduce((acc, r) => acc + (r.summary?.totalTargeted || 0), 0);
  const totalCompletedAll = requests.reduce((acc, r) => acc + (r.summary?.completedCount || 0), 0);
  const overallCompletionRate = totalTargetedAll > 0 ? Math.round((totalCompletedAll / totalTargetedAll) * 100) : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "No deadline";
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
              Data Requests
            </h1>
            <Badge variant="primary" size="sm">
              Section 10
            </Badge>
            <Badge variant={userRole === "admin" ? "default" : "warning"} size="sm">
              {userRole === "admin" ? "Admin Master" : "Officer Portal"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dispatch ad-hoc mandatory data collection batches to targeted cadet rosters. Ask only for what is missing.
          </p>
        </div>

        <Link href={`${basePath}/new`}>
          <Button variant="primary" size="md" className="cursor-pointer shadow-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Data Request
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Requests
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalRequests}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Historical campaigns dispatched</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active / Open
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {openRequests}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Currently collecting responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Response Rate
            </span>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {overallCompletionRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {totalCompletedAll} of {totalTargetedAll} responses submitted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(["all", "open", "closed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
              filter === tab
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab} Requests
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMessage}
        </div>
      )}

      {/* List / Table */}
      {isLoading ? (
        <Card>
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p className="text-xs">Loading data requests...</p>
          </div>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No {filter !== "all" ? filter : ""} data requests found
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a new request to target missing fields from active cadets across your battalion.
            </p>
            <Link href={`${basePath}/new`}>
              <Button variant="outline" size="sm">
                Create First Request
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const isClosed = req.status === "closed";
            const statusBadgeVariant: BadgeVariant = isClosed ? "default" : "success";
            const roleBadgeVariant: BadgeVariant = req.requesterRole === "admin" ? "default" : "warning";

            return (
              <Card
                key={req.requestId}
                className="hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Info */}
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {req.requestId}
                      </span>
                      <Badge variant={statusBadgeVariant} size="sm">
                        {req.status.toUpperCase()}
                      </Badge>
                      <Badge variant={roleBadgeVariant} size="sm">
                        {req.requesterRole.toUpperCase()}
                      </Badge>
                      {req.deadline && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Due: {formatDate(req.deadline)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {req.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {req.purpose}
                    </p>

                    <div className="text-[11px] text-slate-400 pt-1">
                      Created {formatDate(req.createdAt)}
                      {req.requesterEmail ? ` by ${req.requesterEmail}` : ""}
                    </div>
                  </div>

                  {/* Right Column: Progress & Action */}
                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center md:items-end lg:items-center gap-4 min-w-[240px]">
                    <div className="w-full sm:w-44 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Progress</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {req.summary.completedCount} / {req.summary.totalTargeted} ({req.summary.completionRate}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            req.summary.completionRate === 100
                              ? "bg-emerald-500"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${req.summary.completionRate}%` }}
                        />
                      </div>
                    </div>

                    <Link href={`${basePath}/${req.requestId}`}>
                      <Button variant="outline" size="sm" className="whitespace-nowrap cursor-pointer">
                        View Details &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
