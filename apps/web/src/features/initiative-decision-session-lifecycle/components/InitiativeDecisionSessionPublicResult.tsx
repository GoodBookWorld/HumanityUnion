"use client";

import { useEffect, useState } from "react";

import type { PublicDecisionSessionProjection } from "@hu/types";

import { getPublicDecisionSession } from "../../decision-session/api";

import "./initiative-decision-session-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] | undefined }) {
  if (!items || items.length === 0) {
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

interface InitiativeDecisionSessionPublicResultProps {
  readonly sessionId: string;
  readonly isPreview?: boolean;
}

export function InitiativeDecisionSessionPublicResult({
  sessionId,
  isPreview = false,
}: InitiativeDecisionSessionPublicResultProps) {
  const [projection, setProjection] = useState<PublicDecisionSessionProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublicDecisionSession(sessionId);
        if (!cancelled) {
          setProjection(result);
        }
      } catch {
        if (!cancelled) {
          setError("Published Decision Session could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return <p className="ids-source-panel__empty">{error}</p>;
  }

  if (!projection) {
    return <p className="ids-source-panel__empty">Loading published Decision Session…</p>;
  }

  const structured = projection.structuredContent;

  return (
    <article className="ids-public" aria-label="Published Decision Session">
      {isPreview ? <p className="ids-public__meta">Author Preview of published Decision Session</p> : null}
      <section className="ids-public__section">
        <h3>{projection.title}</h3>
        <p>{projection.decisionQuestion}</p>
        <p className="ids-public__meta">
          Published {projection.publishedAt} · Steward {projection.stewardDisplayName}
        </p>
      </section>

      <section className="ids-public__section">
        <h3>Context</h3>
        <p>{structured?.decisionContext || projection.purpose}</p>
      </section>

      <ListSection title="Objectives" items={structured?.objectives} />
      <ListSection title="Options" items={structured?.options} />
      <ListSection title="Supporting Arguments" items={structured?.supportingArguments} />
      <ListSection title="Risks" items={structured?.risks} />
      <ListSection title="Required Resources" items={structured?.requiredResources} />

      {structured?.suggestedTimeline ? (
        <section className="ids-public__section">
          <h3>Suggested Timeline</h3>
          <p>{structured.suggestedTimeline}</p>
        </section>
      ) : null}

      <ListSection title="Suggested Responsible Roles" items={structured?.suggestedResponsibleRoles} />

      {projection.traceability ? (
        <section className="ids-public__section">
          <h3>Traceability</h3>
          <p>
            Produced from Petition {projection.traceability.petitionId} (v
            {projection.traceability.petitionVersion})
            {projection.traceability.revisionId
              ? `, Revision ${projection.traceability.revisionId} (v${projection.traceability.revisionVersion})`
              : ""}
            . Signature statistics at publish — Participants{" "}
            {projection.traceability.participantSignatures}, Members{" "}
            {projection.traceability.memberSignatures}, Visitors{" "}
            {projection.traceability.visitorSignals}.
          </p>
        </section>
      ) : projection.relatedPetitionContext ? (
        <section className="ids-public__section">
          <h3>Supporting Petition</h3>
          <p>
            {projection.relatedPetitionContext.title} — Participants{" "}
            {projection.relatedPetitionContext.participantSignatures}, Members{" "}
            {projection.relatedPetitionContext.memberSignatures}, Visitors{" "}
            {projection.relatedPetitionContext.visitorSignals}.
          </p>
        </section>
      ) : null}

      <p className="ids-public__meta">
        Decision Session is informational. Voting belongs to Collective Decision.
      </p>
    </article>
  );
}
