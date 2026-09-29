"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import type { CadetRecord } from "@/types/cadet";
import type { CategoryDefinition, FieldDefinition } from "@/types/fields";

interface CtoCadetDetailsPageProps {
  params: Promise<{ cadetId: string }>;
}

export default function CtoCadetDetailsPage({ params }: CtoCadetDetailsPageProps) {
  const { cadetId } = use(params);

  const [cadet, setCadet] = useState<CadetRecord | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/cto/cadets/${cadetId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.error || `Error ${res.status}: Failed to load cadet`);
          });
        }
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setCadet(data.cadet);
          setCategories(data.categories || []);
          setFields(data.fields || []);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load cadet details");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [cadetId]);

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
        <svg className="animate-spin h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-medium">Accessing cadet record (officer audit logged)...</span>
      </div>
    );
  }

  if (error && !cadet) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Unable to load cadet</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/cto/cadets">
          <Button variant="outline" size="sm">
            &larr; Back to Cadets Directory
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/cto/cadets" className="hover:text-slate-900 dark:hover:text-white transition">
          Cadets Directory
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900 dark:text-slate-200">{cadetId}</span>
      </div>

      {/* Hero Cadet Profile Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-xl tracking-wider shadow-sm shrink-0">
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
              <span>Rank: {cadet?.rank}</span>
              <span>&bull;</span>
              <span>Unit: {cadet?.unit}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-xs text-slate-500 font-medium">Profile Completion</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${cadet?.completionPercentage || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {cadet?.completionPercentage || 0}%
              </span>
            </div>
          </div>
          <Badge variant="outline" size="md" className="font-semibold text-amber-700 dark:text-amber-300">
            Officer Read-Only
          </Badge>
        </div>
      </div>

      {/* Officer Read-Only Access Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Officer Read-Only View:</strong> Displaying officer-permitted profile attributes. In accordance with battalion governance, record updates are reserved for Administrators and verified Cadets.
          </span>
        </div>
        <span className="font-mono text-[10px] text-amber-600/80 uppercase">Audited Access</span>
      </div>

      {/* SECTION 1: Core Regimental Information */}
      <Card>
        <CardHeader>
          <CardTitle>Core Regimental Profile</CardTitle>
          <CardDescription>
            Official regimental enrollment details and battalion placement.
          </CardDescription>
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
              <span className="text-xs text-slate-500 font-medium">Account Status</span>
              <div>
                <Badge variant={getStatusVariant(cadet?.status)} size="sm">
                  {cadet?.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Officer-Visible Dynamic Categories */}
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
                Officer Permitted
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryFields.map((field) => {
                  const val = cadet?.dynamicData?.[field.fieldId];
                  const displayVal =
                    val !== undefined && val !== null && String(val).trim() !== ""
                      ? String(val)
                      : "Not recorded";

                  return (
                    <div key={field.fieldId} className="space-y-1">
                      <span className="text-xs text-slate-500 font-medium">{field.label}</span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {displayVal}
                      </p>
                      <div className="pt-0.5">
                        <span className="text-[10px] text-slate-400">
                          Excel Export: {field.permissions?.ctoExportable ? "Eligible" : "Restricted"}
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

      {/* SECTION 3: Documents Placeholder (Stage 12) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Repository (Metadata)</CardTitle>
              <CardDescription>
                Verification status and certificates attached to this cadet record.
              </CardDescription>
            </div>
            <Badge variant="outline" size="sm">
              Stage 12
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No documents uploaded yet
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Automated document inspection, verification workflows, and Google Drive attachments will be activated in Stage 12.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
