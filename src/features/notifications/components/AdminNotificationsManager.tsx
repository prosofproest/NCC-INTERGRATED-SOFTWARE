"use client";

import { useEffect, useState } from "react";
import { NotificationsList } from "./NotificationsList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface CadetOption {
  cadetId: string;
  fullName: string;
  regimentalNumber?: string;
}

interface BroadcastHistoryItem {
  broadcastId: string;
  title: string;
  message: string;
  targetGroup: string;
  recipientCount: number;
  readCount: number;
  importance: "normal" | "important";
  senderName: string;
  createdAt: string;
}

export function AdminNotificationsManager() {
  const [activeTab, setActiveTab] = useState<"compose" | "history" | "inbox">("compose");

  // Form State
  const [targetGroup, setTargetGroup] = useState<
    "all_cadets" | "selected_cadets" | "all_ctos" | "specific_user"
  >("all_cadets");
  const [targetCadetIds, setTargetCadetIds] = useState<string[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [importance, setImportance] = useState<"normal" | "important">("normal");
  const [link, setLink] = useState("");

  // Cadet options for multi-select
  const [cadetOptions, setCadetOptions] = useState<CadetOption[]>([]);
  const [cadetSearch, setCadetSearch] = useState("");

  // Broadcast History
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Submission State
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Fetch Cadets for multi-select
  useEffect(() => {
    async function loadCadets() {
      try {
        const res = await fetch("/api/admin/cadets");
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.cadets || []).map(
            (c: { cadetId: string; fullName?: string; regimentalNumber?: string }) => ({
              cadetId: c.cadetId,
              fullName: c.fullName || "Unnamed Cadet",
              regimentalNumber: c.regimentalNumber,
            })
          );
          setCadetOptions(mapped);
        }
      } catch (err) {
        console.error("Failed to load cadet options:", err);
      }
    }
    loadCadets();
  }, []);

  // Fetch Broadcast History
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchHistory() {
      if (activeTab !== "history") return;
      try {
        const res = await fetch("/api/admin/notifications");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setHistory(data.broadcasts || []);
          }
        }
      } catch (err) {
        console.error("Failed to load broadcast history:", err);
      } finally {
        if (!ignore) {
          setLoadingHistory(false);
        }
      }
    }

    fetchHistory();
    return () => {
      ignore = true;
    };
  }, [activeTab, historyRefreshKey]);

  const handleCadetToggle = (cadetId: string) => {
    setTargetCadetIds((prev) =>
      prev.includes(cadetId) ? prev.filter((id) => id !== cadetId) : [...prev, cadetId]
    );
  };

  const handleSelectAllCadets = () => {
    if (targetCadetIds.length === filteredCadetOptions.length) {
      setTargetCadetIds([]);
    } else {
      setTargetCadetIds(filteredCadetOptions.map((c) => c.cadetId));
    }
  };

  const filteredCadetOptions = cadetOptions.filter((c) => {
    const q = cadetSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.cadetId.toLowerCase().includes(q) ||
      (c.regimentalNumber && c.regimentalNumber.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim() || !message.trim()) {
      setStatusMessage({ type: "error", text: "Title and message are required." });
      return;
    }

    if (targetGroup === "selected_cadets" && targetCadetIds.length === 0) {
      setStatusMessage({ type: "error", text: "Please select at least one cadet to target." });
      return;
    }

    if (targetGroup === "specific_user" && !targetUserId.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a specific user ID or Cadet ID." });
      return;
    }

    try {
      setSending(true);
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetGroup,
          targetCadetIds: targetGroup === "selected_cadets" ? targetCadetIds : undefined,
          targetUserId: targetGroup === "specific_user" ? targetUserId.trim() : undefined,
          title: title.trim(),
          message: message.trim(),
          importance,
          link: link.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch notification broadcast.");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully broadcast notification to ${data.recipientCount} recipient(s)!`,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setLink("");
      setTargetCadetIds([]);
      setTargetUserId("");
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage({ type: "error", text: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("compose")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "compose"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Compose Broadcast
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Broadcast History
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "inbox"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Admin System Alerts
        </button>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold px-2 py-1 hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSE */}
      {activeTab === "compose" && (
        <Card>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Dispatch Broadcast Notification
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Send targeted in-app alerts and announcements across Cadet and CTO portals.
              </p>
            </div>

            {/* Target Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Target Audience <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { id: "all_cadets", label: "All Cadets", desc: "Every registered active cadet" },
                  { id: "selected_cadets", label: "Selected Cadets", desc: "Handpick individual cadets" },
                  { id: "all_ctos", label: "All CTOs", desc: "Care Taker Officers only" },
                  { id: "specific_user", label: "Specific User / ID", desc: "Target single UID or Cadet ID" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setTargetGroup(
                        item.id as "all_cadets" | "selected_cadets" | "all_ctos" | "specific_user"
                      )
                    }
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      targetGroup === item.id
                        ? "border-blue-600 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Specific User ID Input */}
            {targetGroup === "specific_user" && (
              <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700">
                  Target User UID or Cadet ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="e.g. CADET_0001 or Firebase UID"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Selected Cadets Picker */}
            {targetGroup === "selected_cadets" && (
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Select Cadets ({targetCadetIds.length} selected)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cadetSearch}
                      onChange={(e) => setCadetSearch(e.target.value)}
                      placeholder="Search cadets..."
                      className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllCadets}
                      className="text-xs py-1 h-auto"
                    >
                      {targetCadetIds.length === filteredCadetOptions.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-white">
                  {filteredCadetOptions.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">No matching cadets found.</div>
                  ) : (
                    filteredCadetOptions.map((cadet) => {
                      const selected = targetCadetIds.includes(cadet.cadetId);
                      return (
                        <label
                          key={cadet.cadetId}
                          className={`flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer text-xs ${
                            selected ? "bg-blue-50/60 font-medium" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleCadetToggle(cadet.cadetId)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold">{cadet.fullName}</span>
                          <span className="text-slate-400">({cadet.cadetId})</span>
                          {cadet.regimentalNumber && (
                            <span className="text-slate-500">[{cadet.regimentalNumber}]</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Importance */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Importance Level
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="importance"
                    value="normal"
                    checked={importance === "normal"}
                    onChange={() => setImportance("normal")}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Normal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-amber-600">
                  <input
                    type="radio"
                    name="importance"
                    value="important"
                    checked={importance === "important"}
                    onChange={() => setImportance("important")}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span>Important (High Priority Alert)</span>
                </label>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Notification Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Training Camp Attendance Required"
                maxLength={150}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Message Body <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter complete notification message..."
                rows={4}
                maxLength={2000}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Optional In-App Link */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                In-App Destination Link (Optional)
              </label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="e.g. /cadet/profile or /cadet/data-requests"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="submit"
                disabled={sending}
                className="px-6 py-2"
              >
                {sending ? "Broadcasting..." : "Dispatch Broadcast"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 2: BROADCAST HISTORY */}
      {activeTab === "history" && (
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sent Broadcasts Log
                </h3>
                <p className="text-xs text-slate-500">
                  Track delivered group notifications and cadet read compliance.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadingHistory(true);
                  setHistoryRefreshKey((k) => k + 1);
                }}
                disabled={loadingHistory}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2" />
                <p>Loading broadcast logs...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No broadcast notifications have been sent yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Recipients</th>
                      <th className="py-2.5 px-3">Read Stats</th>
                      <th className="py-2.5 px-3">Importance</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => (
                      <tr key={item.broadcastId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">
                            {item.title}
                          </div>
                          <div className="text-slate-400 text-[11px] truncate max-w-xs">
                            {item.message}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {item.targetGroup.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {item.recipientCount}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-emerald-600">
                              {item.readCount} read
                            </span>
                            <span className="text-slate-400">
                              ({Math.round((item.readCount / Math.max(1, item.recipientCount)) * 100)}%)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={item.importance === "important" ? "warning" : "default"} size="sm">
                            {item.importance}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: INBOX */}
      {activeTab === "inbox" && (
        <NotificationsList portalRole="admin" />
      )}
    </div>
  );
}
