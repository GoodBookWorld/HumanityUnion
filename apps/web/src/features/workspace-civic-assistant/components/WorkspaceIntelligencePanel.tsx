"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ASSISTANT_COMING_SOON_INPUT,
  ASSISTANT_COPIED_LABEL,
  ASSISTANT_COPY_LABEL,
  ASSISTANT_FUTURE_CAPABILITIES,
  ASSISTANT_INPUT_LABEL,
  ASSISTANT_SAFETY_NOTE,
  ASSISTANT_SHARED_LABEL,
  ASSISTANT_SHARE_LABEL,
} from "../constants";
import type { WorkspaceIntelligenceResponse } from "../workspace-intelligence-api";

import "./workspace-civic-assistant.css";

interface WorkspaceIntelligencePanelProps {
  sectionLabel: string;
  participantName?: string;
  participationAreaLabel?: string | null;
  intelligence: WorkspaceIntelligenceResponse | null;
  loading: boolean;
  error: string | null;
  showAssistantInputPlaceholder?: boolean;
}

function formatPriorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * Recovery Task 33 — Workspace UX Evolution, Part 10.
 *
 * Real, working UI actions (not AI): "Copy" copies the current top
 * recommendation (or a sensible fallback summary) as plain text; "Share"
 * uses the native Web Share API when available, falling back to copying a
 * link to the workspace to the clipboard. Neither calls any backend
 * endpoint or AI service.
 */
function useCopyShareActions(
  intelligence: WorkspaceIntelligenceResponse | null,
): {
  copyLabel: string;
  shareLabel: string;
  handleCopy: () => void;
  handleShare: () => void;
} {
  const [copyLabel, setCopyLabel] = useState<string>(ASSISTANT_COPY_LABEL);
  const [shareLabel, setShareLabel] = useState<string>(ASSISTANT_SHARE_LABEL);

  function buildShareText(): string {
    const top = intelligence?.topRecommendation;

    if (top) {
      return `${top.title}\n${top.description}\n${top.reason}`;
    }

    return intelligence?.constitutionalSummary ?? "Civic Assistant — Humanity Union Workspace";
  }

  function handleCopy() {
    const text = buildShareText();

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyLabel(ASSISTANT_COPIED_LABEL);
        setTimeout(() => setCopyLabel(ASSISTANT_COPY_LABEL), 2000);
      })
      .catch(() => {
        /* Clipboard access denied or unavailable — no-op, button remains as-is. */
      });
  }

  function handleShare() {
    const text = buildShareText();
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";

    if (typeof navigator.share === "function") {
      navigator.share({ title: "Civic Assistant", text, url: shareUrl }).catch(() => {
        /* User cancelled the native share sheet — no-op. */
      });
      return;
    }

    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setShareLabel(ASSISTANT_SHARED_LABEL);
        setTimeout(() => setShareLabel(ASSISTANT_SHARE_LABEL), 2000);
      })
      .catch(() => {
        /* Clipboard access denied or unavailable — no-op, button remains as-is. */
      });
  }

  return { copyLabel, shareLabel, handleCopy, handleShare };
}

