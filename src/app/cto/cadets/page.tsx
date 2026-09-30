"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { CadetRecord } from "@/types/cadet";

export default function CtoCadetsPage() {
  const [cadets, setCadets] = useState<CadetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchCadetsData = useCallback(async (p: number, s: string, status: string, year: string, div: string) => {
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: "10",
        search: s,
        status,
        trainingYear: year,
        division: div,
      });

      const res = await fetch(`/api/cto/cadets?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}: Failed to fetch cadets`);
      }

      const data = await res.json();
      return {
        cadets: data.cadets || [],
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      };
    } catch (err: unknown) {
      throw err;
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchCadetsData(page, debouncedSearch, statusFilter, yearFilter, divisionFilter)
      .then((data) => {
        if (!ignore) {
          setCadets(data.cadets);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load cadets");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, statusFilter, yearFilter, divisionFilter, fetchCadetsData]);

  const getWingVariant = (wing: string): BadgeVariant => {
    return wing === "Air" ? "air" : "default";
  };

  const getStatusVariant = (status: string): BadgeVariant => {
    switch (status) {
      case "active":
        return "success";
      case "suspended":
        return "danger";
      case "inactive":
        return "warning";
      case "passed_out":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cadets Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Officer search and verification index. Inspect battalion cadet records with officer visibility privileges.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {cadets.length} of {total} cadets
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, cadet ID, enrollment, unit..."
                aria-label="Search cadets by name, ID, enrollment, or unit"
                className="w-full pl-10 pr-9 py-2 min-h-[44px] sm:min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search input"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700 min-h-[44px] min-w-[36px] justify-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0071E3] rounded-md"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter cadets by status"
                className="w-full px-3 py-2 min-h-[44px] sm:min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="passed_out">Passed Out</option>
              </select>
            </div>

            {/* Training Year Filter */}
            <div className="sm:col-span-2">
              <select
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter cadets by training year"
                className="w-full px-3 py-2 min-h-[44px] sm:min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition cursor-pointer"
              >
                <option value="all">All Training Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
              </select>
            </div>

            {/* Division Filter */}
            <div className="sm:col-span-2">
              <select
                value={divisionFilter}
                onChange={(e) => {
                  setDivisionFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter cadets by division (SD / SW)"
                className="w-full px-3 py-2 min-h-[44px] sm:min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition cursor-pointer"
              >
                <option value="all">All Divisions</option>
                <option value="SD">SD (Senior Div)</option>
                <option value="SW">SW (Senior Wing)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <Card>
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-medium">Loading cadet records...</span>
          </div>
        </Card>
      ) : cadets.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No Cadets Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No cadet records match your current filter or search criteria.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setYearFilter("all");
                setDivisionFilter("all");
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Cadet ID</th>
                      <th className="px-6 py-3.5">Name</th>
                      <th className="px-6 py-3.5">Enrollment No</th>
                      <th className="px-6 py-3.5">Rank</th>
                      <th className="px-6 py-3.5">Year &amp; Div</th>
                      <th className="px-6 py-3.5">Unit</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Profile %</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {cadets.map((cadet) => (
                      <tr
                        key={cadet.cadetId}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-xs text-slate-900">
                          {cadet.cadetId}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {cadet.fullName}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600">
                          {cadet.enrollmentNo || <span className="italic text-slate-400">Pending</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-800">
                            {cadet.rank}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              {cadet.trainingYear || "1st Year"}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              {cadet.division || "SD"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {cadet.unit}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(cadet.status)} size="sm">
                            {cadet.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${cadet.completionPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-500">
                              {cadet.completionPercentage || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/cto/cadets/${cadet.cadetId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                          >
                            View Record &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile & Tablet Card View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {cadets.map((cadet) => (
              <Card key={cadet.cadetId} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {cadet.cadetId}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {cadet.fullName}
                    </h3>
                  </div>
                  <Badge variant={getStatusVariant(cadet.status)} size="sm">
                    {cadet.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-100">
                  <Badge variant={getWingVariant(cadet.wing)} size="sm">
                    {cadet.wing}
                  </Badge>
                  <span className="text-slate-600 font-medium">
                    {cadet.rank}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500 truncate max-w-[160px]">{cadet.unit}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Profile:</span>
                    <span className="font-semibold text-slate-600">
                      {cadet.completionPercentage || 0}%
                    </span>
                  </div>

                  <Link
                    href={`/cto/cadets/${cadet.cadetId}`}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next &rarr;
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
