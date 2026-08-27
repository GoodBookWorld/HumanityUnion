"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  fetchPublicSuspensionReview,
  submitPublicSuspensionReview,
} from "../admin-participant-suspension-api";

import "../../auth/components/auth-form.css";
import "./suspension-review.css";

/**
 * Pack 24B — token-only suspension review request page.
 * No sign-in required. Does not expose moderation internals.
 */
export function SuspensionReviewRequestForm() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const explanationId = useId();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [reasonLabel, setReasonLabel] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [explanation, setExplanation] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setLoading(false);
      setError("This review link is missing or incomplete.");
      return;
    }

    void fetchPublicSuspensionReview(token)
      .then((review) => {
        if (cancelled) {
          return;
        }
        setDisplayName(review.displayName);
        setReasonLabel(review.reasonLabel);
        setAlreadySubmitted(review.alreadySubmitted);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(formatAuthFormError(caught));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || submitting || alreadySubmitted) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await submitPublicSuspensionReview({ token, explanation });
      setAlreadySubmitted(true);
      setSuccess("Your review request was sent. An administrator will review it.");
    } catch (caught: unknown) {
      setError(formatAuthFormError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="hu-body">Loading review form…</p>;
  }

  if (error && !displayName) {
    return <StatusBanner title="Review unavailable" message={error} />;
  }

  return (
    <div className="suspension-review">
      {error ? <StatusBanner title="Unable to submit" message={error} /> : null}
      {success ? <StatusBanner title="Request sent" message={success} /> : null}

      <p className="hu-body suspension-review__lede">
        {displayName ? (
          <>
            Account: <strong>{displayName}</strong>
          </>
        ) : null}
        {reasonLabel ? (
          <>
            {displayName ? <br /> : null}
            Suspension reason: <strong>{reasonLabel}</strong>
          </>
        ) : null}
      </p>

      {alreadySubmitted ? (
        <p className="hu-body">
          A review request is already pending for this suspension. No further action is needed.
        </p>
      ) : (
        <form className="auth-form suspension-review__form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="auth-form__label" htmlFor={explanationId}>
            Explain why you are requesting restoration of access
          </label>
          <textarea
            id={explanationId}
            className="auth-form__input suspension-review__textarea"
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={6}
            maxLength={2000}
            required
            disabled={submitting}
          />
          <Button type="submit" variant="primary" disabled={submitting || explanation.trim().length < 10}>
            {submitting ? "Sending…" : "Send unblocking request"}
          </Button>
        </form>
      )}
    </div>
  );
}
