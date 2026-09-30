"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { AuditLogEntry, AuditActorRole } from "@/types/audit";
import { AuditDiffViewer } from "./AuditDiffViewer";

interface AuditDetailModalProps {
  log: AuditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailModal({ log, isOpen, onClose }: AuditDetailModalProps) {
  const [copiedId, setCopiedId] = useState(false);

  if (!log) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getRoleBadgeVariant = (role: AuditActorRole): BadgeVariant => {
    switch (role) {
      case "admin":
        return "navy";
      case "cto":
        return "army";
      case "cadet":
        return "air";
      case "system":
      default:
        return "default";
    }
  };

  const formattedDate = new Date(log.timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const metadataEntries = Object.entries(log.metadata || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Audit Record: ${log.logId}`}
      description={`Captured on ${formattedDate}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Core Attributes Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Action
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
              {log.action}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Actor Role & Email
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(log.actorRole)} size="sm">
                {log.actorRole.toUpperCase()}
              </Badge>
              <span className="text-slate-800 font-medium truncate">
                {log.actorEmail}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Target Entity
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="primary" size="sm">
                {log.entityType}
              </Badge>
              <span className="font-mono text-slate-700 font-semibold truncate">
                {log.entityId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(log.entityId)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Copy Entity ID"
              >
                {copiedId ? "✓" : "📋"}
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Actor UID
            </span>
            <span className="font-mono text-slate-600 truncate block">
              {log.actorId}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              IP Address
            </span>
            <span className="font-mono text-slate-600">
              {log.ipAddress || "unknown"}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Exact Timestamp (UTC)
            </span>
            <span className="font-mono text-slate-600 text-[11px]">
              {log.timestamp}
            </span>
          </div>
        </div>

        {/* User Agent */}
        {log.userAgent && log.userAgent !== "unknown" && (
          <div className="text-xs">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Client User Agent
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-[11px] font-mono text-slate-600 break-all">
              {log.userAgent}
            </div>
          </div>
        )}

        {/* State Changes / Diff */}
        <div className="space-y-2">
          <AuditDiffViewer
            previousState={log.previousState}
            newState={log.newState}
          />
        </div>

        {/* Event Metadata (if present) */}
        {metadataEntries.length > 0 && (
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              Event Metadata
            </span>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {metadataEntries.map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">
                      {key}
                    </span>
                    <span className="font-mono text-slate-800 break-all">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Immutability Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Immutable Audit Log • Read-Only Security Record</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
