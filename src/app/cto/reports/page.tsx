import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function CtoReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Reports &amp; Excel Export
            </h1>
            <Badge variant="outline" size="sm">
              Stage 11
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Export compliant battalion nominal rolls and attendance reports to Excel.
          </p>
        </div>
      </div>

      <Card>
        <div className="p-12 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Export Engine Arriving in Stage 11
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            High-fidelity Excel nominal rolls with auto-fit columns, border formatting, and ctoExportable field controls will be enabled in Stage 11.
          </p>
          <Link href="/cto">
            <Button variant="outline" size="sm">
              &larr; Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
