"use client";

import { useEffect, useState } from "react";

import type { InitiativeImplementationCommitmentLifecycleDraft } from "@hu/types";

import { getInitiativeImplementationCommitmentWorkspace } from "../api";

import "./initiative-implementation-commitment-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="iic-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeImplementationCommitmentDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativeImplementationCommitmentLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeImplementationCommitmentWorkspace(initiativeId);
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
    return <p className="iic-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="iic-source-panel__empty">Loading Implementation Commitments draft preview…</p>;
  }

  return (
    <article className="iic-public" aria-label="Implementation Commitments draft preview">
      <p className="iic-public__meta">Preview — unpublished draft (same renderer as Public)</p>
      <section className="iic-public__section">
        <h3>{draft.title || "Untitled Implementation Commitments"}</h3>
        <p>{draft.summary}</p>
      </section>
      {draft.candidates.map((candidate, index) => (
        <section className="iic-public__section" key={candidate.candidateId}>
          <h3>
            Action {index + 1}: {candidate.approvedAction}
          </h3>
          <p>{candidate.description}</p>
          <p className="iic-public__meta">
            Role {candidate.suggestedResponsibleRole} · Priority {candidate.priority} · Timeline{" "}
            {candidate.suggestedTimeline || "Not set"}
          </p>
          <ListSection title="Required Resources" items={candidate.requiredResources} />
          <ListSection title="Related Risks" items={candidate.relatedRisks} />
          <ListSection title="References" items={candidate.references} />
        </section>
      ))}
    </article>
  );
}
