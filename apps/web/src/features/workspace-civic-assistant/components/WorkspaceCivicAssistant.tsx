"use client";

import { useEffect, useMemo, useState } from "react";

import type { Initiative, WorkspaceAssistantResponse } from "@hu/types";

import { getCivicIntegrationView } from "../../capability02-integration/api";
import { requestWorkspaceAssistantResponse } from "../api";
import { buildAssistantContext } from "../build-assistant-context";
import {
  ASSISTANT_COMING_SOON_INPUT,
  ASSISTANT_GREETING,
  ASSISTANT_INPUT_LABEL,
  ASSISTANT_SAFETY_NOTE,
  ASSISTANT_TITLE,
} from "../constants";
import { getSuggestedActionsForSection } from "../section-actions";
import { toWorkspaceAssistantContextSnapshot } from "../types";

import "../../initiative-workspace-ux/initiative-workspace-ux.css";
import "./workspace-civic-assistant.css";

interface WorkspaceCivicAssistantProps {
  initiative: Initiative | null;
  currentSection: string;
}

interface AssistantMessage {
  id: string;
  role: "assistant";
  text: string;
  response?: WorkspaceAssistantResponse;
}

export function WorkspaceCivicAssistant({
  initiative,
  currentSection,
}: WorkspaceCivicAssistantProps) {
  const [integrationView, setIntegrationView] = useState<Awaited<
    ReturnType<typeof getCivicIntegrationView>
  > | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
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

  async function handleSuggestedAction(action: { id: string; label: string; capability: string }) {
    if (!initiative?.initiativeId) {
      setActionError("Select an initiative before using assistant actions.");
      return;
    }

    setPendingActionId(action.id);
    setActionError(null);

    try {
      const response = await requestWorkspaceAssistantResponse({
        initiativeId: initiative.initiativeId,
        currentSection,
        requestedAction: {
          capability: action.capability,
          label: action.label,
        },
        contextSnapshot: toWorkspaceAssistantContextSnapshot(context),
      });

      setMessages((current) => [
        ...current,
        {
          id: `action-${Date.now()}`,
          role: "assistant",
          text: response.assistantMessage,
          response,
        },
      ]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Assistant engine request failed.");
    } finally {
      setPendingActionId(null);
    }
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
              <button
                type="button"
                disabled={pendingActionId !== null || !initiative}
                onClick={() => void handleSuggestedAction(action)}
              >
                {pendingActionId === action.id ? "Requesting guidance..." : action.label}
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
              <p>{message.text}</p>
              {message.response ? (
                <div className="workspace-civic-assistant__response-meta">
                  <p>
                    Confidence: <strong>{message.response.confidenceLevel}</strong> · Mode:{" "}
                    {message.response.mode}
                  </p>
                  <ul className="workspace-civic-assistant__safety-notices">
                    {message.response.safetyNotices.map((notice) => (
                      <li key={`${message.id}-${notice.code}`}>{notice.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {actionError ? (
          <p className="workspace-civic-assistant__placeholder-notice" role="alert">
            {actionError}
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
