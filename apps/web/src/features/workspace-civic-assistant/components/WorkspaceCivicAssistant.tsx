"use client";

import { useEffect, useMemo, useState } from "react";

import type { Initiative } from "@hu/types";

import { getCivicIntegrationView } from "../../capability02-integration/api";
import { buildAssistantContext } from "../build-assistant-context";
import {
  ASSISTANT_COMING_SOON_INPUT,
  ASSISTANT_GREETING,
  ASSISTANT_INPUT_LABEL,
  ASSISTANT_PLACEHOLDER_MESSAGE,
  ASSISTANT_SAFETY_NOTE,
  ASSISTANT_TITLE,
} from "../constants";
import { getSuggestedActionsForSection } from "../section-actions";

import "./workspace-civic-assistant.css";

interface WorkspaceCivicAssistantProps {
  initiative: Initiative | null;
  currentSection: string;
}

export function WorkspaceCivicAssistant({
  initiative,
  currentSection,
}: WorkspaceCivicAssistantProps) {
  const [integrationView, setIntegrationView] = useState<Awaited<
    ReturnType<typeof getCivicIntegrationView>
  > | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [placeholderMessage, setPlaceholderMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: "assistant"; text: string }>>([
    { id: "greeting", role: "assistant", text: ASSISTANT_GREETING },
  ]);

  useEffect(() => {
    if (!initiative?.initiativeId) {
      setIntegrationView(null);
      return;
    }

    let cancelled = false;

    void getCivicIntegrationView("initiative", initiative.initiativeId).then((view) => {
      if (!cancelled) {
        setIntegrationView(view);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initiative?.initiativeId]);

  const context = useMemo(
    () =>
      buildAssistantContext({
        initiative,
        currentSection,
        integrationView,
      }),
    [currentSection, initiative, integrationView],
  );

  const suggestedActions = useMemo(
    () => getSuggestedActionsForSection(currentSection, initiative),
    [currentSection, initiative],
  );

  function handleSuggestedAction(label: string) {
    setPlaceholderMessage(ASSISTANT_PLACEHOLDER_MESSAGE);
    setMessages((current) => [
      ...current,
      {
        id: `action-${Date.now()}`,
        role: "assistant",
        text: `${label}: ${ASSISTANT_PLACEHOLDER_MESSAGE}`,
      },
    ]);
  }

  const panel = (
    <div className="workspace-civic-assistant__panel">
      <header className="workspace-civic-assistant__header">
        <h2 className="workspace-civic-assistant__title">{ASSISTANT_TITLE}</h2>
        <p className="workspace-civic-assistant__section-label">{context.currentSectionLabel}</p>
      </header>

      <dl className="workspace-civic-assistant__meta">
        <div>
          <dt>Initiative</dt>
          <dd>{context.initiativeTitle}</dd>
        </div>
        <div>
          <dt>Lifecycle</dt>
          <dd>{context.lifecyclePhase}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{context.visibilityLabel}</dd>
        </div>
        <div>
          <dt>Civic stage</dt>
          <dd>{context.currentCivicStage ?? "Not started"}</dd>
        </div>
        <div>
          <dt>Next step</dt>
          <dd>{context.nextAvailableStep ?? "None suggested"}</dd>
        </div>
        <div>
          <dt>Related records</dt>
          <dd>{context.relatedRecordsCount}</dd>
        </div>
      </dl>

      <p className="workspace-civic-assistant__summary">{context.contextSummary}</p>

      <section aria-label="Suggested actions" className="workspace-civic-assistant__actions">
        <h3>Suggested actions</h3>
        <ul>
          {suggestedActions.map((action) => (
            <li key={action.id}>
              <button type="button" onClick={() => handleSuggestedAction(action.label)}>
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Assistant conversation" className="workspace-civic-assistant__chat">
        <h3>Assistant conversation</h3>
        <ul className="workspace-civic-assistant__messages">
          {messages.map((message) => (
            <li key={message.id} className="workspace-civic-assistant__message">
              {message.text}
            </li>
          ))}
        </ul>
        {placeholderMessage ? (
          <p className="workspace-civic-assistant__placeholder-notice" role="status">
            {placeholderMessage}
          </p>
        ) : null}
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

      <p className="workspace-civic-assistant__safety">{ASSISTANT_SAFETY_NOTE}</p>
    </div>
  );

  return (
    <aside
      className={`workspace-civic-assistant ${mobileOpen ? "workspace-civic-assistant--open" : ""}`}
      aria-label="Civic assistant sidebar"
    >
      <button
        type="button"
        className="workspace-civic-assistant__toggle"
        aria-expanded={mobileOpen}
        aria-controls="workspace-civic-assistant-panel"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? "Hide Civic Assistant" : "Open Civic Assistant"}
      </button>
      <div id="workspace-civic-assistant-panel" className="workspace-civic-assistant__sticky">
        {panel}
      </div>
    </aside>
  );
}
