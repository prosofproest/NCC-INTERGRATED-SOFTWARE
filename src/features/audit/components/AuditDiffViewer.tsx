"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";

interface AuditDiffViewerProps {
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
}

export function AuditDiffViewer({ previousState, newState }: AuditDiffViewerProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const prev = previousState || {};
  const curr = newState || {};

  const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)])).sort();

  if (allKeys.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-center text-xs text-slate-500">
        No state changes recorded for this entry.
      </div>
    );
  }

  const formatValue = (val: unknown): string => {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  };

  const categorizedKeys = allKeys.map((key) => {
    const hasPrev = key in prev;
    const hasCurr = key in curr;
    const prevVal = prev[key];
    const currVal = curr[key];

    const isAdded = !hasPrev && hasCurr;
    const isRemoved = hasPrev && !hasCurr;
    const isModified =
      hasPrev &&
      hasCurr &&
      JSON.stringify(prevVal) !== JSON.stringify(currVal);
    const isUnchanged = !isAdded && !isRemoved && !isModified;

    return {
      key,
      prevVal,
      currVal,
      isAdded,
      isRemoved,
      isModified,
      isUnchanged,
    };
  });

  const displayedKeys = showUnchanged
    ? categorizedKeys
    : categorizedKeys.filter((k) => !k.isUnchanged);

  const changedCount = categorizedKeys.filter((k) => !k.isUnchanged).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Field Diff
          </span>
          <span className="text-slate-500">
            ({changedCount} modified{categorizedKeys.length - changedCount > 0 ? `, ${categorizedKeys.length - changedCount} unchanged` : ""})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {categorizedKeys.length - changedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowUnchanged(!showUnchanged)}
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {showUnchanged ? "Hide Unchanged" : "Show All Fields"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
          >
            {showRawJson ? "View Diff Table" : "View Raw JSON"}
          </button>
        </div>
      </div>

      {showRawJson ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Previous State</span>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto max-h-64 text-[11px]">
              {JSON.stringify(prev, null, 2)}
            </pre>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase text-slate-500">New State</span>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto max-h-64 text-[11px]">
              {JSON.stringify(curr, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
          {displayedKeys.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              All field values remained unchanged.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedKeys.map((item) => (
                <div
                  key={item.key}
                  className={`p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-start transition-colors ${
                    item.isAdded
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                      : item.isRemoved
                      ? "bg-rose-50/60 dark:bg-rose-950/20"
                      : item.isModified
                      ? "bg-amber-50/60 dark:bg-amber-950/20"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  {/* Field name and status */}
                  <div className="md:col-span-4 flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100 break-all">
                      {item.key}
                    </span>
                    {item.isAdded && (
                      <Badge variant="success" size="sm">
                        + Added
                      </Badge>
                    )}
                    {item.isRemoved && (
                      <Badge variant="danger" size="sm">
                        - Removed
                      </Badge>
                    )}
                    {item.isModified && (
                      <Badge variant="warning" size="sm">
                        Modified
                      </Badge>
                    )}
                  </div>

                  {/* Previous value */}
                  <div className="md:col-span-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                    {item.isAdded ? (
                      <span className="italic text-slate-400">—</span>
                    ) : (
                      <span className={item.isModified || item.isRemoved ? "line-through text-rose-600 dark:text-rose-400" : ""}>
                        {formatValue(item.prevVal)}
                      </span>
                    )}
                  </div>

                  {/* Arrow for modified */}
                  <div className="hidden md:flex md:col-span-1 items-center justify-center text-slate-400">
                    &rarr;
                  </div>

                  {/* New value */}
                  <div className="md:col-span-3 font-mono text-[11px] text-slate-900 dark:text-slate-100 break-all font-medium">
                    {item.isRemoved ? (
                      <span className="italic text-slate-400">—</span>
                    ) : (
                      <span className={item.isAdded || item.isModified ? "text-emerald-700 dark:text-emerald-400" : ""}>
                        {formatValue(item.currVal)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
