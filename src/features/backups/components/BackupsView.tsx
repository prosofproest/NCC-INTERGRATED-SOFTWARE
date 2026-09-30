"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { BackupMetadata, RestoreResult } from "@/types/backup";
import { BACKUP_COLLECTIONS, MAX_BACKUP_RETENTION_COUNT } from "@/types/backup";

export function BackupsView() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Restore Modal State
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [restoreCollections, setRestoreCollections] = useState<string[]>([]);
  const [isFullRestore, setIsFullRestore] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/backups");
      if (!res.ok) {
        throw new Error("Failed to load backups");
      }
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load backup archives",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function initLoad() {
      try {
        const res = await fetch("/api/admin/backups");
        if (!res.ok) throw new Error("Failed to load backups");
        const data = await res.json();
        if (!ignore) {
          setBackups(data.backups || []);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setFeedback({
            type: "error",
            message: err instanceof Error ? err.message : "Failed to load backup archives",
          });
          setLoading(false);
        }
      }
    }
    initLoad();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setFeedback(null);
      const res = await fetch("/api/admin/backups", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create backup");
      }
      const data = await res.json();
      setFeedback({
        type: "success",
        message: `Backup ${data.backup.backupId} created successfully (${data.backup.totalRecords} records across all collections).`,
      });
      await fetchBackups();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to generate backup",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm(`Are you sure you want to delete backup snapshot ${backupId}?`)) {
      return;
    }
    try {
      setDeletingId(backupId);
      const res = await fetch(`/api/admin/backups/${backupId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete backup");
      }
      setFeedback({
        type: "success",
        message: `Backup ${backupId} deleted successfully.`,
      });
      await fetchBackups();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete backup",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenRestoreModal = (backup: BackupMetadata) => {
    setSelectedBackup(backup);
    setIsFullRestore(true);
    setRestoreCollections(Object.keys(backup.recordCounts || {}));
    setConfirmText("");
    setRestoreResult(null);
  };

  const handleExecuteRestore = async () => {
    if (!selectedBackup || confirmText.trim() !== "RESTORE") return;

    try {
      setRestoring(true);
      setFeedback(null);
      const res = await fetch(`/api/admin/backups/${selectedBackup.backupId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: "RESTORE",
          collections: isFullRestore ? undefined : restoreCollections,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to restore database");
      }

      const data = await res.json();
      setRestoreResult(data.result);
      setFeedback({
        type: "success",
        message: `System successfully restored from ${selectedBackup.backupId} (${data.result.totalRestoredRecords} records restored).`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Restoration execution failed",
      });
    } finally {
      setRestoring(false);
    }
  };

  const toggleCollectionSelection = (col: string) => {
    setRestoreCollections((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const latestBackup = backups[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Backups & Disaster Recovery
            </h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Retention: Keep {MAX_BACKUP_RETENTION_COUNT} Versions
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create point-in-time snapshots of Firestore datasets, download JSON archives, and execute surgical or full system restorations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateBackup}
            disabled={creating}
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm flex items-center gap-2"
          >
            {creating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Snapshotting Firestore...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Run Backup Now</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3 border transition ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div className="flex-1">
            <p className="font-semibold">{feedback.type === "success" ? "Operation Successful" : "Action Failed"}</p>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Snapshots
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {backups.length} / {MAX_BACKUP_RETENTION_COUNT}
              </span>
              <span className="text-xs text-slate-400">Archives</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Auto-pruning active</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Latest Backup
            </span>
            <div className="mt-3">
              <span className="text-sm font-bold tracking-tight text-slate-900 block truncate">
                {latestBackup ? formatDate(latestBackup.createdAt) : "No backups yet"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {latestBackup ? `${latestBackup.totalRecords} records stored` : "Awaiting first run"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Collections Covered
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {BACKUP_COLLECTIONS.length}
              </span>
              <span className="text-xs text-emerald-600 font-medium">100% Scope</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Cadets, Config, Requests, Users</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Retention Policy
            </span>
            <div className="mt-3">
              <span className="text-sm font-bold tracking-tight text-slate-900 block">
                Last {MAX_BACKUP_RETENTION_COUNT} Versions
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">FIFO automated rotation</p>
          </CardContent>
        </Card>
      </div>

      {/* Backup Archives Table */}
      <Card>
        <CardHeader className="p-5 sm:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Available Snapshot Archives
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Download JSON exports or execute safe point-in-time recoveries.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBackups} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-medium">Loading backup history...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">No Backup Snapshots Available</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Protect your cadets, configuration, and audit records by running your first point-in-time database snapshot.
              </p>
            </div>
            <div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateBackup}
                disabled={creating}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white"
              >
                Create First Backup Now &rarr;
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Backup ID</th>
                  <th className="px-6 py-3.5">Date &amp; Time</th>
                  <th className="px-6 py-3.5">Created By</th>
                  <th className="px-6 py-3.5">Records</th>
                  <th className="px-6 py-3.5">Archive Size</th>
                  <th className="px-6 py-3.5">Breakdown</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.backupId} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-900">
                      {b.backupId}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {b.createdBy}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-900">
                      {b.totalRecords}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Object.entries(b.recordCounts || {}).map(([col, count]) => (
                          <span
                            key={col}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono"
                          >
                            {col}: {count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <a
                        href={`/api/admin/backups/${b.backupId}/download`}
                        download
                        className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                      >
                        Download
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRestoreModal(b)}
                        className="text-amber-700 border-amber-200 hover:bg-amber-50"
                      >
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBackup(b.backupId)}
                        disabled={deletingId === b.backupId}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Restore Confirmation Modal */}
      {selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Restore from Snapshot
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedBackup.backupId} &bull; {formatDate(selectedBackup.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBackup(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {restoreResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm">
                  <p className="font-semibold text-emerald-950">Restoration Completed Successfully</p>
                  <p className="mt-1">
                    Restored {restoreResult.totalRestoredRecords} records across {restoreResult.collectionsRestored.length} collections.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(restoreResult.details).map(([col, count]) => (
                      <div key={col} className="p-2 bg-emerald-100/50 rounded-lg">
                        <span className="font-semibold">{col}:</span> {count} records
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setSelectedBackup(null);
                    setRestoreResult(null);
                    fetchBackups();
                  }}
                  className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white"
                >
                  Close &amp; Return
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Warning Card */}
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed">
                  <span className="font-bold">Caution:</span> Restoration will overwrite target collections with the exact state from this snapshot. Any data created after {formatDate(selectedBackup.createdAt)} will be replaced. An immutable audit record will be logged.
                </div>

                {/* Scope Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Restoration Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFullRestore(true)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition text-left ${
                        isFullRestore
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Full System Restore</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">All {selectedBackup.totalRecords} records</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullRestore(false)}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition text-left ${
                        !isFullRestore
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Selective Restore</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Pick specific collections</div>
                    </button>
                  </div>
                </div>

                {/* Individual Collection Checkboxes if Selective */}
                {!isFullRestore && (
                  <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-36 overflow-y-auto text-xs">
                    {Object.keys(selectedBackup.recordCounts || {}).map((col) => (
                      <label key={col} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restoreCollections.includes(col)}
                          onChange={() => toggleCollectionSelection(col)}
                          className="rounded border-slate-300 text-[#0071E3] focus:ring-[#0071E3]"
                        />
                        <span className="font-mono">{col}</span>
                        <span className="text-slate-400">({selectedBackup.recordCounts[col]} records)</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Confirmation phrase input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Type <span className="font-mono text-rose-600 font-bold">RESTORE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESTORE in uppercase"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono tracking-wider text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBackup(null)}
                    disabled={restoring}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExecuteRestore}
                    disabled={confirmText.trim() !== "RESTORE" || restoring}
                    className="bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
                  >
                    {restoring ? "Executing Restoration..." : "Execute System Restoration"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
