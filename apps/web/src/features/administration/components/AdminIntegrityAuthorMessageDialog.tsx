"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { ApiRequestError, formatAuthFormError } from "../../../lib/api-client";
import { sendAdminIntegrityMediaAuthorMessage } from "../admin-integrity-media-authors-api";
import {
  buildIntegrityMediaAuthorMessageRequest,
  integrityMediaAuthorDeliveryCopy,
  interpretIntegrityMediaAuthorDelivery,
  validateIntegrityMediaAuthorMessageForm,
  type IntegrityMediaAuthorDeliveryStatus,
} from "../admin-integrity-media-authors-model";

import "../../../design-system/components/confirm-dialog.css";
import "./admin-integrity-author-message-dialog.css";

interface AdminIntegrityAuthorMessageDialogProps {
  memberId: string;
  participantDisplayName: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type FieldName = "title" | "body" | "ctaLabel" | "ctaUrl";

const SAFE_SEND_ERRORS: Record<string, string> = {
  link_missing: "This member is not linked to Integrity Media.",
  link_disabled: "This Integrity Media connection is disabled.",
  author_setup_pending: "Integrity Media author setup is still finishing.",
  administrator_required: "Administrator access is required.",
  authentication_required: "Authentication is required.",
};

export function AdminIntegrityAuthorMessageDialog({
  memberId,
  participantDisplayName,
  isOpen,
  onClose,
  onRefresh,
}: AdminIntegrityAuthorMessageDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>("input, textarea, button");
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!submittingRef.current) {
          onClose();
        }
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    const errors = validateIntegrityMediaAuthorMessageForm({ title, body, ctaLabel, ctaUrl });
    if (errors) {
      setFieldErrors(errors);
      setResultTitle(null);
      setResultMessage(null);
      return;
    }

    setFieldErrors({});
    submittingRef.current = true;
    setSubmitting(true);
    setResultTitle(null);
    setResultMessage(null);
    try {
      const payload = buildIntegrityMediaAuthorMessageRequest({ title, body, ctaLabel, ctaUrl });
      const data = await sendAdminIntegrityMediaAuthorMessage(memberId, payload);
      const interpreted = interpretIntegrityMediaAuthorDelivery(data?.status);
      const copy = integrityMediaAuthorDeliveryCopy(interpreted.ok ? interpreted.status : "unknown");
      setResultTitle(copy.title);
      setResultMessage(
        interpreted.ok && interpreted.status === "failed" && data.lastErrorCode
          ? `${copy.message} (${data.lastErrorCode})`
          : copy.message,
      );
    } catch (error: unknown) {
      setResultTitle("Message not sent");
      setResultMessage(safeSendError(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      onRefresh();
    }
  }

  return (
    <div className="hu-confirm-dialog__backdrop" role="presentation" onClick={() => {
      if (!submitting) {
        onClose();
      }
    }}>
      <div
        ref={dialogRef}
        className="hu-confirm-dialog admin-integrity-author-message-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-integrity-author-message-dialog__header">
          <h2 id={titleId} className="hu-heading-3">
            Send Message
          </h2>
          <p id={descriptionId} className="hu-body">
            Send to the Integrity Media author linked with Humanity Union Participant{" "}
            {participantDisplayName}. Delivery status comes from the server.
          </p>
        </header>
        <form className="admin-integrity-author-message-dialog__form" onSubmit={(event) => {
          void handleSubmit(event);
        }}>
          <div className="admin-integrity-author-message-dialog__body">
            <label htmlFor="integrity-author-message-title">
              Title
              <input
                id="integrity-author-message-title"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={fieldErrors.title ? true : undefined}
                aria-describedby={fieldErrors.title ? "integrity-author-message-title-error" : undefined}
              />
            </label>
            {fieldErrors.title ? (
              <p id="integrity-author-message-title-error" className="hu-caption" role="alert">
                {fieldErrors.title}
              </p>
            ) : null}

            <label htmlFor="integrity-author-message-body">
              Body
              <textarea
                id="integrity-author-message-body"
                value={body}
                rows={6}
                maxLength={8000}
                onChange={(event) => setBody(event.target.value)}
                aria-invalid={fieldErrors.body ? true : undefined}
                aria-describedby={fieldErrors.body ? "integrity-author-message-body-error" : undefined}
              />
            </label>
            {fieldErrors.body ? (
              <p id="integrity-author-message-body-error" className="hu-caption" role="alert">
                {fieldErrors.body}
              </p>
            ) : null}

            <label htmlFor="integrity-author-message-cta-label">
              Link label
              <input
                id="integrity-author-message-cta-label"
                value={ctaLabel}
                maxLength={120}
                onChange={(event) => setCtaLabel(event.target.value)}
                aria-invalid={fieldErrors.ctaLabel ? true : undefined}
                aria-describedby={
                  fieldErrors.ctaLabel ? "integrity-author-message-cta-label-error" : undefined
                }
              />
            </label>
            {fieldErrors.ctaLabel ? (
              <p id="integrity-author-message-cta-label-error" className="hu-caption" role="alert">
                {fieldErrors.ctaLabel}
              </p>
            ) : null}

            <label htmlFor="integrity-author-message-cta-url">
              Link URL
              <input
                id="integrity-author-message-cta-url"
                value={ctaUrl}
                inputMode="url"
                maxLength={2000}
                onChange={(event) => setCtaUrl(event.target.value)}
                aria-invalid={fieldErrors.ctaUrl ? true : undefined}
                aria-describedby={fieldErrors.ctaUrl ? "integrity-author-message-cta-url-error" : undefined}
              />
            </label>
            {fieldErrors.ctaUrl ? (
              <p id="integrity-author-message-cta-url-error" className="hu-caption" role="alert">
                {fieldErrors.ctaUrl}
              </p>
            ) : null}

            {resultTitle && resultMessage ? (
              <StatusBanner title={resultTitle} message={resultMessage} />
            ) : null}
          </div>

          <div className="admin-integrity-author-message-dialog__actions">
            <Button type="button" disabled={submitting} onClick={onClose}>
              Close
            </Button>
            <AdminIntegrityAuthorSendButton submitting={submitting} />
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminIntegrityAuthorSendButton({ submitting }: { submitting: boolean }) {
  return (
    <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
      {submitting ? "Sending…" : "Send"}
    </Button>
  );
}

export function AdminIntegrityAuthorDeliveryNotice({
  status,
}: {
  status: IntegrityMediaAuthorDeliveryStatus | "unknown";
}) {
  const copy = integrityMediaAuthorDeliveryCopy(status);
  return <StatusBanner title={copy.title} message={copy.message} />;
}

function safeSendError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const code = typeof error.meta?.code === "string" ? error.meta.code : "";
    const safe = SAFE_SEND_ERRORS[code];
    if (safe) {
      return safe;
    }
  }
  return formatAuthFormError(error);
}
