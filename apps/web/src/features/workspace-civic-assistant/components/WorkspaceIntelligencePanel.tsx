"use client";

import Link from "next/link";

import {
  ASSISTANT_COMING_SOON_INPUT,
  ASSISTANT_INPUT_LABEL,
  ASSISTANT_SAFETY_NOTE,
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

  return (
    <div className="workspace-civic-assistant__panel">
      <header className="workspace-civic-assistant__header">
        <h2 className="workspace-civic-assistant__title">Civic Assistant</h2>
        <p className="workspace-civic-assistant__section-label">{sectionLabel}</p>
      </header>

      <dl className="workspace-civic-assistant__meta">
        {participantName ? (
          <div>
            <dt>Participant</dt>
            <dd>{participantName}</dd>
          </div>
        ) : null}
        {participationAreaLabel != null && participationAreaLabel !== "" ? (
          <div>
            <dt>Participation Area</dt>
            <dd>{participationAreaLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt>Civic stage</dt>
          <dd>{intelligence?.currentCivicStage ?? "Not started"}</dd>
        </div>
        <div>
          <dt>Next milestone</dt>
          <dd>{intelligence?.nextCivicMilestone ?? "None suggested"}</dd>
        </div>
        <div>
          <dt>Responsibilities</dt>
          <dd>
            {intelligence?.currentResponsibilities.length
              ? intelligence.currentResponsibilities.join("; ")
              : "None open"}
          </dd>
        </div>
        <div>
          <dt>Unread notifications</dt>
          <dd>{intelligence?.context.unreadNotificationCount ?? 0}</dd>
        </div>
      </dl>

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