export function WorkspaceIntelligencePanel({
  sectionLabel,
  participantName,
  participationAreaLabel,
  intelligence,
  loading,
  error,
  showAssistantInputPlaceholder = false,
}: WorkspaceIntelligencePanelProps) {
  const topRecommendation = intelligence?.topRecommendation ?? null;
  const secondaryRecommendations = intelligence?.suggestions.slice(1) ?? [];
  const blockedActions = intelligence?.blockedActions ?? [];
  const { copyLabel, shareLabel, handleCopy, handleShare } = useCopyShareActions(intelligence);

  return (
    <div className="workspace-civic-assistant__panel">
      <header className="workspace-civic-assistant__header">
        <div className="workspace-civic-assistant__header-row">
          <h2 className="workspace-civic-assistant__title">Civic Assistant</h2>
          <div className="workspace-civic-assistant__quick-actions">
            <button type="button" className="workspace-civic-assistant__quick-action" onClick={handleCopy}>
              {copyLabel}
            </button>
            <button type="button" className="workspace-civic-assistant__quick-action" onClick={handleShare}>
              {shareLabel}
            </button>
          </div>
        </div>
        <p className="workspace-civic-assistant__section-label">{sectionLabel}</p>
      </header>

      <ul className="workspace-civic-assistant__meta" aria-label="Civic assistant context">
        {participantName ? (
          <li>
            <span className="workspace-civic-assistant__meta-label">Participant</span>
            <span className="workspace-civic-assistant__meta-value">{participantName}</span>
          </li>
        ) : null}
        {participationAreaLabel != null && participationAreaLabel !== "" ? (
          <li>
            <span className="workspace-civic-assistant__meta-label">Participation Area</span>
            <span className="workspace-civic-assistant__meta-value">{participationAreaLabel}</span>
          </li>
        ) : null}
        <li>
          <span className="workspace-civic-assistant__meta-label">Civic stage</span>
          <span className="workspace-civic-assistant__meta-value">
            {intelligence?.currentCivicStage ?? "Not started"}
          </span>
        </li>
        <li>
          <span className="workspace-civic-assistant__meta-label">Next milestone</span>
          <span className="workspace-civic-assistant__meta-value">
            {intelligence?.nextCivicMilestone ?? "None suggested"}
          </span>
        </li>
        <li>
          <span className="workspace-civic-assistant__meta-label">Responsibilities</span>
          <span className="workspace-civic-assistant__meta-value">
            {intelligence?.currentResponsibilities.length
              ? intelligence.currentResponsibilities.join("; ")
              : "None open"}
          </span>
        </li>
        <li>
          <span className="workspace-civic-assistant__meta-label">Unread notifications</span>
          <span className="workspace-civic-assistant__meta-value">
            {intelligence?.context.unreadNotificationCount ?? 0}
          </span>
        </li>
      </ul>

      {loading ? (
        <p className="workspace-civic-assistant__summary">Loading civic intelligence...</p>
      ) : null}

      {error ? (
        <p className="workspace-civic-assistant__placeholder-notice" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && intelligence ? (
        <>
          <section
            aria-label="Constitutional explanation"
            className="workspace-intelligence__section"
          >
            <h3>Constitutional explanation</h3>
            <p className="workspace-civic-assistant__summary">
              {intelligence.constitutionalSummary}
            </p>
          </section>

          <section aria-label="Top recommendation" className="workspace-intelligence__section">
            <h3>Top recommendation</h3>
            {topRecommendation ? (
              <article className="workspace-intelligence__card workspace-intelligence__card--top">
                <p className="workspace-intelligence__priority">
                  {formatPriorityLabel(topRecommendation.priority)}
                </p>
                <h4>{topRecommendation.title}</h4>
                <p>{topRecommendation.description}</p>
                <p className="workspace-intelligence__reason">{topRecommendation.reason}</p>
                <Link
                  className="workspace-intelligence__nav-link"
                  href={topRecommendation.relatedRoute}
                >
                  {topRecommendation.recommendedAction}
                </Link>
              </article>
            ) : (
              <p className="workspace-civic-assistant__summary">
                No immediate civic action is recommended based on current records.
              </p>
            )}
          </section>

          {secondaryRecommendations.length > 0 ? (
            <section
              aria-label="Secondary recommendations"
              className="workspace-intelligence__section"
            >
              <h3>Secondary recommendations</h3>
              <ul className="workspace-intelligence__list">
                {secondaryRecommendations.map((suggestion) => (
                  <li key={suggestion.suggestionId}>
                    <article className="workspace-intelligence__card">
                      <p className="workspace-intelligence__priority">
                        {formatPriorityLabel(suggestion.priority)}
                      </p>
                      <h4>{suggestion.title}</h4>
                      <p>{suggestion.description}</p>
                      <Link
                        className="workspace-intelligence__nav-link"
                        href={suggestion.relatedRoute}
                      >
                        {suggestion.recommendedAction}
                      </Link>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {blockedActions.length > 0 ? (
            <section aria-label="Blocked items" className="workspace-intelligence__section">
              <h3>Blocked items</h3>
              <ul className="workspace-intelligence__list">
                {blockedActions.map((blocked) => (
                  <li key={blocked.actionId}>
                    <article className="workspace-intelligence__card workspace-intelligence__card--blocked">
                      <h4>{blocked.title}</h4>
                      <p>{blocked.reason}</p>
                      <p className="workspace-intelligence__blocked-by">
                        Blocked by: {blocked.blockedBy}
                      </p>
                      <p className="workspace-intelligence__reason">
                        {blocked.constitutionalReference}
                      </p>
                      {blocked.relatedRoute ? (
                        <Link
                          className="workspace-intelligence__nav-link"
                          href={blocked.relatedRoute}
                        >
                          Review related record
                        </Link>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <section aria-label="Coming soon" className="workspace-intelligence__section">
        <h3>Coming soon</h3>
        <p className="workspace-civic-assistant__summary">
          The assistant will eventually help with tasks like these:
        </p>
        <div className="workspace-civic-assistant__future-capabilities">
          {ASSISTANT_FUTURE_CAPABILITIES.map((capability) => (
            <button
              key={capability}
              type="button"
              className="workspace-civic-assistant__future-chip"
              disabled
              aria-disabled="true"
              title="Not available yet"
            >
              {capability}
            </button>
          ))}
        </div>
      </section>

      {showAssistantInputPlaceholder ? (
        <section
          aria-label="Assistant input placeholder"
          className="workspace-civic-assistant__chat"
        >
          <label
            className="workspace-civic-assistant__input-label"
            htmlFor="workspace-assistant-input"
          >
            {ASSISTANT_INPUT_LABEL}
          </label>
          <textarea
            id="workspace-assistant-input"
            className="workspace-civic-assistant__input"
            disabled
            readOnly
            value=""
            placeholder={ASSISTANT_COMING_SOON_INPUT}
            aria-disabled="true"
          />
        </section>
      ) : null}

      <p className="workspace-civic-assistant__safety">{ASSISTANT_SAFETY_NOTE}</p>
    </div>
  );
}
