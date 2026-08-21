"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  isPublicChoiceCandidateElectionBallot,
  publicChoiceElectionVotingStatusLabel,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import {
  getPublicInitiativeCollectiveDecisionOrThrow,
} from "../../initiative-collective-decision/api";
import { listPublicChoiceCandidates } from "../../public-choice-candidate/api";
import { PublicChoiceElectionResultsBoard } from "../../public-choice-candidate/components/PublicChoiceElectionResultsBoard";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";
import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";

import { InitiativeCollectiveDecisionBallotWidget } from "./InitiativeCollectiveDecisionBallotWidget";

import "./initiative-collective-decision-stage-workspace.css";
import "../../public-initiative-experience/public-initiative-experience.css";

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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface InitiativeCollectiveDecisionPublicResultProps {
  readonly decisionId: string;
  readonly isPreview?: boolean;
}

/**
 * Pack 04 — PUBLIC_CHOICE CD is results-only (shared board).
 * STANDARD path keeps BallotWidget + structured sections.
 */
export function InitiativeCollectiveDecisionPublicResult({
  decisionId,
  isPreview = false,
}: InitiativeCollectiveDecisionPublicResultProps) {
  const [projection, setProjection] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const loadProjection = useCallback(async () => {
    return getPublicInitiativeCollectiveDecisionOrThrow(decisionId);
  }, [decisionId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await loadProjection();
        if (cancelled) {
          return;
        }
        setProjection(result);
        setError(null);

        if (
          result.ballotMode ||
          result.ballotAggregates ||
          isPublicChoiceCandidateElectionBallot(result.ballotMode)
        ) {
          const listed = await listPublicChoiceCandidates(result.initiativeId).catch(() => []);
          if (!cancelled) {
            setCandidates(listed);
          }
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
  }, [decisionId, loadProjection]);

  async function handleVoteSucceeded(_vote: InitiativeDecisionVote) {
    try {
      const refreshed = await loadProjection();
      setProjection(refreshed);
      setError(null);
    } catch {
      // Keep the prior projection; ballot already shows the recorded vote.
    }
  }

  async function handleDownload(): Promise<void> {
    if (!projection || downloadBusy) {
      return;
    }
    setDownloadBusy(true);
    try {
      await downloadPublicChoiceResultsPdf(projection.initiativeId, decisionId);
    } finally {
      setDownloadBusy(false);
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
  const ballotAggregates = projection.ballotAggregates;
  const isPublicChoiceBallot = Boolean(projection.ballotMode || ballotAggregates);
  const ballotMode = resolvePublicChoiceBallotMode(projection.ballotMode);
  const votingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: projection.status,
    openedAt: projection.openedAt,
    closesAt: projection.closesAt,
    closedAt: projection.closedAt,
    resultsExpiredAt: projection.resultsRetention?.resultsExpiredAt,
    resultsRetentionStatus: projection.resultsRetention?.status,
  });
  const votingOpen = votingStatus === "OPEN";
  const resultsExpired = votingStatus === "EXPIRED";
  const resultsLabel = votingOpen
    ? "CURRENT RESULTS"
    : resultsExpired
      ? "RESULTS"
      : projection.status === "closed" ||
          projection.resultsRetention?.status === "results_available"
        ? "FINAL RESULTS"
        : "RESULTS";
  const downloadAvailable =
    Boolean(projection.resultsRetention?.downloadAvailable) && !resultsExpired;
  const overviewHref = buildInitiativeExperienceHref(projection.initiativeId);
  const emptySelectOne = {
    ballotMode: "SELECT_ONE_CANDIDATE" as const,
    candidates: [],
    abstain: 0,
    abstainPercentage: 0,
    totalEffectiveVoters: 0,
    participationBreakdown: {
      visitors: 0,
      participants: 0,
      members: 0,
      totalEffectiveVoters: 0,
      visitorPercentage: 0,
      participantPercentage: 0,
      memberPercentage: 0,
    },
  };

  if (isPublicChoiceBallot) {
    return (
      <article className="icd-public" aria-label="Published Collective Decision">
        {isPreview ? (
          <p className="icd-public__meta">Author Preview of published Collective Decision</p>
        ) : null}

        {ballotMode === "SELECT_ONE_CANDIDATE" ||
        isPublicChoiceCandidateElectionBallot(projection.ballotMode) ? (
          <PublicChoiceElectionResultsBoard
            initiativeId={projection.initiativeId}
            candidates={candidates}
            aggregates={
              ballotAggregates?.ballotMode === "SELECT_ONE_CANDIDATE"
                ? ballotAggregates
                : emptySelectOne
            }
            resultsLabel={resultsLabel}
            votingOpen={votingOpen}
            electionStatus={publicChoiceElectionVotingStatusLabel(votingStatus)}
            downloadAvailable={downloadAvailable}
            onDownload={() => {
              void handleDownload();
            }}
            downloadBusy={downloadBusy}
            voteHref={`${overviewHref}#overview`}
          />
        ) : (
          <SupportOpposeReadOnlyResults
            projection={projection}
            resultsLabel={resultsLabel}
            votingOpen={votingOpen}
          />
        )}

        {votingOpen ? (
          <p className="icd-public__meta">
            Select or recall your candidate on{" "}
            <a href={`${overviewHref}#overview`}>Overview</a>.
          </p>
        ) : null}
      </article>
    );
  }

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
        <h3>
          {projection.status === "opened"
            ? "CURRENT RESULTS"
            : projection.status === "closed"
              ? "FINAL RESULTS"
              : "Voting Results"}
        </h3>
        <p>{projection.outcomeSummary}</p>
        <ul className="icd-public__stats" aria-label="Vote totals">
          <li>
            Support:{" "}
            {ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
              ? ballotAggregates.total.support
              : stats.supportCount}
          </li>
          <li>
            Do Not Support:{" "}
            {ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
              ? ballotAggregates.total.doNotSupport
              : stats.doNotSupportCount}
          </li>
          <li>
            Abstain:{" "}
            {ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
              ? ballotAggregates.total.abstain
              : stats.abstainCount}
          </li>
          <li>
            Total votes:{" "}
            {ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
              ? ballotAggregates.total.totalVotes
              : stats.totalVotesCast}
          </li>
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
            {projection.traceability.decisionSessionId
              ? `Produced from Decision Session ${projection.traceability.decisionSessionId} (v${projection.traceability.decisionSessionVersion})`
              : "Produced from upstream Lifecycle sources"}
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

function SupportOpposeReadOnlyResults({
  projection,
  resultsLabel,
  votingOpen,
}: {
  projection: PublicInitiativeCollectiveDecisionProjection;
  resultsLabel: string;
  votingOpen: boolean;
}) {
  const aggregates =
    projection.ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
      ? projection.ballotAggregates
      : null;
  const support = aggregates?.total.support ?? projection.statistics.supportCount;
  const doNotSupport =
    aggregates?.total.doNotSupport ?? projection.statistics.doNotSupportCount;
  const abstain = aggregates?.total.abstain ?? projection.statistics.abstainCount;
  const total = aggregates?.total.totalVotes ?? projection.statistics.totalVotesCast;
  const rows = [
    { label: "Support", count: support },
    { label: "Do not support", count: doNotSupport },
    { label: "Abstain", count: abstain },
  ];

  return (
    <section className="pie-election-results" aria-labelledby="pie-cd-so-results-title">
      <header className="pie-election-results__heading">
        <h2 id="pie-cd-so-results-title">{resultsLabel}</h2>
        <p role="status">
          {votingOpen
            ? "Voting is open. These are current community results."
            : "Voting is closed. These are final community results."}
        </p>
      </header>
      <p className="pie-election-results__total">
        Total effective voters: <strong>{total}</strong>
      </p>
      <ul className="pie-election-results__ternary">
        {rows.map((row) => {
          const percentage = total > 0 ? (row.count / total) * 100 : 0;
          return (
            <li key={row.label} className="pie-election-results__ternary-row">
              <strong>{row.label}</strong>
              <div
                className="pie-election-results__metrics"
                aria-label={`${row.count} votes, ${formatPercent(percentage)}`}
              >
                <div className="pie-election-results__count">{row.count} votes</div>
                <div className="pie-election-results__percent">{formatPercent(percentage)}</div>
                <div
                  className="pie-election-results__bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(percentage.toFixed(1))}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
