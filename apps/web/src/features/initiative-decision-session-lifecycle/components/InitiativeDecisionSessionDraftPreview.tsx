"use client";

import { useEffect, useState } from "react";

import type { InitiativeDecisionSessionDraft } from "@hu/types";

import { getInitiativeDecisionSessionWorkspace } from "../api";

import "./initiative-decision-session-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ids-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeDecisionSessionDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativeDecisionSessionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeDecisionSessionWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError("Draft preview could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (error) {
    return <p className="ids-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="ids-source-panel__empty">Loading Decision Session draft preview…</p>;
  }

  return (
    <article className="ids-public" aria-label="Decision Session draft preview">
      <p className="ids-public__meta">Preview — unpublished draft (same renderer as Public)</p>
      <section className="ids-public__section">
        <h3>{draft.title || "Untitled Decision Session"}</h3>
        <p>{draft.decisionQuestion}</p>
      </section>
      <section className="ids-public__section">
        <h3>Context</h3>
        <p>{draft.decisionContext || "No context yet."}</p>
      </section>
      <ListSection title="Objectives" items={draft.objectives} />
      <ListSection title="Options" items={draft.options} />
      <ListSection title="Supporting Arguments" items={draft.supportingArguments} />
      <ListSection title="Risks" items={draft.risks} />
      <ListSection title="Required Resources" items={draft.requiredResources} />
      <section className="ids-public__section">
        <h3>Suggested Timeline</h3>
        <p>{draft.suggestedTimeline || "Not set."}</p>
      </section>
      <ListSection title="Suggested Responsible Roles" items={draft.suggestedResponsibleRoles} />
    </article>
  );
}
