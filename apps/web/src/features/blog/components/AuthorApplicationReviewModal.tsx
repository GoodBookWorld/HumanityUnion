"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { AdminAuthorApplicationReview } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import {
  fetchAdminAuthorApplicationReview,
  inviteAuthorApplication,
  refuseAuthorApplication,
} from "../authoring-api";

import "../../../design-system/components/confirm-dialog.css";
import "../authoring.css";

export const AUTHOR_APPLICATION_REVIEW_EVENT = "blog_author_application_review_requested";

interface AuthorApplicationReviewModalProps {
  applicationId: string;
  isOpen: boolean;
  onClose: () => void;
  onDecided: () => void;
}

/**
 * Pack 13A — temporary Admin review dialog opened from Notification Center.
 */
export function AuthorApplicationReviewModal({
  applicationId,
  isOpen,
  onClose,
  onDecided,
}: AuthorApplicationReviewModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [review, setReview] = useState<AdminAuthorApplicationReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<"invite" | "refuse" | null>(null);
  const [refuseNote, setRefuseNote] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], textarea, input",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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

  useEffect(() => {
    if (!isOpen || !applicationId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionMessage(null);
    setRefuseNote("");

    void fetchAdminAuthorApplicationReview(applicationId)
      .then((data) => {
        if (!cancelled) {
          setReview(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReview(null);
          setError(
            isForbiddenError(err)
              ? "Administrator access is required to review Author applications."
              : formatAuthFormError(err),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleInvite() {
    setActionBusy("invite");
    setError(null);
    try {
      await inviteAuthorApplication(applicationId);
      setActionMessage("Author invited. Author access is now active.");
      onDecided();
      const refreshed = await fetchAdminAuthorApplicationReview(applicationId);
      setReview(refreshed);
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRefuse() {
    setActionBusy("refuse");
    setError(null);
    try {
      await refuseAuthorApplication(applicationId, refuseNote.trim() || undefined);
      setActionMessage("Application refused. No Author access was granted.");
      onDecided();
      const refreshed = await fetchAdminAuthorApplicationReview(applicationId);
      setReview(refreshed);
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusy(null);
    }
  }

  const pending = review?.status === "submitted" || review?.status === "under_review";
  const categoryNames = (review?.preferredCategoryIds ?? [])
    .map((id) => BLOG_CATEGORIES.find((category) => category.categoryId === id)?.name ?? id)
    .join(", ");

  return (
    <div className="hu-confirm-dialog__backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="hu-confirm-dialog author-application-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId} className="hu-heading-3">
          Author application review
        </h2>
        <p id={descriptionId} className="hu-caption">
          Invite activates Author publishing access for this Participant. Refuse keeps their
          normal account unchanged.
        </p>

        {loading ? <p className="hu-body">Loading application…</p> : null}
        {error ? <StatusBanner title="Review unavailable" message={error} /> : null}
        {actionMessage ? (
          <StatusBanner title="Action completed" message={actionMessage} />
        ) : null}

        {review ? (
          <div className="author-application-review-modal__body">
            <div className="author-application-review-modal__identity">
              {review.avatarUrl ? (
                <img
                  src={review.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="author-application-review-modal__avatar"
                />
              ) : (
                <span className="author-application-review-modal__avatar author-application-review-modal__avatar--empty" />
              )}
              <div>
                <strong>{review.displayName}</strong>
                {review.uniqueName ? (
                  <div className="hu-caption">@{review.uniqueName}</div>
                ) : null}
                <div className="hu-caption">{review.email}</div>
              </div>
            </div>

            <dl className="author-application-review-modal__meta">
              <div>
                <dt>Status</dt>
                <dd>{review.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{formatInitiativeDate(review.submittedAt)}</dd>
              </div>
            </dl>

            <section>
              <h3 className="hu-heading-4">Motivation</h3>
              <p className="hu-body">{review.motivation}</p>
            </section>
            <section>
              <h3 className="hu-heading-4">Topics</h3>
              <p className="hu-body">{review.topics}</p>
            </section>
            {review.previousWritingUrl ? (
              <section>
                <h3 className="hu-heading-4">Previous writing</h3>
                <p className="hu-body">
                  <a href={review.previousWritingUrl} target="_blank" rel="noreferrer">
                    {review.previousWritingUrl}
                  </a>
                </p>
              </section>
            ) : null}
            <section>
              <h3 className="hu-heading-4">Preferred categories</h3>
              <p className="hu-body">{categoryNames || "—"}</p>
            </section>
            <p className="hu-caption">
              Standards agreement: {review.agreedToStandards ? "Yes" : "No"}
            </p>

            {pending ? (
              <label className="author-application-review-modal__note">
                <span>Optional response for refusal</span>
                <textarea
                  value={refuseNote}
                  onChange={(event) => setRefuseNote(event.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="hu-confirm-dialog__actions">
          <Button type="button" variant="tertiary" onClick={onClose}>
            Close
          </Button>
          {pending ? (
            <>
              <Button
                type="button"
                variant="danger"
                disabled={actionBusy !== null}
                onClick={() => void handleRefuse()}
              >
                {actionBusy === "refuse" ? "Refusing…" : "Refuse"}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={actionBusy !== null}
                onClick={() => void handleInvite()}
              >
                {actionBusy === "invite" ? "Inviting…" : "Invite"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
