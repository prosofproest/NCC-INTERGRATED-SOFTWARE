"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { UserProfile } from "@/types/user";

export function CtoManagementView() {
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked">("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Create Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Status Action Modal State
  const [actionTarget, setActionTarget] = useState<UserProfile | null>(null);
  const [actionType, setActionType] = useState<"deactivate" | "reactivate" | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Resend Invite State
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadOfficers() {
      try {
        const res = await fetch("/api/admin/cto");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setOfficers(data.officers || []);
          }
        }
      } catch (err) {
        console.error("Failed to load CTO officers:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadOfficers();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const handleCreateCto = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newName.trim() || !newEmail.trim()) {
      setCreateError("Both full name and official email are required.");
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch("/api/admin/cto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create officer account.");
      }

      setCreateSuccess(`Account provisioned successfully for ${newName.trim()}! Welcome email dispatched.`);
      setNewName("");
      setNewEmail("");
      setRefreshKey((k) => k + 1);

      // Auto close after brief display
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess(null);
      }, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!actionTarget || !actionType) return;

    try {
      setIsProcessingAction(true);
      const res = await fetch(`/api/admin/cto/${actionTarget.uid}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update account status.");
      }

      setActionMessage({
        type: "success",
        text: data.message || `Account successfully ${actionType}d.`,
      });

      setRefreshKey((k) => k + 1);
      setActionTarget(null);
      setActionType(null);
    } catch (err: unknown) {
      const error = err as Error;
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleResendInvite = async (officer: UserProfile) => {
    try {
      setResendingId(officer.uid);
      const res = await fetch(`/api/admin/cto/${officer.uid}/resend-invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invite.");
      }
      setActionMessage({
        type: "success",
        text: `Setup invitation successfully resent to ${officer.email}.`,
      });
    } catch (err: unknown) {
      const error = err as Error;
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setResendingId(null);
    }
  };

  // Metrics
  const totalOfficers = officers.length;
  const activeOfficers = officers.filter((o) => o.status !== "locked" && !o.disabled).length;
  const lockedOfficers = totalOfficers - activeOfficers;

  // Filtered List
  const filteredOfficers = officers.filter((o) => {
    const matchesSearch =
      (o.name && o.name.toLowerCase().includes(search.toLowerCase())) ||
      o.email.toLowerCase().includes(search.toLowerCase());

    const isLocked = o.status === "locked" || o.disabled;
    if (statusFilter === "active") return matchesSearch && !isLocked;
    if (statusFilter === "locked") return matchesSearch && isLocked;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Action Banner / Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold px-2 py-1 hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total CTO Officers
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {totalOfficers}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">Care Taker Officers registered</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active &amp; Operational
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-emerald-600">
                {activeOfficers}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">Authorized portal access</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Deactivated / Suspended
              </span>
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-8a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-rose-600">
                {lockedOfficers}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">Access disabled / revoked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section Header & Controls */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Officer Directory
              </h2>
              <p className="text-xs text-slate-500">
                Manage Care Taker Officer credentials, portal status, and dispatch setup links.
              </p>
            </div>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2 px-4 shadow-xs"
            >
              + Create CTO Account
            </Button>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All ({totalOfficers})
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Active ({activeOfficers})
              </button>
              <button
                onClick={() => setStatusFilter("locked")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === "locked"
                    ? "bg-rose-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Deactivated ({lockedOfficers})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 w-full sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Officers Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin mb-2" />
              <p>Loading officer directory...</p>
            </div>
          ) : filteredOfficers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No Care Taker Officers found matching your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Officer Name</th>
                    <th className="py-3 px-3">Official Email</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">First Login Status</th>
                    <th className="py-3 px-3">Created Date</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOfficers.map((officer) => {
                    const isLocked = officer.status === "locked" || officer.disabled;
                    return (
                      <tr
                        key={officer.uid}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {officer.name || "Care Taker Officer"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            UID: {officer.uid.substring(0, 12)}...
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-700">
                          {officer.email}
                        </td>
                        <td className="py-3.5 px-3">
                          <Badge variant={isLocked ? "danger" : "success"} size="sm">
                            {isLocked ? "Deactivated" : "Active"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3">
                          {officer.mustChangePassword ? (
                            <span className="text-[11px] text-amber-600 font-medium">
                              Pending Initial Password Setup
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium">
                              Password Configured
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(officer.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isLocked && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendInvite(officer)}
                                disabled={resendingId === officer.uid}
                                className="text-xs py-1 h-auto"
                                title="Resend password setup email"
                              >
                                {resendingId === officer.uid ? "Sending..." : "Resend Invite"}
                              </Button>
                            )}

                            {isLocked ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActionTarget(officer);
                                  setActionType("reactivate");
                                }}
                                className="text-xs py-1 h-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActionTarget(officer);
                                  setActionType("deactivate");
                                }}
                                className="text-xs py-1 h-auto text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* CREATE CTO MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!isCreating) {
            setIsCreateModalOpen(false);
            setCreateError(null);
            setCreateSuccess(null);
          }
        }}
        title="Provision New CTO Account"
        description="Create an officer account with Care Taker Officer (CTO) credentials and dispatch a secure password setup link."
      >
        <form onSubmit={handleCreateCto} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {createError}
            </div>
          )}

          {createSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              {createSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Officer Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Capt. Rajesh Sharma"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Official Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. cto.officer@ncc.test"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">
              🔒 Security &amp; Password Policy:
            </div>
            <p>
              In accordance with security guidelines, no plaintext passwords are ever sent via email. An official password setup invitation link will be dispatched to the email above.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2 px-4 shadow-xs"
            >
              {isCreating ? "Provisioning..." : "Provision Officer Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM STATUS TOGGLE MODAL */}
      <Modal
        isOpen={Boolean(actionTarget && actionType)}
        onClose={() => {
          if (!isProcessingAction) {
            setActionTarget(null);
            setActionType(null);
          }
        }}
        title={actionType === "deactivate" ? "Deactivate Officer Account" : "Reactivate Officer Account"}
        description={
          actionType === "deactivate"
            ? `Are you sure you want to deactivate the account for ${actionTarget?.name || actionTarget?.email}? This officer will be immediately signed out and unable to log in.`
            : `Are you sure you want to reactivate the account for ${actionTarget?.name || actionTarget?.email}? Portal access will be immediately restored.`
        }
      >
        <div className="space-y-4 pt-2">
          {actionType === "deactivate" && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              ⚠️ <strong>Warning:</strong> Active session tokens will be revoked immediately via Firebase Auth.
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActionTarget(null);
                setActionType(null);
              }}
              disabled={isProcessingAction}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleStatusToggle}
              disabled={isProcessingAction}
              className={
                actionType === "deactivate"
                  ? "bg-rose-600 hover:bg-rose-700 text-white text-xs"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              }
            >
              {isProcessingAction
                ? "Processing..."
                : actionType === "deactivate"
                ? "Confirm Deactivation"
                : "Confirm Reactivation"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
