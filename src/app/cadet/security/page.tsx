"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CadetRecord } from "@/types/cadet";

export default function CadetSecurityPage() {
  const [cadet, setCadet] = useState<CadetRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/cadet/profile")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load account details");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setCadet(data.cadet);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordSuccess("Your account password was updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Error changing password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Security &amp; Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your cadet portal authentication credentials and view account status.
        </p>
      </div>

      {/* Account Profile Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Account Status</CardTitle>
              <CardDescription>
                System verification and security credentials overview.
              </CardDescription>
            </div>
            <Badge variant="success" size="sm">
              Active Account
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-xs text-slate-400">Loading account status...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Registered Email</span>
                <p className="font-semibold text-slate-900 text-sm">
                  {cadet?.email || "Authenticated Cadet"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Cadet ID Reference</span>
                <p className="font-mono font-bold text-slate-900 text-sm">
                  {cadet?.cadetId || "Unlinked"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-medium">Access Role</span>
                <div>
                  <Badge variant="primary" size="sm">
                    Cadet Portal
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your portal login password. Use a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {passwordError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" isLoading={savingPassword}>
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
