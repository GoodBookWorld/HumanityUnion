"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

import type { SharedDocumentContextRef, SharedDocumentVerificationStatus, SharedDocumentView } from "@hu/types";

import { ApiRequestError } from "../../../lib/api-client";
import {
  downloadSharedDocument,
  listSharedDocuments,
  removeSharedDocument,
  replaceSharedDocument,
  uploadSharedDocument,
} from "../api";
import { formatSharedDocumentSize, formatSharedDocumentTimestamp, sharedDocumentTypeLabel } from "../shared-documents-format";

import "./shared-documents.css";

/**
 * Communication UX Pack 03.7 Part 2 — matches the server allowlist
 * exactly (`shared-documents.validators.ts`). Client-side only: a
 * convenience `accept` hint and an early, friendlier rejection message —
 * the server remains the sole source of truth and re-validates every
 * upload independently.
 */
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".docx",
  ".xlsx",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.join(",");

const VERIFICATION_BADGE_LABEL: Record<SharedDocumentVerificationStatus, string> = {
  approved: "Verified",
  review_required: "Could not be automatically verified",
  rejected: "Rejected",
  malware_detected: "Blocked",
};

/**
 * Part 4/14 — never a bare colored dot: every badge always pairs a
 * status dot with its own text label, so screen readers and color-blind
 * viewers get the same information as everyone else.
 */
function SharedDocumentVerificationBadge({ status }: { status: SharedDocumentVerificationStatus }) {
  return (
    <span className={`sd-badge sd-badge--${status}`}>
      <span className="sd-badge__dot" aria-hidden="true" />
      {VERIFICATION_BADGE_LABEL[status]}
    </span>
  );
}

function SharedDocumentFileIcon({ extension }: { extension: string }) {
  return (
    <span className="sd-file-icon" aria-hidden="true">
      {sharedDocumentTypeLabel(extension)}
    </span>
  );
}

function validateFileBeforeUpload(file: File): string | null {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return "This file type is not supported. Allowed types: PDF, PNG, JPG, JPEG, WEBP, TXT, DOCX, XLSX, PPTX, ODT, ODS, ODP.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File exceeds the 20 MB size limit.";
  }

  return null;
}

interface SharedDocumentsPanelProps {
  context: SharedDocumentContextRef;
  /** Part 6 — every surface heads its Shared Documents section with the same label; only the surrounding page differs. */
  title?: string;
}

/**
 * Communication UX Pack 03.8 Part 3/8 — lets a hosting surface's own
 * composer/toolbar "Attach file" control trigger this exact same upload
 * picker and pipeline (never a second upload implementation) instead of
 * requiring the Participant to first expand this panel themselves.
 */
