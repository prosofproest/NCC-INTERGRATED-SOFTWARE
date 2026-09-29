"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import type { CadetRecord } from "@/types/cadet";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";

export default function CadetProfilePage() {
  const [cadet, setCadet] = useState<CadetRecord | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for cadetEditable fields
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});

  // Change Request Modal State
  const [isCrModalOpen, setIsCrModalOpen] = useState(false);
  const [crField, setCrField] = useState<FieldDefinition | null>(null);
  const [crNewValue, setCrNewValue] = useState("");
  const [crReason, setCrReason] = useState("");
  const [crSubmitting, setCrSubmitting] = useState(false);

  const fetchProfileData = useCallback(async () => {
    const res = await fetch("/api/cadet/profile");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}: Failed to load profile`);
    }
    const data = await res.json();
    return {
      cadet: data.cadet as CadetRecord,
      categories: (data.categories || []) as CategoryDefinition[],
      fields: (data.fields || []) as FieldDefinition[],
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchProfileData()
      .then((data) => {
        if (!ignore) {
          setCadet(data.cadet);
          setCategories(data.categories);
          setFields(data.fields);
          setDynamicValues(data.cadet.dynamicData || {});
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [fetchProfileData]);

  const handleDynamicChange = (fieldId: string, val: unknown) => {
    setDynamicValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch("/api/cadet/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dynamicData: dynamicValues }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile information");
      }

      const data = await res.json();
      setCadet(data.cadet);
      setDynamicValues(data.cadet.dynamicData || {});
      setSuccessMessage("Your profile information has been saved successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Open Change Request Modal for locked field
  const openChangeRequestModal = (field: FieldDefinition) => {
    setCrField(field);
    setCrNewValue("");
    setCrReason("");
    setIsCrModalOpen(true);
  };

  // Submit Change Request
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crField) return;

    try {
      setCrSubmitting(true);
      setError(null);

      const res = await fetch("/api/cadet/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: crField.fieldId,
          newValue: crNewValue,
          reason: crReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit change request");
      }

      const data = await res.json();
      setIsCrModalOpen(false);
      setSuccessMessage(
        `Change request ${data.changeRequest.changeRequestId} for '${crField.label}' submitted successfully for administrative review.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error submitting change request");
    } finally {
      setCrSubmitting(false);
    }
  };

  const getWingVariant = (w?: string): BadgeVariant => {
    switch (w) {
      case "Army":
        return "army";
      case "Navy":
        return "navy";
      case "Air":
        return "air";
      default:
        return "default";
    }
  };

  const getStatusVariant = (s?: string): BadgeVariant => {
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
        <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-medium">Loading your profile...</span>
      </div>
    );
  }

  if (error && !cadet) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Profile Notice</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/cadet">
          <Button variant="outline" size="sm">
            &larr; Back to Dashboard
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSaveProfile} className="space-y-8">
      {/* Top Cadet Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl tracking-wider shadow-sm shrink-0">
            {cadet?.fullName
              .split(" ")
              .slice(-2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {cadet?.fullName}
              </h1>
              <Badge variant={getWingVariant(cadet?.wing)} size="sm">
                {cadet?.wing} Wing
              </Badge>
              <Badge variant={getStatusVariant(cadet?.status)} size="sm">
                {cadet?.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {cadet?.cadetId}
              </span>
              <span>&bull;</span>
              <span>{cadet?.rank}</span>
              <span>&bull;</span>
              <span>{cadet?.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-xs text-slate-500 font-medium">Profile Completion</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-28 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cadet?.completionPercentage || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {cadet?.completionPercentage || 0}%
              </span>
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={saving}>
            Save Editable Fields
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* SECTION 1: Master Regimental Core (Read-Only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Core Regimental Record</CardTitle>
              <CardDescription>
                Permanent battalion enrollment identifiers. These fields are verified by officers.
              </CardDescription>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              Official Protected
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Full Name</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cadet?.fullName}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Regimental Enrollment No</span>
              <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                {cadet?.enrollmentNo || <span className="text-slate-400 italic font-sans">Pending</span>}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Rank</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cadet?.rank}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">NCC Wing</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cadet?.wing}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Battalion / Unit</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cadet?.unit}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Registered Email</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{cadet?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Dynamic Categories & Profile Attributes */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryFields.map((field) => {
                  const isEditable = Boolean(field.permissions?.cadetEditable);
                  const val = dynamicValues[field.fieldId];
                  const strVal = val !== undefined && val !== null ? String(val) : "";

                  return (
                    <div
                      key={field.fieldId}
                      className={`p-4 rounded-2xl border transition-all ${
                        isEditable
                          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
                          : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60"
                      } space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {field.label}
                          {field.validation?.required && (
                            <span className="text-rose-500 ml-0.5">*</span>
                          )}
                        </label>
                        {isEditable ? (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full shrink-0">
                            Direct Edit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded-full shrink-0">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Locked
                          </span>
                        )}
                      </div>

                      {/* Case 1: Directly Editable Field */}
                      {isEditable ? (
                        <div>
                          {field.type === "select" ? (
                            <select
                              value={strVal}
                              onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
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
                              rows={2}
                              value={strVal}
                              onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                          ) : field.type === "boolean" ? (
                            <div className="pt-1 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                onChange={(e) => handleDynamicChange(field.fieldId, e.target.checked)}
                                className="w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-600"
                              />
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {Boolean(val) ? "Yes / Confirmed" : "No / Not Applicable"}
                              </span>
                            </div>
                          ) : field.type === "date" ? (
                            <input
                              type="date"
                              value={strVal}
                              onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                          ) : field.type === "number" ? (
                            <input
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
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                          ) : (
                            <input
                              type="text"
                              value={strVal}
                              onChange={(e) => handleDynamicChange(field.fieldId, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                          )}
                        </div>
                      ) : (
                        /* Case 2: Locked Field with Request Change Action */
                        <div className="space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 min-h-6 flex items-center">
                            {strVal ? (
                              strVal
                            ) : (
                              <span className="text-slate-400 italic font-normal">Not provided</span>
                            )}
                          </p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => openChangeRequestModal(field)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer transition"
                            >
                              <span>Request Change</span>
                              <span>&rarr;</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Direct modifications to editable fields are saved immediately. Protected attributes require a Change Request.
        </span>
        <Button type="submit" variant="primary" size="sm" isLoading={saving}>
          Save Editable Fields
        </Button>
      </div>

      {/* ==============================================================
          MODAL: SUBMIT CHANGE REQUEST FOR LOCKED FIELD
          ============================================================== */}
      <Modal
        isOpen={isCrModalOpen}
        onClose={() => setIsCrModalOpen(false)}
        title={crField ? `Request Change: ${crField.label}` : "Submit Change Request"}
        description="Official profile modification request. Submitted requests are reviewed by Battalion Administrators."
      >
        {crField && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">Current Registered Value</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {String(cadet?.dynamicData?.[crField.fieldId] || "Not provided")}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Proposed New Value <span className="text-rose-500">*</span>
              </label>
              {crField.type === "select" ? (
                <select
                  required
                  value={crNewValue}
                  onChange={(e) => setCrNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Select new value --</option>
                  {crField.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : crField.type === "date" ? (
                <input
                  type="date"
                  required
                  value={crNewValue}
                  onChange={(e) => setCrNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                />
              ) : (
                <input
                  type={crField.type === "number" ? "number" : "text"}
                  required
                  value={crNewValue}
                  onChange={(e) => setCrNewValue(e.target.value)}
                  placeholder={`Enter correct ${crField.label}`}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Change <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={crReason}
                onChange={(e) => setCrReason(e.target.value)}
                placeholder="Explain why this information needs to be corrected or updated..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCrModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={crSubmitting}
                onClick={handleSubmitChangeRequest}
              >
                Submit Change Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </form>
  );
}
