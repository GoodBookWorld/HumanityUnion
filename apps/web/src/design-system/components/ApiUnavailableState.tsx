"use client";

import { useTranslations } from "next-intl";

import { Button } from "./Button";

interface ApiUnavailableStateProps {
  title: string;
  explanation: string;
  possibleReason?: string;
  retryHref: string;
  retryLabel?: string;
  homeLabel?: string;
}

/**
 * Shared API-unavailable chrome.
 * Pack 02E Task 03 — default action labels from `common.retry` / `common.backToHome`;
 * caller overrides (e.g. Workspace "Retry" / "Return Home") remain presentation-only overrides.
 */
export function ApiUnavailableState({
  title,
  explanation,
  possibleReason,
  retryHref,
  retryLabel,
  homeLabel,
}: ApiUnavailableStateProps) {
  const tCommon = useTranslations("common");
  const resolvedRetryLabel = retryLabel ?? tCommon("retry");
  const resolvedHomeLabel = homeLabel ?? tCommon("backToHome");

  return (
    <section className="hu-unavailable" role="alert" aria-live="polite">
      <h1 className="hu-unavailable__title">{title}</h1>
      <p className="hu-unavailable__explanation">{explanation}</p>
      {possibleReason ? (
        <p className="hu-unavailable__reason">
          <strong>Possible reason:</strong> {possibleReason}
        </p>
      ) : null}
      <div className="hu-unavailable__actions">
        <Button href={retryHref} variant="primary">
          {resolvedRetryLabel}
        </Button>
        <Button href="/" variant="secondary">
          {resolvedHomeLabel}
        </Button>
      </div>
    </section>
  );
}
