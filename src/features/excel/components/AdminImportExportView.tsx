"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  CadetImportRow,
  CadetImportSummary,
  EnrollmentImportRow,
  EnrollmentImportSummary,
  ExportFieldOption,
} from "@/types/excel";

export function AdminImportExportView() {
  const [activeTab, setActiveTab] = useState<"onboarding" | "enrollment" | "export">("onboarding");

  // ==========================================
  // 1. Cadet Onboarding Import State
  // ==========================================
  const [onboardingFile, setOnboardingFile] = useState<File | null>(null);
  const [uploadTrainingYear, setUploadTrainingYear] = useState<"1st Year" | "2nd Year" | "3rd Year">("1st Year");
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [isParsingOnboarding, setIsParsingOnboarding] = useState(false);
  const [onboardingRows, setOnboardingRows] = useState<CadetImportRow[] | null>(null);
  const [onboardingSummary, setOnboardingSummary] = useState<CadetImportSummary | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const [isImportingCadets, setIsImportingCadets] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    failedCount: number;
    createdCadets: Array<{ cadetId: string; email: string; fullName: string; enrollmentNo: string | null; emailSent: boolean; emailError?: string }>;
    failedCadets: Array<{ email: string; name: string; error: string }>;
  } | null>(null);

  // ==========================================
  // 2. Enrollment Numbers Import State
  // ==========================================
  const [enrollmentFile, setEnrollmentFile] = useState<File | null>(null);
  const [isParsingEnrollment, setIsParsingEnrollment] = useState(false);
  const [enrollmentRows, setEnrollmentRows] = useState<EnrollmentImportRow[] | null>(null);
  const [enrollmentSummary, setEnrollmentSummary] = useState<EnrollmentImportSummary | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  // Map of rowNumber -> selected cadetId for ambiguous cases
  const [ambiguousSelections, setAmbiguousSelections] = useState<Record<number, string>>({});

  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false);
  const [enrollmentUpdateResult, setEnrollmentUpdateResult] = useState<{
    updatedCount: number;
    updatedCadetIds: string[];
  } | null>(null);

  // ==========================================
  // 3. Export State
  // ==========================================
  const [exportFields, setExportFields] = useState<ExportFieldOption[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [exportYear, setExportYear] = useState("all");
  const [exportDivision, setExportDivision] = useState("all");
  const [exportStatus, setExportStatus] = useState("all");
  const [exportSearch, setExportSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load export options
  useEffect(() => {
    async function loadExportOptions() {
      try {
        const res = await fetch("/api/data-export/options");
        if (res.ok) {
          const data = await res.json();
          const all = data.allAvailableFields || [];
          setExportFields(all);
          // Default: select core fields
          const defaultSelected = all
            .filter((f: ExportFieldOption) => f.isCore)
            .map((f: ExportFieldOption) => f.id);
          setSelectedFieldIds(defaultSelected);
        }
      } catch (err) {
        console.error("Failed to load export options:", err);
      }
    }
    loadExportOptions();
  }, []);

  // ------------------------------------------
  // Handlers: Cadet Onboarding
  // ------------------------------------------
  const parseFileWithConfig = async (
    file: File,
    year: "1st Year" | "2nd Year" | "3rd Year",
    sheet?: string
  ) => {
    setIsParsingOnboarding(true);
    setOnboardingError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("trainingYear", year);
      if (sheet) {
        formData.append("sheetName", sheet);
      }

      const res = await fetch("/api/admin/excel/parse-onboarding", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse onboarding file.");
      }

      setOnboardingRows(data.rows);
      setOnboardingSummary(data.summary);
      setSelectedSheet(data.summary.detectedSheet);
    } catch (err: unknown) {
      setOnboardingError((err as Error).message);
      setOnboardingRows(null);
      setOnboardingSummary(null);
    } finally {
      setIsParsingOnboarding(false);
    }
  };

  const handleOnboardingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOnboardingFile(file);
    await parseFileWithConfig(file, uploadTrainingYear);
  };

  const handleSheetChange = async (newSheet: string) => {
    if (!onboardingFile) return;
    setSelectedSheet(newSheet);
    await parseFileWithConfig(onboardingFile, uploadTrainingYear, newSheet);
  };

  const handleTrainingYearChange = async (newYear: "1st Year" | "2nd Year" | "3rd Year") => {
    setUploadTrainingYear(newYear);
    if (onboardingFile) {
      await parseFileWithConfig(onboardingFile, newYear, selectedSheet || undefined);
    }
  };

  const handleConfirmImport = async () => {
    if (!onboardingRows) return;
    const validCadets = onboardingRows
      .filter((r) => r.isValid)
      .map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone,
        enrollmentNo: r.enrollmentNo || null,
        trainingYear: r.trainingYear,
        division: r.division,
        gender: r.gender || null,
      }));

    if (validCadets.length === 0) return;

    try {
      setIsImportingCadets(true);
      setOnboardingError(null);

      const CHUNK_SIZE = 15;
      const totalCadets = validCadets.length;
      let totalCreated = 0;
      let totalFailed = 0;
      const allCreatedCadets: Array<{
        cadetId: string;
        email: string;
        fullName: string;
        enrollmentNo: string | null;
        emailSent: boolean;
        emailError?: string;
      }> = [];
      const allFailedCadets: Array<{ email: string; name: string; error: string }> = [];

      for (let i = 0; i < totalCadets; i += CHUNK_SIZE) {
        const chunk = validCadets.slice(i, i + CHUNK_SIZE);
        const processed = Math.min(i + CHUNK_SIZE, totalCadets);
        setImportProgress({
          current: processed,
          total: totalCadets,
          percent: Math.round((processed / totalCadets) * 100),
        });

        const res = await fetch("/api/admin/excel/import-cadets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cadets: chunk }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to import batch.");
        }

        totalCreated += data.createdCount || 0;
        totalFailed += data.failedCount || 0;
        if (Array.isArray(data.createdCadets)) {
          allCreatedCadets.push(...data.createdCadets);
        }
        if (Array.isArray(data.failedCadets)) {
          allFailedCadets.push(...data.failedCadets);
        }
      }

      setImportResult({
        createdCount: totalCreated,
        failedCount: totalFailed,
        createdCadets: allCreatedCadets,
        failedCadets: allFailedCadets,
      });

      setOnboardingRows(null);
      setOnboardingSummary(null);
      setOnboardingFile(null);
    } catch (err: unknown) {
      setOnboardingError((err as Error).message);
    } finally {
      setIsImportingCadets(false);
      setImportProgress(null);
    }
  };

  // ------------------------------------------
  // Handlers: Enrollment Import
  // ------------------------------------------
  const handleEnrollmentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnrollmentFile(file);
    setEnrollmentError(null);
    setEnrollmentUpdateResult(null);
    setIsParsingEnrollment(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/excel/parse-enrollment", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse enrollment file.");
      }

      setEnrollmentRows(data.rows);
      setEnrollmentSummary(data.summary);
      setAmbiguousSelections({});
    } catch (err: unknown) {
      setEnrollmentError((err as Error).message);
      setEnrollmentRows(null);
      setEnrollmentSummary(null);
    } finally {
      setIsParsingEnrollment(false);
    }
  };

  const handleConfirmEnrollmentUpdates = async () => {
    if (!enrollmentRows) return;

    const updates: Array<{ cadetId: string; enrollmentNo: string }> = [];

    for (const r of enrollmentRows) {
      let resolvedId: string | null = null;
      if (r.matchStatus === "exact" && r.matchedCadetId) {
        resolvedId = r.matchedCadetId;
      } else if (r.matchStatus === "ambiguous" && ambiguousSelections[r.rowNumber]) {
        resolvedId = ambiguousSelections[r.rowNumber];
      }

      if (resolvedId && r.enrollmentNo) {
        updates.push({
          cadetId: resolvedId,
          enrollmentNo: r.enrollmentNo,
        });
      }
    }

    if (updates.length === 0) {
      setEnrollmentError("No valid cadet matches to update. Please resolve matches first.");
      return;
    }

    try {
      setIsUpdatingEnrollment(true);
      setEnrollmentError(null);

      const res = await fetch("/api/admin/excel/update-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update enrollment numbers.");
      }

      setEnrollmentUpdateResult(data);
      setEnrollmentRows(null);
      setEnrollmentSummary(null);
      setEnrollmentFile(null);
    } catch (err: unknown) {
      setEnrollmentError((err as Error).message);
    } finally {
      setIsUpdatingEnrollment(false);
    }
  };

  // ------------------------------------------
  // Handlers: Export
  // ------------------------------------------
  const handleToggleField = (fieldId: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleSelectAllFields = () => {
    setSelectedFieldIds(exportFields.map((f) => f.id));
  };

  const handleDeselectAllFields = () => {
    setSelectedFieldIds([]);
  };

  const handleDownloadExport = async () => {
    if (selectedFieldIds.length === 0) {
      setExportError("Please select at least one field to export.");
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);

      const res = await fetch("/api/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedFieldIds,
          trainingYear: exportYear !== "all" ? exportYear : undefined,
          division: exportDivision !== "all" ? exportDivision : undefined,
          status: exportStatus !== "all" ? exportStatus : undefined,
          search: exportSearch.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate export file.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ncc_cadets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // Group export fields by category
  const groupedFields: Record<string, ExportFieldOption[]> = {};
  for (const f of exportFields) {
    if (!groupedFields[f.category]) {
      groupedFields[f.category] = [];
    }
    groupedFields[f.category].push(f);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Excel Import &amp; Export
            </h1>
            <Badge variant="default" size="sm">
              Admin Exclusive
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Perform bulk cadet onboarding with smart sheet auto-detection, regimental enrollment assignment, and nominal roll data exports.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("onboarding")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "onboarding"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          1. Cadet Account Onboarding
        </button>
        <button
          onClick={() => setActiveTab("enrollment")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "enrollment"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          2. Add or fix Enrollment IDs for existing cadets
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "export"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          3. Cadet Data Export
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CADET ONBOARDING IMPORT */}
      {/* ========================================================================= */}
      {activeTab === "onboarding" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    Smart Cadet Account Ingestion
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload any Cadet spreadsheet. The system auto-detects sheets, headers, float phones, uppercase Enrollment IDs, and derives Division from Gender.
                  </CardDescription>
                </div>
                <a href="/api/admin/excel/templates?type=onboarding" download>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 cursor-pointer">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Template (.xlsx)
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {onboardingError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <div className="font-bold mb-0.5">Spreadsheet Validation Notice</div>
                  <div>{onboardingError}</div>
                </div>
              )}

              {importResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Import Completed</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Successfully created <strong>{importResult.createdCount}</strong> cadet accounts.
                  </p>

                  {/* Email failures list if any */}
                  {importResult.createdCadets.some((c) => !c.emailSent) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                      <div className="font-semibold">⚠️ Some invite emails could not be sent immediately:</div>
                      <div className="text-[11px] text-amber-700">
                        {importResult.createdCadets
                          .filter((c) => !c.emailSent)
                          .map((c) => `${c.fullName} (${c.email})`)
                          .join(", ")}
                      </div>
                      <div className="text-[10px] text-amber-600 italic">
                        The cadet accounts exist and are fully functional. You can use the &quot;Resend Welcome Email&quot; button in Cadet Details at any time.
                      </div>
                    </div>
                  )}

                  {importResult.failedCount > 0 && (
                    <p className="text-xs text-rose-700 font-medium">
                      Notice: {importResult.failedCount} rows encountered errors and were skipped.
                    </p>
                  )}
                </div>
              )}

              {/* Training Year selector at upload */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Target Training Year for this Upload <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Applied to all imported rows (if the spreadsheet has a Year column, the row value takes precedence).
                  </p>
                </div>
                <select
                  value={uploadTrainingYear}
                  onChange={(e) => handleTrainingYearChange(e.target.value as "1st Year" | "2nd Year" | "3rd Year")}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 cursor-pointer focus:ring-2 focus:ring-slate-900"
                >
                  <option value="1st Year">1st Year (New Cadets)</option>
                  <option value="2nd Year">2nd Year Cadets</option>
                  <option value="3rd Year">3rd Year Cadets</option>
                </select>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 text-center hover:bg-slate-50/50 transition">
                <input
                  type="file"
                  id="onboarding-upload"
                  accept=".xlsx, .xls"
                  onChange={handleOnboardingFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="onboarding-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {onboardingFile ? onboardingFile.name : "Click to select or drop an Excel spreadsheet (.xlsx)"}
                  </span>
                  <span className="text-xs text-slate-400">
                    Supported format: Genuine Microsoft Excel (.xlsx). Auto-scans all sheets and header variations.
                  </span>
                </label>
              </div>

              {isParsingOnboarding && (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Inspecting all sheets, matching columns, and verifying constraints...</p>
                </div>
              )}

              {/* Chunked Progress Bar */}
              {isImportingCadets && importProgress && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Importing Cadet Accounts...</span>
                    <span>{importProgress.current} of {importProgress.total} ({importProgress.percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Validation Summary & Preview Table */}
              {onboardingSummary && onboardingRows && (
                <div className="space-y-4 pt-2">
                  {/* Sheet Selector & Column Mapping Banner */}
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-900">
                          Using sheet: &quot;{onboardingSummary.detectedSheet}&quot;
                        </span>
                        <Badge variant="outline" size="sm">
                          Auto-Detected
                        </Badge>
                      </div>
                      {onboardingSummary.allSheets.length > 1 && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-blue-800 font-medium">Switch sheet:</label>
                          <select
                            value={selectedSheet || onboardingSummary.detectedSheet}
                            onChange={(e) => handleSheetChange(e.target.value)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-blue-300 bg-white font-medium text-slate-800 cursor-pointer"
                          >
                            {onboardingSummary.allSheets.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Column Mapping Badges */}
                    <div className="text-xs text-slate-700">
                      <div className="font-semibold text-slate-800 mb-1.5">Detected Column Mappings:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(onboardingSummary.columnMapping).map(([key, colName]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 rounded-md bg-white border border-blue-200 font-mono text-[11px] text-blue-900"
                          >
                            <span className="font-semibold uppercase text-slate-600">{key}:</span> {colName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-semibold uppercase text-slate-500">Total Rows</span>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        {onboardingSummary.totalRows}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-center">
                      <span className="text-[10px] font-semibold uppercase text-emerald-700">
                        Ready to Create
                      </span>
                      <div className="text-lg font-bold text-emerald-600 mt-0.5">
                        {onboardingSummary.validCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-center">
                      <span className="text-[10px] font-semibold uppercase text-amber-700">
                        Warnings
                      </span>
                      <div className="text-lg font-bold text-amber-600 mt-0.5">
                        {onboardingSummary.warningCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-center">
                      <span className="text-[10px] font-semibold uppercase text-rose-700">
                        Errors (Skipped)
                      </span>
                      <div className="text-lg font-bold text-rose-600 mt-0.5">
                        {onboardingSummary.errorCount}
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">Row</th>
                            <th className="px-3 py-2.5">Name</th>
                            <th className="px-3 py-2.5">Email</th>
                            <th className="px-3 py-2.5">Phone</th>
                            <th className="px-3 py-2.5">Enrollment ID</th>
                            <th className="px-3 py-2.5">Year</th>
                            <th className="px-3 py-2.5">Div</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {onboardingRows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={
                                !row.isValid
                                  ? "bg-rose-50/30 hover:bg-rose-50/50"
                                  : row.warnings.length > 0
                                  ? "bg-amber-50/20 hover:bg-amber-50/40"
                                  : "hover:bg-slate-50/60"
                              }
                            >
                              <td className="px-3 py-2 font-mono text-slate-400">{row.rowNumber}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">
                                {row.name}
                              </td>
                              <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                                {row.email}
                              </td>
                              <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                                {row.phone}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-900 text-[11px]">
                                {row.enrollmentNo || <span className="text-slate-400 font-normal italic">None</span>}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-700">
                                {row.trainingYear}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-700">
                                {row.division}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant={
                                    !row.isValid
                                      ? "danger"
                                      : row.warnings.length > 0
                                      ? "warning"
                                      : "success"
                                  }
                                  size="sm"
                                >
                                  {!row.isValid ? "ERROR" : row.warnings.length > 0 ? "WARNING" : "VALID"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-[11px]">
                                {!row.isValid ? (
                                  <span className="text-rose-600 font-medium">
                                    {row.errors.join("; ")}
                                  </span>
                                ) : row.warnings.length > 0 ? (
                                  <span className="text-amber-700 font-medium">
                                    {row.warnings.join("; ")}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-medium">Ready to create</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Confirmation Button */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      Import executes in chunks of 15. Only valid rows will be provisioned.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleConfirmImport}
                      disabled={onboardingSummary.validCount === 0 || isImportingCadets}
                      isLoading={isImportingCadets}
                      className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      Confirm &amp; Import {onboardingSummary.validCount} Cadets
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ENROLLMENT NUMBERS IMPORT */}
      {/* ========================================================================= */}
      {activeTab === "enrollment" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    Add or fix Enrollment IDs for existing cadets
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Use this only when you need to assign or update regimental enrollment numbers for cadets who are already enrolled in the system.
                  </CardDescription>
                </div>
                <a href="/api/admin/excel/templates?type=enrollment" download>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 cursor-pointer">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Enrollment Template (.xlsx)
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {enrollmentError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {enrollmentError}
                </div>
              )}

              {enrollmentUpdateResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Enrollment Numbers Updated Successfully</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Updated official regimental enrollment numbers for <strong>{enrollmentUpdateResult.updatedCount}</strong> cadets.
                  </p>
                </div>
              )}

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 text-center hover:bg-slate-50/50 transition">
                <input
                  type="file"
                  id="enrollment-upload"
                  accept=".xlsx, .xls"
                  onChange={handleEnrollmentFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="enrollment-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {enrollmentFile ? enrollmentFile.name : "Select Enrollment Spreadsheet (.xlsx)"}
                  </span>
                  <span className="text-xs text-slate-400">
                    The system will automatically match names against enrolled cadets. Ambiguous names will require manual selection.
                  </span>
                </label>
              </div>

              {isParsingEnrollment && (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Matching cadets against master database and checking uniqueness...</p>
                </div>
              )}

              {/* Enrollment Preview & Disambiguation */}
              {enrollmentSummary && enrollmentRows && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-semibold uppercase text-slate-500">Total</span>
                      <div className="text-lg font-bold text-slate-900">{enrollmentSummary.totalRows}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <span className="text-[10px] font-semibold uppercase text-emerald-700">Exact Match</span>
                      <div className="text-lg font-bold text-emerald-600">{enrollmentSummary.exactCount}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                      <span className="text-[10px] font-semibold uppercase text-amber-700">Ambiguous</span>
                      <div className="text-lg font-bold text-amber-600">{enrollmentSummary.ambiguousCount}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                      <span className="text-[10px] font-semibold uppercase text-rose-700">Unmatched / Error</span>
                      <div className="text-lg font-bold text-rose-600">{enrollmentSummary.unmatchedCount + enrollmentSummary.invalidCount}</div>
                    </div>
                  </div>

                  {/* Matching Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="px-4 py-2.5">Row</th>
                            <th className="px-4 py-2.5">Name in Sheet</th>
                            <th className="px-4 py-2.5">Enrollment No</th>
                            <th className="px-4 py-2.5">Match Status</th>
                            <th className="px-4 py-2.5">Matched Cadet / Disambiguation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {enrollmentRows.map((row) => (
                            <tr key={row.rowNumber} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2 font-mono text-slate-400">{row.rowNumber}</td>
                              <td className="px-4 py-2 font-semibold text-slate-800">{row.name}</td>
                              <td className="px-4 py-2 font-mono font-bold text-slate-900">{row.enrollmentNo}</td>
                              <td className="px-4 py-2">
                                <Badge
                                  variant={
                                    row.matchStatus === "exact"
                                      ? "success"
                                      : row.matchStatus === "ambiguous"
                                      ? "warning"
                                      : "danger"
                                  }
                                  size="sm"
                                >
                                  {row.matchStatus.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">
                                {row.matchStatus === "exact" && (
                                  <span className="font-mono text-slate-700 font-medium">
                                    {row.matchedCadetId} ({row.candidateCadets?.[0]?.rank} • {row.candidateCadets?.[0]?.wing})
                                  </span>
                                )}

                                {row.matchStatus === "ambiguous" && row.candidateCadets && (
                                  <div className="space-y-1">
                                    <select
                                      value={ambiguousSelections[row.rowNumber] || ""}
                                      onChange={(e) =>
                                        setAmbiguousSelections((prev) => ({
                                          ...prev,
                                          [row.rowNumber]: e.target.value,
                                        }))
                                      }
                                      className="px-2 py-1 text-xs rounded-lg border border-amber-300 bg-amber-50/50 text-slate-900 font-medium"
                                    >
                                      <option value="">Select matching cadet...</option>
                                      {row.candidateCadets.map((c) => (
                                        <option key={c.cadetId} value={c.cadetId}>
                                          {c.cadetId}: {c.fullName} ({c.rank}, {c.wing}, {c.unit})
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-[10px] text-amber-700 block">
                                      Disambiguation required (multiple name matches)
                                    </span>
                                  </div>
                                )}

                                {(row.matchStatus === "unmatched" || row.matchStatus === "invalid") && (
                                  <span className="text-rose-600 text-[11px] font-medium">
                                    {row.errors.join("; ")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      This will update <code>enrollmentNo</code> on matched cadet records. No new cadets will be created.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleConfirmEnrollmentUpdates}
                      disabled={isUpdatingEnrollment}
                      isLoading={isUpdatingEnrollment}
                      className="cursor-pointer bg-slate-900 text-white"
                    >
                      Confirm Enrollment Updates
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATA EXPORT */}
      {/* ========================================================================= */}
      {activeTab === "export" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Cadet Nominal Roll &amp; Data Export</CardTitle>
              <CardDescription className="text-xs">
                Filter and export cadet master records into a styled Microsoft Excel (.xlsx) workbook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {exportError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {exportError}
                </div>
              )}

              {/* Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Training Year
                  </label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="all">All Training Years</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Division
                  </label>
                  <select
                    value={exportDivision}
                    onChange={(e) => setExportDivision(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="all">All Divisions (SD / SW)</option>
                    <option value="SD">SD (Senior Division - Male)</option>
                    <option value="SW">SW (Senior Wing - Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Filter
                  </label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive / Suspended</option>
                    <option value="passed_out">Passed Out</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Search Keyword
                  </label>
                  <input
                    type="text"
                    placeholder="Search name, ID, or enrollment..."
                    value={exportSearch}
                    onChange={(e) => setExportSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {/* Column Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Select Columns to Include in Export ({selectedFieldIds.length} selected)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFields}
                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFields}
                      className="text-xs text-slate-500 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {Object.entries(groupedFields).map(([categoryName, fields]) => (
                  <div
                    key={categoryName}
                    className="p-4 rounded-xl border border-slate-200 space-y-2.5"
                  >
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      {categoryName}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {fields.map((f) => {
                        const isChecked = selectedFieldIds.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                              isChecked
                                ? "border-blue-500 bg-blue-50/50 text-blue-900 font-medium"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleField(f.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{f.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleDownloadExport}
                  isLoading={isExporting}
                  disabled={isExporting || selectedFieldIds.length === 0}
                  className="cursor-pointer gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Generate &amp; Download Excel Spreadsheet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
