"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Initiative, WorkspaceAssistantResponse } from "@hu/types";

import { getCivicIntegrationView } from "../../capability02-integration/api";
import { requestWorkspaceAssistantResponse } from "../api";
import { buildAssistantContext } from "../build-assistant-context";
import { ASSISTANT_PLACEHOLDER_MESSAGE, ASSISTANT_SAFETY_NOTE } from "../constants";
import { getSuggestedActionsForSection } from "../section-actions";
import { toWorkspaceAssistantContextSnapshot } from "../types";
import { useWorkspaceIntelligence } from "../use-workspace-intelligence";

import { WorkspaceIntelligencePanel } from "./WorkspaceIntelligencePanel";

import "../../initiative-workspace-ux/initiative-workspace-ux.css";
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
  const [assistantResponse, setAssistantResponse] = useState<WorkspaceAssistantResponse | null>(
    null,
  );
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const { intelligence, loading, error } = useWorkspaceIntelligence({
    initiativeId: initiative?.initiativeId,
    section: currentSection,
  });

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

  const handleSuggestedAction = useCallback(
    async (actionId: string, capability: string, label: string) => {
      if (!initiative?.initiativeId || assistantLoading) {
        return;
      }

      setActiveActionId(actionId);
      setAssistantLoading(true);
      setAssistantError(null);
      setAssistantResponse(null);

      try {
        const response = await requestWorkspaceAssistantResponse({
          initiativeId: initiative.initiativeId,
          currentSection,
          requestedAction: {
            capability,
            label,
          },
          contextSnapshot: toWorkspaceAssistantContextSnapshot(context),
        });

        setAssistantResponse(response);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Workspace assistant request failed.";
        setAssistantError(message);
      } finally {
        setAssistantLoading(false);
        setActiveActionId(null);
      }
    },
    [assistantLoading, context, currentSection, initiative],
  );

  const panel = (
    <WorkspaceIntelligencePanel
      sectionLabel={context.currentSectionLabel}
      intelligence={intelligence}
      loading={loading}
      error={error}
      showAssistantInputPlaceholder
    />
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

        <section aria-label="Suggested actions" className="workspace-civic-assistant__actions">
          <h3>Suggested actions</h3>
          <ul>
            {suggestedActions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  disabled={assistantLoading || !initiative?.initiativeId}
                  onClick={() =>
                    void handleSuggestedAction(action.id, action.capability, action.label)
                  }
                >
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
          {!initiative?.initiativeId ? (
            <p className="workspace-civic-assistant__placeholder-notice">
              {ASSISTANT_PLACEHOLDER_MESSAGE}
            </p>
          ) : null}
        </section>

        <section aria-label="Assistant conversation" className="workspace-civic-assistant__chat">
          <h3>Assistant output</h3>
          <ul className="workspace-civic-assistant__messages">
            {assistantLoading ? (
              <li className="workspace-civic-assistant__message">
                <p>Generating advisory response...</p>
              </li>
            ) : null}
            {assistantError ? (
              <li className="workspace-civic-assistant__message" role="alert">
                <p>{assistantError}</p>
              </li>
            ) : null}
            {assistantResponse ? (
              <li className="workspace-civic-assistant__message">
                <p>{assistantResponse.assistantMessage}</p>
                {assistantResponse.suggestedDraft ? (
                  <div className="workspace-civic-assistant__response-meta">
                    <p>
                      <strong>Draft (review before use):</strong>
                    </p>
                    <p>{assistantResponse.suggestedDraft}</p>
                  </div>
                ) : null}
                <div className="workspace-civic-assistant__response-meta">
                  <p>Confidence: {assistantResponse.confidenceLevel}</p>
                  <ul className="workspace-civic-assistant__safety-notices">
                    {assistantResponse.safetyNotices.map((notice) => (
                      <li key={notice.code}>{notice.message}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ) : null}
            {!assistantLoading && !assistantError && !assistantResponse && activeActionId
              ? null
              : null}
            {!assistantLoading && !assistantError && !assistantResponse ? (
              <li className="workspace-civic-assistant__message">
                <p>Select a suggested action to receive advisory guidance in this panel only.</p>
              </li>
            ) : null}
          </ul>
        </section>

        <p className="workspace-civic-assistant__safety">{ASSISTANT_SAFETY_NOTE}</p>
      </div>
    </aside>
  );
}
