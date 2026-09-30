"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  type AuditLogEntry,
  type AuditActorRole,
  ALL_ENTITY_TYPES,
  COMMON_ACTION_TYPES,
} from "@/types/audit";
import { AuditDetailModal } from "./AuditDetailModal";

interface AuditStats {
  totalLogs: number;
  cadetLogs: number;
  documentLogs: number;
  userLogs: number;
}

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalLogs: 0,
    cadetLogs: 0,
    documentLogs: 0,
    userLogs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters State
  const [actorSearch, setActorSearch] = useState("");
  const [actorRoleFilter, setActorRoleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);

  // Pagination State (Cursor-based)
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);

  // Selected Log for Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchLogs = useCallback(
    async (cursor: string | null = null, isNewSearch = false) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const params = new URLSearchParams();
        params.set("limit", pageSize.toString());
        if (cursor) params.set("cursor", cursor);
        if (actorSearch.trim()) params.set("actor", actorSearch.trim());
        if (actorRoleFilter !== "all") params.set("actorRole", actorRoleFilter);
        if (actionFilter !== "all") params.set("action", actionFilter);
        if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (isNewSearch) params.set("includeStats", "true");

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load audit logs.");
        }

        const data = await res.json();
        setLogs(data.logs || []);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));

        if (data.stats) {
          setStats(data.stats);
        }

        if (isNewSearch) {
          setCurrentPage(1);
          setCursorHistory([null]);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setErrorMessage(error.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    },
    [
      pageSize,
      actorSearch,
      actorRoleFilter,
      actionFilter,
      entityTypeFilter,
      startDate,
      endDate,
    ]
  );

  // Initial load
  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        params.set("limit", pageSize.toString());
        params.set("includeStats", "true");

        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load audit logs.");
        }

        const data = await res.json();
        if (!ignore) {
          setLogs(data.logs || []);
          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          if (data.stats) setStats(data.stats);
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (!ignore) setErrorMessage(error.message || "Failed to load audit logs.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadInitial();
    return () => {
      ignore = true;
    };
  }, [pageSize]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(null, true);
  };

  const handleClearFilters = () => {
    setActorSearch("");
    setActorRoleFilter("all");
    setActionFilter("all");
    setEntityTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
    setCursorHistory([null]);

    // Fetch unfiltered
    setTimeout(() => {
      fetch("/api/admin/audit-logs?limit=" + pageSize + "&includeStats=true")
        .then((r) => r.json())
        .then((data) => {
          setLogs(data.logs || []);
          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          if (data.stats) setStats(data.stats);
        })
        .catch((err) => console.error(err));
    }, 0);
  };

  const handleNextPage = () => {
    if (!nextCursor || !hasMore) return;
    const nextHistory = [...cursorHistory, nextCursor];
    setCursorHistory(nextHistory);
    setCurrentPage(currentPage + 1);
    fetchLogs(nextCursor);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    const prevHistory = [...cursorHistory];
    prevHistory.pop(); // remove current page cursor
    const prevCursor = prevHistory[prevHistory.length - 1] || null;
    setCursorHistory(prevHistory);
    setCurrentPage(currentPage - 1);
    fetchLogs(prevCursor);
  };

  const openDetailModal = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const getRoleBadgeVariant = (role: AuditActorRole): BadgeVariant => {
    switch (role) {
      case "admin":
        return "primary";
      case "cto":
        return "warning";
      case "cadet":
        return "air";
      case "system":
      default:
        return "default";
    }
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Total Audit Events
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {stats.totalLogs}
              </div>
              <p className="text-[10px] text-slate-500">Immutable recorded actions</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 text-lg">
              🛡️
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">
                Cadet Operations
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {stats.cadetLogs}
              </div>
              <p className="text-[10px] text-slate-500">Profile edits & requests</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              👥
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase">
                Document Audits
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {stats.documentLogs}
              </div>
              <p className="text-[10px] text-slate-500">Uploads & verifications</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
              📄
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-amber-600 uppercase">
                User / Role Events
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {stats.userLogs}
              </div>
              <p className="text-[10px] text-slate-500">Logins, roles & CTO accounts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
              🔑
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Filter Bar */}
      <Card className="border-slate-200/80 bg-white shadow-xs">
        <CardContent className="p-5">
          <form onSubmit={handleApplyFilters} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Actor Search */}
              <div className="lg:col-span-2 space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Actor (Email / UID)
                </label>
                <input
                  type="text"
                  placeholder="Search by email or UID..."
                  value={actorSearch}
                  onChange={(e) => setActorSearch(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Type */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Action Type
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Actions</option>
                  {COMMON_ACTION_TYPES.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Entity Type
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Entities</option>
                  {ALL_ENTITY_TYPES.map((ent) => (
                    <option key={ent} value={ent}>
                      {ent}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actor Role */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Actor Role
                </label>
                <select
                  value={actorRoleFilter}
                  onChange={(e) => setActorRoleFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="cto">CTO</option>
                  <option value="cadet">Cadet</option>
                  <option value="system">System</option>
                </select>
              </div>

              {/* Page Size */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  Page Size
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value={15}>15 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                </select>
              </div>
            </div>

            {/* Date Range & Buttons Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 uppercase">
                  Date Range:
                </span>
                <input
                  type="date"
                  aria-label="Filter audit logs by start date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1.5 min-h-[38px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3]"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  aria-label="Filter audit logs by end date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1.5 min-h-[38px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  aria-label="Reset all audit log filters"
                  className="px-3 py-2 min-h-[38px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] transition cursor-pointer"
                >
                  Clear Filters
                </button>
                <button
                  type="submit"
                  aria-label="Apply audit log filters"
                  className="px-4 py-2 min-h-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2 transition cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

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

      {/* 3. Audit Logs Data Table / Card View */}
      <Card className="border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Audit History Log
            </h2>
            <Badge variant="outline" size="sm">
              Page {currentPage}
            </Badge>
            <span className="text-xs text-slate-500">
              ({logs.length} record{logs.length === 1 ? "" : "s"} shown)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 hidden sm:inline">
              Sorted newest first
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isLoading}
                className="px-2.5 py-1 text-xs rounded font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                &larr; Prev
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasMore || isLoading}
                className="px-2.5 py-1 text-xs rounded font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            <p>Loading security audit entries...</p>
          </div>
        ) : logs.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center space-y-3">
            <div className="text-3xl">🔍</div>
            <h3 className="text-sm font-medium text-slate-800">
              No audit records match the current filters
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your date range, entity type, action type, or clearing your actor search filter.
            </p>
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Log ID & Time</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">State Changes</th>
                    <th className="py-3 px-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const hasDiff = Boolean(log.previousState || log.newState);
                    return (
                      <tr
                        key={log.logId}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Log ID & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-900">
                            {log.logId}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant={getRoleBadgeVariant(log.actorRole)} size="sm">
                              {log.actorRole.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-slate-700 max-w-[160px] truncate" title={log.actorEmail}>
                            {log.actorEmail}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-[11px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </td>

                        {/* Entity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant="primary" size="sm">
                              {log.entityType}
                            </Badge>
                          </div>
                          <div className="font-mono text-slate-600 max-w-[140px] truncate" title={log.entityId}>
                            {log.entityId}
                          </div>
                        </td>

                        {/* State Changes */}
                        <td className="py-3 px-4">
                          {hasDiff ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <span>✓</span> State Recorded
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No delta</span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openDetailModal(log)}
                            className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer text-xs"
                          >
                            View Details &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Fallback */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.logId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {log.logId}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                    <Badge variant={getRoleBadgeVariant(log.actorRole)} size="sm">
                      {log.actorRole.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {log.action}
                    </span>
                    <Badge variant="primary" size="sm">
                      {log.entityType}
                    </Badge>
                    <span className="font-mono text-slate-600 text-[11px] truncate max-w-[140px]">
                      {log.entityId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 truncate max-w-[180px]">
                      {log.actorEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDetailModal(log)}
                      className="text-blue-600 font-medium hover:underline cursor-pointer"
                    >
                      View Details &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Page {currentPage} {hasMore ? "• More records available" : "• End of results"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!hasMore || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* 4. Detail Modal */}
      <AuditDetailModal
        log={selectedLog}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
}
