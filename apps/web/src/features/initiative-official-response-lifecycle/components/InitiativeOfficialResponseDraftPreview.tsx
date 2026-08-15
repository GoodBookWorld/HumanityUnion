"use client";

import { useEffect, useState } from "react";

import type { InitiativeOfficialResponseLifecycleDraft } from "@hu/types";

import { getInitiativeOfficialResponseWorkspace } from "../api";

import "./initiative-official-response-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ior-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeOfficialResponseDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativeOfficialResponseLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeOfficialResponseWorkspace(initiativeId);
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
    return <p className="ior-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="ior-source-panel__empty">Loading Official Responses draft preview…</p>;
  }

  return (
    <article className="ior-public" aria-label="Official Responses draft preview">
      <p className="ior-public__meta">Preview — unpublished draft (same renderer as Public)</p>
      <section className="ior-public__section">
        <h3>{draft.title || "Untitled Official Responses"}</h3>
        <p>{draft.summary}</p>
      </section>
      {draft.candidates.map((candidate, index) => (
        <section className="ior-public__section" key={candidate.candidateId}>
          <h3>
            Candidate {index + 1}: {candidate.subject || "Untitled"}
          </h3>
          <p className="ior-public__meta">
            {candidate.institution || candidate.organization || "Institution not yet named"} · Received{" "}
            {candidate.receivedAt || "Not set"} · {candidate.verificationStatus}
          </p>
          <p>{candidate.summary}</p>
          <ListSection title="Related Actions" items={candidate.relatedActions} />
          <ListSection title="Documents" items={candidate.documentIds} />
          <ListSection title="Links" items={candidate.links} />
        </section>
      ))}
    </article>
  );
}
