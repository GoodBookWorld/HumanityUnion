"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeDecisionVote,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

import { getPublicInitiativeCollectiveDecisionOrThrow } from "../../initiative-collective-decision/api";

import { InitiativeCollectiveDecisionBallotWidget } from "./InitiativeCollectiveDecisionBallotWidget";

import "./initiative-collective-decision-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] | undefined }) {
  if (!items || items.length === 0) {
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

interface InitiativeCollectiveDecisionPublicResultProps {
  readonly decisionId: string;
  readonly isPreview?: boolean;
}

export function InitiativeCollectiveDecisionPublicResult({
  decisionId,
  isPreview = false,
}: InitiativeCollectiveDecisionPublicResultProps) {
  const [projection, setProjection] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadProjection = useCallback(async () => {
    return getPublicInitiativeCollectiveDecisionOrThrow(decisionId);
  }, [decisionId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await loadProjection();
        if (!cancelled) {
          setProjection(result);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Published Collective Decision could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decisionId, loadProjection, reloadToken]);

  async function handleVoteSucceeded(_vote: InitiativeDecisionVote) {
    try {
      const refreshed = await loadProjection();
      setProjection(refreshed);
      setError(null);
    } catch {
      // Keep the prior projection; ballot already shows the recorded vote.
      setReloadToken((token) => token + 1);
    }
  }

  if (error && !projection) {
    return <p className="icd-source-panel__empty">{error}</p>;
  }

  if (!projection) {
    return <p className="icd-source-panel__empty">Loading published Collective Decision…</p>;
  }

  const structured = projection.structuredContent;
  const stats = projection.statistics;

  return (
    <article className="icd-public" aria-label="Published Collective Decision">
      {isPreview ? (
        <p className="icd-public__meta">Author Preview of published Collective Decision</p>
      ) : null}
      <section className="icd-public__section">
        <h3>{structured?.title || projection.question}</h3>
        <p>{structured?.decisionSummary ?? projection.question}</p>
        <p className="icd-public__meta">
          Status {projection.status.replaceAll("_", " ")}
          {projection.closedAt
            ? ` · Closed ${new Date(projection.closedAt).toLocaleString()}`
            : ` · Closes ${new Date(projection.closesAt).toLocaleString()}`}{" "}
          · Steward {projection.stewardDisplayName}
        </p>
      </section>

      <ListSection title="Approved Actions" items={structured?.approvedActions} />
      <ListSection title="Rejected Alternatives" items={structured?.rejectedAlternatives} />
      <ListSection title="Responsible Roles" items={structured?.responsibleRoles} />
      <ListSection title="Implementation Priorities" items={structured?.implementationPriorities} />

      {structured?.implementationTimeline ? (
        <section className="icd-public__section">
          <h3>Implementation Timeline</h3>
          <p>{structured.implementationTimeline}</p>
        </section>
      ) : null}

      {structured?.decisionRationale ? (
        <section className="icd-public__section">
          <h3>Decision Rationale</h3>
          <p>{structured.decisionRationale}</p>
        </section>
      ) : null}

      <ListSection title="Decision Risks" items={structured?.decisionRisks} />
      <ListSection title="Success Criteria" items={structured?.successCriteria} />
      <ListSection title="Required Resources" items={structured?.requiredResources} />

      <section className="icd-public__section">
        <h3>Voting Results</h3>
        <p>{projection.outcomeSummary}</p>
        <ul className="icd-public__stats" aria-label="Vote totals">
          <li>Support: {stats.supportCount}</li>
          <li>Do Not Support: {stats.doNotSupportCount}</li>
          <li>Abstain: {stats.abstainCount}</li>
          <li>Total votes: {stats.totalVotesCast}</li>
        </ul>
        <p className="icd-public__meta">{projection.transparencyNote}</p>
      </section>

      <InitiativeCollectiveDecisionBallotWidget
        decisionId={decisionId}
        projection={projection}
        onVoteSucceeded={handleVoteSucceeded}
      />

      {projection.traceability ? (
        <section className="icd-public__section">
          <h3>Traceability</h3>
          <p>
            Produced from Decision Session {projection.traceability.decisionSessionId} (v
            {projection.traceability.decisionSessionVersion})
            {projection.traceability.petitionId
              ? `, Petition ${projection.traceability.petitionId}`
              : ""}
            {projection.traceability.revisionId
              ? `, Revision ${projection.traceability.revisionId} (v${projection.traceability.revisionVersion})`
              : ""}
            . Signature statistics at publish — Participants{" "}
            {projection.traceability.participantSignatures}, Members{" "}
            {projection.traceability.memberSignatures}, Visitors{" "}
            {projection.traceability.visitorSignals}.
          </p>
        </section>
      ) : null}

      <ListSection title="Supporting References" items={structured?.supportingReferences} />
    </article>
  );
}
