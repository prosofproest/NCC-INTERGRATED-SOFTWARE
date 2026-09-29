"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";
import type { CadetSummary } from "@/types/cadet";

interface CreateDataRequestFormProps {
  basePath: "/admin/data-requests" | "/cto/data-requests";
  userRole: "admin" | "cto";
}

export function CreateDataRequestForm({ basePath, userRole }: CreateDataRequestFormProps) {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [deadline, setDeadline] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "specific">("all");
  const [selectedCadetIds, setSelectedCadetIds] = useState<string[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  // Metadata Options
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [cadets, setCadets] = useState<CadetSummary[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Cadets Filter
  const [cadetSearch, setCadetSearch] = useState("");
  const [cadetWingFilter, setCadetWingFilter] = useState<string>("all");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        setIsLoadingOptions(true);
        const res = await fetch("/api/data-requests/options");
        if (!res.ok) {
          throw new Error("Failed to load options.");
        }
        const data = await res.json();
        setCategories(data.categories || []);
        setFields(data.fields || []);
        setCadets(data.cadets || []);
      } catch (err: unknown) {
        const error = err as Error;
        setFormError(error.message || "Failed to load form options.");
      } finally {
        setIsLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  // Filtered Cadets for Specific selection
  const filteredCadets = cadets.filter((c) => {
    if (cadetWingFilter !== "all" && c.wing !== cadetWingFilter) {
      return false;
    }
    if (cadetSearch.trim()) {
      const q = cadetSearch.toLowerCase();
      const inName = c.fullName?.toLowerCase().includes(q);
      const inId = c.cadetId?.toLowerCase().includes(q);
      const inEnroll = c.enrollmentNo?.toLowerCase().includes(q);
      const inUnit = c.unit?.toLowerCase().includes(q);
      return inName || inId || inEnroll || inUnit;
    }
    return true;
  });

  const toggleCadet = (cadetId: string) => {
    setSelectedCadetIds((prev) =>
      prev.includes(cadetId) ? prev.filter((id) => id !== cadetId) : [...prev, cadetId]
    );
  };

  const selectAllFilteredCadets = () => {
    const idsToAdd = filteredCadets.map((c) => c.cadetId);
    setSelectedCadetIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const deselectAllCadets = () => {
    setSelectedCadetIds([]);
  };

  const toggleField = (fieldId: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const toggleCategoryFields = (categoryId: string) => {
    const catFieldIds = fields.filter((f) => f.categoryId === categoryId).map((f) => f.fieldId);
    const allSelected = catFieldIds.every((id) => selectedFieldIds.includes(id));

    if (allSelected) {
      setSelectedFieldIds((prev) => prev.filter((id) => !catFieldIds.includes(id)));
    } else {
      setSelectedFieldIds((prev) => Array.from(new Set([...prev, ...catFieldIds])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim() || title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 3) {
      setFormError("Purpose must be provided (at least 3 characters).");
      return;
    }
    if (selectedFieldIds.length === 0) {
      setFormError("Please select at least one required field to collect.");
      return;
    }
    if (targetMode === "specific" && selectedCadetIds.length === 0) {
      setFormError("Please select at least one target cadet.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        title: title.trim(),
        purpose: purpose.trim(),
        deadline: deadline || undefined,
        targetCadetIds: targetMode === "all" ? "all" : selectedCadetIds,
        requiredFieldIds: selectedFieldIds,
      };

      const res = await fetch("/api/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create data request.");
      }

      // Success -> navigate to request details
      router.push(`${basePath}/${data.requestId}`);
    } catch (err: unknown) {
      const error = err as Error;
      setFormError(error.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  const getWingBadgeVariant = (wing: string): BadgeVariant => {
    if (wing === "Army") return "army";
    if (wing === "Navy") return "navy";
    return "air";
  };

  if (isLoadingOptions) {
    return (
      <Card>
        <div className="p-12 text-center text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-xs">Preparing form options &amp; rosters...</p>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Create Data Request
            </h1>
            <Badge variant="primary" size="sm">
              Stage 9
            </Badge>
            <Badge variant={userRole === "admin" ? "default" : "warning"} size="sm">
              {userRole === "admin" ? "Admin Authoring" : "Officer Authoring"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dispatch a targeted data collection request. Targeted cadets will only be asked for fields they have not yet filled.
          </p>
        </div>

        <Link href={basePath}>
          <Button variant="outline" size="sm" type="button">
            &larr; Cancel
          </Button>
        </Link>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {formError}
        </div>
      )}

      {/* 1. Request Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>1. Campaign Information</CardTitle>
          <CardDescription>
            Specify the title, official purpose, and submission deadline for this collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Request Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mandatory Blood Group & Emergency Contact Verification"
              required
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purpose &amp; Instructions <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Required by NCC Directorate for Annual Training Camp (ATC) medical clearance and logistics."
              required
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:w-1/2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Submission Deadline (Optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Target Cadets Selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>2. Target Cadets</CardTitle>
              <CardDescription>
                Choose whether to target all active cadets or select specific individuals.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Selected:</span>
              <Badge variant="primary" size="sm">
                {targetMode === "all" ? `All Active (${cadets.length})` : `${selectedCadetIds.length} cadets`}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Mode Segmented Radio */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setTargetMode("all")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                targetMode === "all"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <div className="text-xs font-semibold">All Active Cadets</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Target all {cadets.length} currently enrolled active cadets
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetMode("specific")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                targetMode === "specific"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"
              }`}
            >
              <div className="text-xs font-semibold">Specific Cadets</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hand-pick specific cadet profiles
              </div>
            </button>
          </div>

          {/* Specific Cadets Selector Box */}
          {targetMode === "specific" && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Search by name, ID, unit, or enrollment..."
                  value={cadetSearch}
                  onChange={(e) => setCadetSearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <select
                  value={cadetWingFilter}
                  onChange={(e) => setCadetWingFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="all">All Wings</option>
                  <option value="Army">Army Wing</option>
                  <option value="Navy">Navy Wing</option>
                  <option value="Air">Air Wing</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllFilteredCadets}
                    className="text-xs py-1"
                  >
                    Select Visible
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllCadets}
                    className="text-xs py-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Cadets Checklist */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCadets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No active cadets match your filter criteria.
                  </div>
                ) : (
                  filteredCadets.map((cadet) => {
                    const isSelected = selectedCadetIds.includes(cadet.cadetId);
                    return (
                      <label
                        key={cadet.cadetId}
                        className={`p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer text-xs ${
                          isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCadet(cadet.cadetId)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {cadet.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {cadet.cadetId} &bull; {cadet.rank} &bull; {cadet.unit}
                            </div>
                          </div>
                        </div>
                        <Badge variant={getWingBadgeVariant(cadet.wing)} size="sm">
                          {cadet.wing}
                        </Badge>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Required Fields Selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>3. Required Dynamic Fields</CardTitle>
              <CardDescription>
                Select the fields to collect. Per Section 10, cadets who already have a field filled will NOT be asked for it.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Selected:</span>
              <Badge variant="primary" size="sm">
                {selectedFieldIds.length} fields
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((cat) => {
            const catFields = fields.filter((f) => f.categoryId === cat.categoryId);
            if (catFields.length === 0) return null;

            const allCatSelected = catFields.every((f) => selectedFieldIds.includes(f.fieldId));

            return (
              <div key={cat.categoryId} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {cat.name}
                    </h4>
                    <p className="text-[11px] text-slate-400">{cat.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCategoryFields(cat.categoryId)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {allCatSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catFields.map((field) => {
                    const isSelected = selectedFieldIds.includes(field.fieldId);
                    return (
                      <label
                        key={field.fieldId}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition cursor-pointer ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleField(field.fieldId)}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {field.label}
                            </span>
                            {field.validation?.required && (
                              <span className="text-rose-500 text-xs font-bold" title="Core Required">*</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="font-mono text-[10px] text-slate-400">
                              {field.fieldId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                              {field.type}
                            </span>
                            {!field.permissions?.cadetEditable && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium">
                                Officer Managed
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {targetMode === "all" ? (
              <span>Targeting <strong>all {cadets.length}</strong> active cadets</span>
            ) : (
              <span>Targeting <strong>{selectedCadetIds.length}</strong> selected cadets</span>
            )}{" "}
            for <strong>{selectedFieldIds.length}</strong> fields.
          </div>

          <div className="flex items-center gap-3">
            <Link href={basePath}>
              <Button type="button" variant="outline" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || selectedFieldIds.length === 0 || (targetMode === "specific" && selectedCadetIds.length === 0)}
              className="cursor-pointer shadow-sm"
            >
              Dispatch Data Request &rarr;
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
