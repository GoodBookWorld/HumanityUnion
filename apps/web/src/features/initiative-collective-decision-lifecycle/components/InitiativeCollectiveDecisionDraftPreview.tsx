"use client";

import { useEffect, useState } from "react";

import type { InitiativeCollectiveDecisionLifecycleDraft } from "@hu/types";

import { getInitiativeCollectiveDecisionWorkspace } from "../api";

import "./initiative-collective-decision-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="icd-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeCollectiveDecisionDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativeCollectiveDecisionLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeCollectiveDecisionWorkspace(initiativeId);
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
    return <p className="icd-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="icd-source-panel__empty">Loading Collective Decision draft preview…</p>;
  }

  return (
    <article className="icd-public" aria-label="Collective Decision draft preview">
      <p className="icd-public__meta">Preview — unpublished draft (same renderer as Public)</p>
      <section className="icd-public__section">
        <h3>{draft.title || "Untitled Collective Decision"}</h3>
        <p>{draft.decisionSummary}</p>
      </section>
      <ListSection title="Approved Actions" items={draft.approvedActions} />
      <ListSection title="Rejected Alternatives" items={draft.rejectedAlternatives} />
      <ListSection title="Responsible Roles" items={draft.responsibleRoles} />
      <ListSection title="Implementation Priorities" items={draft.implementationPriorities} />
      <section className="icd-public__section">
        <h3>Implementation Timeline</h3>
        <p>{draft.implementationTimeline || "Not set."}</p>
      </section>
      <section className="icd-public__section">
        <h3>Decision Rationale</h3>
        <p>{draft.decisionRationale || "No rationale yet."}</p>
      </section>
      <ListSection title="Decision Risks" items={draft.decisionRisks} />
      <ListSection title="Success Criteria" items={draft.successCriteria} />
      <ListSection title="Required Resources" items={draft.requiredResources} />
    </article>
  );
}
