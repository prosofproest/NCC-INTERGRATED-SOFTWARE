"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CadetDocumentMetadata } from "@/types/document";
import type { CategoryDefinition } from "@/types/fields";

interface CadetDocumentManagerProps {
  cadetId: string;
  cadetName?: string;
  userRole: "admin" | "cto" | "cadet";
  categories?: CategoryDefinition[];
}

export function CadetDocumentManager({
  cadetId,
  cadetName = "Cadet",
  userRole,
  categories = [],
}: CadetDocumentManagerProps) {
  const [documents, setDocuments] = useState<CadetDocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategoryId, setUploadCategoryId] = useState(
    categories[0]?.categoryId || "CAT_001"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Reject modal state (Admin only)
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectTargetDoc, setRejectTargetDoc] = useState<CadetDocumentMetadata | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?cadetId=${encodeURIComponent(cadetId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch documents (${res.status})`);
      }
      const data = await res.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [cadetId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/documents?cadetId=${encodeURIComponent(cadetId)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to fetch documents (${res.status})`);
        }
        const data = await res.json();
        if (!ignore) {
          setDocuments(data.documents || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load documents");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [cadetId]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File size exceeds 10MB limit.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
      if (!uploadTitle) {
        // Auto-fill title from clean filename
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setUploadTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Document title is required.");
      return;
    }
    if (!uploadCategoryId) {
      setUploadError("Please select a document category.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("cadetId", cadetId);
      formData.append("categoryId", uploadCategoryId);
      formData.append("title", uploadTitle.trim());

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Document upload failed");
      }

      setUploadSuccess("Document uploaded successfully to cloud repository.");
      setSelectedFile(null);
      setUploadTitle("");
      await fetchDocuments();
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Handle Document Verification (Admin)
  const handleVerify = async (docId: string) => {
    try {
      setVerifyingId(docId);
      const res = await fetch(`/api/admin/documents/${docId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: "verified" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to verify document");
      }
      await fetchDocuments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  };

  // Open Rejection Dialog (Admin)
  const openRejectModal = (doc: CadetDocumentMetadata) => {
    setRejectTargetDoc(doc);
    setRejectionReason("");
    setIsRejectOpen(true);
  };

  // Submit Rejection (Admin)
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetDoc) return;
    if (!rejectionReason.trim()) {
      alert("A rejection reason is required.");
      return;
    }

    try {
      setVerifyingId(rejectTargetDoc.documentId);
      const res = await fetch(`/api/admin/documents/${rejectTargetDoc.documentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationStatus: "rejected",
          rejectionReason: rejectionReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reject document");
      }

      setIsRejectOpen(false);
      setRejectTargetDoc(null);
      await fetchDocuments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setVerifyingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getVerificationBadge = (status: CadetDocumentMetadata["verificationStatus"]) => {
    switch (status) {
      case "verified":
        return <Badge variant="success">Verified</Badge>;
      case "rejected":
        return <Badge variant="danger">Rejected</Badge>;
      case "pending":
      default:
        return <Badge variant="warning">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Attached Documents ({documents.length})
          </h3>
          <p className="text-xs text-slate-500">
            Stored in Google Drive under cadet directory
          </p>
        </div>

        {/* Upload Action (Cadet & Admin only) */}
        {userRole !== "cto" && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setUploadError(null);
              setUploadSuccess(null);
              setIsUploadOpen(true);
            }}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-8 text-center text-xs text-slate-400">
          <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading cadet document repository...
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && documents.length === 0 && (
        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              No documents uploaded yet
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {userRole === "cto"
                ? "This cadet has not submitted any documents to the repository."
                : "Upload ID cards, marksheets, certificates, or regimental documents."}
            </p>
          </div>
          {userRole !== "cto" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
            >
              Upload First Document
            </Button>
          )}
        </div>
      )}

      {/* Document List Table / Cards */}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isSuperseded = doc.status === "superseded";

            return (
              <div
                key={doc.documentId}
                className={`p-4 rounded-xl border transition-all ${
                  isSuperseded
                    ? "bg-slate-50/60 border-slate-200/60 opacity-70"
                    : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Document Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">
                          {doc.title}
                        </span>
                        <Badge variant="outline" size="sm">
                          v{doc.version}
                        </Badge>
                        {isSuperseded && (
                          <Badge variant="default" size="sm">
                            Superseded
                          </Badge>
                        )}
                        {getVerificationBadge(doc.verificationStatus)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>{doc.fileName}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.sizeBytes)}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">{doc.documentId}</span>
                      </div>

                      {/* Rejection Note */}
                      {doc.verificationStatus === "rejected" && doc.rejectionReason && (
                        <div className="mt-2 text-xs bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-700">
                          <span className="font-semibold">Rejection reason:</span> {doc.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Secure Gated Download */}
                    <a
                      href={`/api/documents/${doc.documentId}/download`}
                      download={doc.fileName}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                      title="Download file securely from Google Drive"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>

                    {/* Admin Verification Controls */}
                    {userRole === "admin" && !isSuperseded && (
                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                        {doc.verificationStatus !== "verified" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={verifyingId === doc.documentId}
                            onClick={() => handleVerify(doc.documentId)}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          >
                            Verify
                          </Button>
                        )}

                        {doc.verificationStatus !== "rejected" && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={verifyingId === doc.documentId}
                            onClick={() => openRejectModal(doc)}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!uploading) setIsUploadOpen(false);
        }}
        title="Upload Cadet Document"
        description={`Securely upload and store attachments for ${cadetName} (${cadetId}) in Google Drive.`}
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              {uploadSuccess}
            </div>
          )}

          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Aadhaar Card, 10th Standard Marksheet"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Category *
            </label>
            <select
              value={uploadCategoryId}
              onChange={(e) => setUploadCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name} ({c.categoryId})
                </option>
              ))}
              {categories.length === 0 && (
                <>
                  <option value="CAT_001">Personal Information (CAT_001)</option>
                  <option value="CAT_002">Academic Details (CAT_002)</option>
                  <option value="CAT_003">NCC Regimental Details (CAT_003)</option>
                  <option value="CAT_004">Physical & Medical (CAT_004)</option>
                </>
              )}
            </select>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              File Attachment (PDF, JPG, PNG, WEBP, DOCX, XLSX — max 10MB) *
            </label>
            <input
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-900 file:text-white hover:file:opacity-90 cursor-pointer"
            />
            {selectedFile && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Replacement Warning Note */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800">
            <span className="font-semibold">Version Management:</span> Uploading a new file with the same title and category automatically preserves the previous version as superseded without deleting Drive history.
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => setIsUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={uploading}
              disabled={!selectedFile}
            >
              Upload to Drive
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rejection Modal (Admin Only) */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => {
          if (!verifyingId) setIsRejectOpen(false);
        }}
        title="Reject Document"
        description={`Provide a mandatory reason for rejecting '${rejectTargetDoc?.title}'. This explanation will be visible to the cadet.`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Scanned copy is illegible, missing official seal, or expired document."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(verifyingId)}
              onClick={() => setIsRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={Boolean(verifyingId)}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
