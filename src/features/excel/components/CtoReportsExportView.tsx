"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ExportFieldOption } from "@/types/excel";

export function CtoReportsExportView() {
  const [exportFields, setExportFields] = useState<ExportFieldOption[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [exportWing, setExportWing] = useState("all");
  const [exportRank, setExportRank] = useState("all");
  const [exportSearch, setExportSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/data-export/options");
        if (res.ok) {
          const data = await res.json();
          const all = data.allAvailableFields || [];
          setExportFields(all);
          // Default: select all authorized core fields
          const defaults = all.filter((f: ExportFieldOption) => f.isCore).map((f: ExportFieldOption) => f.id);
          setSelectedFieldIds(defaults);
        }
      } catch (err) {
        console.error("Failed to load CTO export options:", err);
      }
    }
    loadOptions();
  }, []);

  const handleToggleField = (fieldId: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleSelectAll = () => {
    setSelectedFieldIds(exportFields.map((f) => f.id));
  };

  const handleDeselectAll = () => {
    setSelectedFieldIds([]);
  };

  const handleDownload = async () => {
    if (selectedFieldIds.length === 0) {
      setErrorMessage("Please select at least one field to export.");
      return;
    }

    try {
      setIsExporting(true);
      setErrorMessage(null);

      const res = await fetch("/api/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedFieldIds,
          wing: exportWing !== "all" ? exportWing : undefined,
          rank: exportRank !== "all" ? exportRank : undefined,
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
      a.download = `cto_nominal_roll_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // Group fields
  const groupedFields: Record<string, ExportFieldOption[]> = {};
  for (const f of exportFields) {
    if (!groupedFields[f.category]) {
      groupedFields[f.category] = [];
    }
    groupedFields[f.category].push(f);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports &amp; Excel Export
            </h1>
            <Badge variant="primary" size="sm">
              Section 18
            </Badge>
            <Badge variant="outline" size="sm">
              CTO Scope
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate and export authorized company nominal rolls and attendance spreadsheets.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">Battalion Nominal Roll Builder</CardTitle>
            <span className="text-[11px] text-slate-400 font-medium">
              Strictly restricted to <code>ctoExportable</code> attributes
            </span>
          </div>
          <CardDescription className="text-xs">
            Export compliant cadet records matching your active unit and regimental assignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service Wing
              </label>
              <select
                value={exportWing}
                onChange={(e) => setExportWing(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="all">All Wings</option>
                <option value="Army">Army Wing</option>
                <option value="Navy">Navy Wing</option>
                <option value="Air">Air Wing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rank Progression
              </label>
              <select
                value={exportRank}
                onChange={(e) => setExportRank(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="all">All Ranks</option>
                <option value="Cadet">Cadet</option>
                <option value="Corporal">Corporal</option>
                <option value="Sergeant">Sergeant</option>
                <option value="Company Quarter Master Sergeant">CQMS</option>
                <option value="Company Senior Under Officer">CSUO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cadet Search
              </label>
              <input
                type="text"
                placeholder="Search cadet name, ID, or enrollment..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>

          {/* Field Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Authorized Export Columns ({selectedFieldIds.length} selected)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-500 hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {Object.entries(groupedFields).map(([catName, fields]) => (
              <div key={catName} className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {catName}
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

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Generated spreadsheet contains official formatting and metadata headers.
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={handleDownload}
              isLoading={isExporting}
              disabled={isExporting || selectedFieldIds.length === 0}
              className="cursor-pointer gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Nominal Roll (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
