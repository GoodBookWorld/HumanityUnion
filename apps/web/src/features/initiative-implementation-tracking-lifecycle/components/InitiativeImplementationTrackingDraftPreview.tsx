"use client";

import { useEffect, useState } from "react";

import type { InitiativeImplementationTrackingLifecycleDraft } from "@hu/types";

import { getInitiativeImplementationTrackingWorkspace } from "../api";

import "./initiative-implementation-tracking-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="iit-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeImplementationTrackingDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativeImplementationTrackingLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeImplementationTrackingWorkspace(initiativeId);
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
    return <p className="iit-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="iit-source-panel__empty">Loading Implementation Tracking draft preview…</p>;
  }

  return (
    <article className="iit-public" aria-label="Implementation Tracking draft preview">
      <p className="iit-public__meta">Preview — unpublished draft (same renderer as Public)</p>
      <section className="iit-public__section">
        <h3>{draft.title || "Untitled Implementation Tracking"}</h3>
        <p>{draft.summary}</p>
      </section>
      {draft.candidates.map((candidate, index) => (
        <section className="iit-public__section" key={candidate.candidateId}>
          <h3>
            Action {index + 1}: {candidate.approvedAction}
          </h3>
          <p className="iit-public__meta">
            Status {candidate.currentStatus} · Progress {candidate.progress}% · Target Date{" "}
            {candidate.targetDate ?? "Not set"}
          </p>
          <ListSection title="Dependencies" items={candidate.dependencies} />
          <ListSection title="Obstacles" items={candidate.obstacles} />
          <ListSection title="Evidence References" items={candidate.evidenceReferences} />
        </section>
      ))}
    </article>
  );
}
