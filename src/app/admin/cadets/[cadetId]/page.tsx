"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { CadetDocumentManager } from "@/features/documents/CadetDocumentManager";
import type { CadetRecord, CadetStatus, CadetTrainingYear, CadetDivision } from "@/types/cadet";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";

interface CadetDetailsPageProps {
  params: Promise<{ cadetId: string }>;
}

export default function AdminCadetDetailsPage({ params }: CadetDetailsPageProps) {
  const { cadetId } = use(params);

  const [cadet, setCadet] = useState<CadetRecord | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [rank, setRank] = useState("");
  const [unit, setUnit] = useState("");
  const [trainingYear, setTrainingYear] = useState<CadetTrainingYear>("1st Year");
  const [division, setDivision] = useState<CadetDivision>("SD");
  const [status, setStatus] = useState<CadetStatus>("active");
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/cadets/${cadetId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error ${res.status}: Failed to load cadet`);
        }

        const data = await res.json();
        const c: CadetRecord = data.cadet;
        setCadet(c);
        setCategories(data.categories || []);
        setFields(data.fields || []);

        // Initialize form state
        setFullName(c.fullName || "");
        setEnrollmentNo(c.enrollmentNo || "");
        setRank(c.rank || "");
        setUnit(c.unit || "");
        setTrainingYear(c.trainingYear || "1st Year");
        setDivision(c.division || "SD");
        setStatus(c.status || "active");
        setDynamicValues(c.dynamicData || {});
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load cadet details");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [cadetId]);

  const handleDynamicChange = (fieldId: string, val: unknown) => {
    setDynamicValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        fullName,
        enrollmentNo: enrollmentNo.trim() || null,
        rank,
        unit,
        wing: "Air",
        trainingYear,
        division,
        status,
        dynamicData: dynamicValues,
      };

      const res = await fetch(`/api/admin/cadets/${cadetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}: Failed to update cadet`);
      }

      const data = await res.json();
      setCadet(data.cadet);
      setSuccessMessage("Cadet profile updated successfully. Audit log recorded.");

      // Auto-hide success banner after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save cadet profile");
    } finally {
      setSaving(false);
    }
  };



  const getStatusVariant = (s: string): BadgeVariant => {
    switch (s) {
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

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
        <svg
          className="animate-spin h-6 w-6 text-slate-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-xs font-medium">Loading cadet details...</span>
      </div>
    );
  }

  if (error && !cadet) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to load cadet</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/admin/cadets">
          <Button variant="outline" size="sm">
            &larr; Back to Cadets Directory
          </Button>
        </Link>
      </Card>
    );
  }

  if (!cadet) {
    return null;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/admin/cadets" className="hover:text-slate-900 transition">
          Cadets Directory
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{cadetId}</span>
      </div>

      {/* Hero Cadet Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6 min-w-0">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl tracking-wider shadow-sm shrink-0">
            {fullName
              .split(" ")
              .slice(-2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                {fullName}
              </h1>
              <Badge variant="air" size="sm">
                Air Wing
              </Badge>
              <Badge variant="outline" size="sm">
                {trainingYear}
              </Badge>
              <Badge variant="outline" size="sm">
                {division}
              </Badge>
              <Badge variant={getStatusVariant(status)} size="sm">
                {status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                {cadetId}
              </span>
              <span>&bull;</span>
              <span className="truncate">{cadet?.email}</span>
              {cadet?.updatedAt && (
                <>
                  <span>&bull;</span>
                  <span>Updated: {new Date(cadet.updatedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 xl:pt-0 border-t xl:border-t-0 border-slate-100 shrink-0">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-xs text-slate-500 font-medium">Profile Completion</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={cadet?.completionPercentage || 0} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cadet?.completionPercentage || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-800">
                {cadet?.completionPercentage || 0}%
              </span>
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* SECTION 1: Core Regimental Information */}
      <Card>
        <CardHeader>
          <CardTitle>Core Regimental Profile</CardTitle>
          <CardDescription>
            Master system identity, unit affiliation, and account status. Full admin edit privileges enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Regimental Enrollment Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enrollment Number
              </label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                placeholder="e.g. KA24SDA100101"
                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Rank */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rank <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="e.g. Cadet, Corporal, Sergeant"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. 1 Kar Air Sqn NCC"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Training Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Training Year <span className="text-rose-500">*</span>
              </label>
              <select
                value={trainingYear}
                onChange={(e) => setTrainingYear(e.target.value as CadetTrainingYear)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition cursor-pointer"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
              </select>
            </div>

            {/* Division */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Division (SD / SW) <span className="text-rose-500">*</span>
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as CadetDivision)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition cursor-pointer"
              >
                <option value="SD">SD (Senior Division - Male)</option>
                <option value="SW">SW (Senior Wing - Female)</option>
              </select>
            </div>

            {/* Wing */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Wing
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium flex items-center justify-between">
                <span>Air Wing</span>
                <span className="text-[10px] text-slate-400 font-normal">Fixed</span>
              </div>
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CadetStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition cursor-pointer"
              >
                <option value="active">Active (Operational)</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="passed_out">Passed Out (Alumnus)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Dynamic Profile Categories */}
      {categories.map((category) => {
        const categoryFields = fields.filter((f) => f.categoryId === category.categoryId);
        if (categoryFields.length === 0) return null;

        return (
          <Card key={category.categoryId}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{category.name}</CardTitle>
                {category.description && (
                  <CardDescription>{category.description}</CardDescription>
                )}
              </div>
              <Badge variant="outline" size="sm">
                {category.categoryId}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryFields.map((field) => {
                  const val = dynamicValues[field.fieldId];
                  const strVal = val !== undefined && val !== null ? String(val) : "";

                  return (
                    <div key={field.fieldId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700">
                          {field.label}
                          {field.validation?.required && (
                            <span className="text-rose-500 ml-0.5">*</span>
                          )}
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {field.fieldId}
                          </span>
                        </div>
                      </div>

                      {/* Render input depending on field type */}
                      {field.type === "select" ? (
                        <select
                          id={field.fieldId}
                          aria-label={field.label}
                          value={strVal}
                          onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                          className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition cursor-pointer"
                        >
                          <option value="">-- Select option --</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          id={field.fieldId}
                          aria-label={field.label}
                          rows={2}
                          value={strVal}
                          onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition"
                        />
                      ) : field.type === "boolean" ? (
                        <div className="pt-2 flex items-center gap-2 min-h-[44px] sm:min-h-[38px]">
                          <input
                            id={field.fieldId}
                            aria-label={field.label}
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => handleDynamicChange(field.fieldId, e.target.checked)}
                            className="w-5 h-5 rounded-sm border-slate-300 text-blue-600 focus:ring-[#0071E3] cursor-pointer"
                          />
                          <label htmlFor={field.fieldId} className="text-xs text-slate-700 cursor-pointer">
                            {Boolean(val) ? "Yes / Confirmed" : "No / Not Applicable"}
                          </label>
                        </div>
                      ) : field.type === "date" ? (
                        <input
                          id={field.fieldId}
                          aria-label={field.label}
                          type="date"
                          value={strVal}
                          onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                          className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition"
                        />
                      ) : field.type === "number" ? (
                        <input
                          id={field.fieldId}
                          aria-label={field.label}
                          type="number"
                          value={strVal}
                          onChange={(e) =>
                            handleDynamicChange(
                              field.fieldId,
                              e.target.value === "" ? "" : Number(e.target.value)
                            )
                          }
                          min={field.validation?.min}
                          max={field.validation?.max}
                          className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition"
                        />
                      ) : (
                        <input
                          id={field.fieldId}
                          aria-label={field.label}
                          type="text"
                          value={strVal}
                          onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                          className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0071E3] transition"
                        />
                      )}

                      {/* Helper permission badge for Admin awareness */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-400">
                          Cadet edit: {field.permissions?.cadetEditable ? "Enabled" : "Locked (CR required)"}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-[10px] text-slate-400">
                          CTO: {field.permissions?.ctoVisible ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* SECTION 3: Documents Repository & Verification */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Repository & Verification</CardTitle>
              <CardDescription>
                Verification status, Google Drive cloud attachments, and administrative actions for this cadet.
              </CardDescription>
            </div>
            <Badge variant="success" size="sm">
              Drive Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CadetDocumentManager
            cadetId={cadet.cadetId}
            cadetName={cadet.fullName}
            userRole="admin"
            categories={categories}
          />
        </CardContent>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Any modifications will be recorded in the immutable system audit log.
        </span>
        <div className="flex items-center gap-3">
          <Link href="/admin/cadets">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="sm" isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  );
}