export interface SharedDocumentsPanelHandle {
  openUploadPicker: () => void;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Communication UX Pack 03.7 — the one reusable Shared Documents section
 * every communication surface (Direct Conversation, Collaboration
 * Channel, Collaboration Session) mounts unchanged, differing only in
 * which `context` it is given (Part 1: one unified module, never a
 * per-surface reimplementation).
 */
export const SharedDocumentsPanel = forwardRef<SharedDocumentsPanelHandle, SharedDocumentsPanelProps>(
  function SharedDocumentsPanel({ context, title = "Shared Documents" }, forwardedRef) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SharedDocumentView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  /** Part 6/11 — visible by default on every surface; the collapse affordance only reduces clutter, it never gates first load. */
  const [expanded, setExpanded] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const inputId = useId();

  // `context` is re-created as a fresh literal on every parent render (its
  // shape, not its identity, is what matters); keying off its serialized
  // value instead of the object reference avoids re-fetching on every
  // parent re-render while still reloading whenever the context actually
  // changes (e.g. navigating to a different Conversation/Session).
  const contextKey = JSON.stringify(context);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const result = await listSharedDocuments(context);
      setDocuments(result.documents);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof ApiRequestError ? error.message : "Unable to load Shared Documents. Please try again.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const clientError = validateFileBeforeUpload(file);

    if (clientError) {
      setUploadError(clientError);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const uploaded = await uploadSharedDocument(context, file);
      setDocuments((current) => [uploaded, ...current]);
      setStatusMessage(`${uploaded.fileName} uploaded.`);
    } catch (error) {
      setUploadError(
        error instanceof ApiRequestError ? error.message : "Unable to upload this file. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleReplaceInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const documentId = replaceTargetIdRef.current;
    event.target.value = "";
    replaceTargetIdRef.current = null;

    if (!file || !documentId) {
      return;
    }

    const clientError = validateFileBeforeUpload(file);

    if (clientError) {
      setUploadError(clientError);
      return;
    }

    setBusyDocumentId(documentId);
    setUploadError(null);

    try {
      const replaced = await replaceSharedDocument(context, documentId, file);
      setDocuments((current) => current.map((doc) => (doc.documentId === documentId ? replaced : doc)));
      setStatusMessage(`${replaced.fileName} replaced with a new version.`);
    } catch (error) {
      setUploadError(
        error instanceof ApiRequestError ? error.message : "Unable to replace this document. Please try again.",
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  function requestReplace(documentId: string) {
    replaceTargetIdRef.current = documentId;
    replaceInputRef.current?.click();
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      openUploadPicker: () => {
        setExpanded(true);
        fileInputRef.current?.click();
      },
    }),
    [],
  );

  async function handleRemove(document: SharedDocumentView) {
    if (!window.confirm(`Remove "${document.fileName}"? This cannot be undone.`)) {
      return;
    }

    setBusyDocumentId(document.documentId);
    setUploadError(null);

    try {
      await removeSharedDocument(context, document.documentId);
      setDocuments((current) => current.filter((doc) => doc.documentId !== document.documentId));
      setStatusMessage(`${document.fileName} removed.`);
    } catch (error) {
      setUploadError(
        error instanceof ApiRequestError ? error.message : "Unable to remove this document. Please try again.",
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleDownload(document: SharedDocumentView) {
    setBusyDocumentId(document.documentId);
    setUploadError(null);

    try {
      await downloadSharedDocument(context, document.documentId, document.fileName);
    } catch (error) {
      setUploadError(
        error instanceof ApiRequestError ? error.message : "Unable to download this document. Please try again.",
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  return (
    <section className="sd-panel" aria-labelledby={`${inputId}-title`}>
      <button
        type="button"
        className="sd-panel__toggle"
        aria-expanded={expanded}
        aria-controls={`${inputId}-body`}
        onClick={() => setExpanded((current) => !current)}
      >
        <span id={`${inputId}-title`} className="sd-panel__title">
          {title}
          {documents.length > 0 ? <span className="sd-panel__count">{documents.length}</span> : null}
        </span>
        <span className="sd-panel__toggle-icon" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>

      <div id={`${inputId}-body`} className="sd-panel__body" hidden={!expanded}>
        <div className="sd-panel__actions">
          <label htmlFor={`${inputId}-upload`} className="hu-button hu-button--secondary sd-panel__upload-label">
            {uploading ? "Uploading…" : "Upload document"}
          </label>
          <input
            id={`${inputId}-upload`}
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sd-panel__file-input"
            disabled={uploading}
            onChange={(event) => void handleUploadInputChange(event)}
          />
          <p className="sd-panel__hint">PDF, images, or office documents up to 20 MB.</p>
        </div>

        <input
          ref={replaceInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sd-panel__file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => void handleReplaceInputChange(event)}
        />

        {uploadError ? (
          <p className="sd-panel__status sd-panel__status--error" role="alert">
            {uploadError}
          </p>
        ) : null}

        <p className="sd-panel__visually-hidden" role="status" aria-live="polite">
          {statusMessage ?? ""}
        </p>

        {loadState === "loading" && documents.length === 0 ? (
          <p className="sd-panel__status" role="status">
            Loading Shared Documents…
          </p>
        ) : null}

        {loadState === "error" && documents.length === 0 ? (
          <p className="sd-panel__status sd-panel__status--error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {loadState !== "loading" || documents.length > 0 ? (
          documents.length === 0 ? (
            <p className="sd-panel__status">No documents shared yet.</p>
          ) : (
            <ul className="sd-list">
              {documents.map((document) => (
                <li key={document.documentId} className="sd-list__item">
                  <SharedDocumentFileIcon extension={document.extension} />
                  <div className="sd-list__details">
                    <span className="sd-list__file-name">{document.fileName}</span>
                    <span className="sd-list__meta">
                      <span>{formatSharedDocumentSize(document.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{document.uploadedBy.displayName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatSharedDocumentTimestamp(document.uploadedAt)}</span>
                    </span>
                    <SharedDocumentVerificationBadge status={document.verificationStatus} />
                  </div>
                  <div className="sd-list__actions">
                    {document.canDownload ? (
                      <button
                        type="button"
                        className="sd-list__action-button"
                        disabled={busyDocumentId === document.documentId}
                        onClick={() => void handleDownload(document)}
                        aria-label={`Download ${document.fileName}`}
                      >
                        Download
                      </button>
                    ) : null}
                    {document.canManage ? (
                      <>
                        <button
                          type="button"
                          className="sd-list__action-button"
                          disabled={busyDocumentId === document.documentId}
                          onClick={() => requestReplace(document.documentId)}
                          aria-label={`Replace ${document.fileName} with a new version`}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="sd-list__action-button sd-list__action-button--danger"
                          disabled={busyDocumentId === document.documentId}
                          onClick={() => void handleRemove(document)}
                          aria-label={`Remove ${document.fileName}`}
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
  },
);
