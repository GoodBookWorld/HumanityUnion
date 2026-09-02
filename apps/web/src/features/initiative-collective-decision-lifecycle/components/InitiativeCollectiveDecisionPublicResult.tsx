"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  isPublicChoiceCandidateElectionBallot,
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
import {
  resolveCollectiveDecisionStatusDisplayLabel,
  resolveInitiativeDecisionVoteChoiceDisplayLabel,
  resolvePublicChoiceElectionVotingStatusDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";

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
  const t = useTranslations("initiativeExperience");
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
          setError(t("author.collectiveDecision.public.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decisionId, loadProjection, t]);

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
    return <p className="icd-source-panel__empty">{t("author.collectiveDecision.public.loading")}</p>;
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
    ? t("author.collectiveDecision.public.resultsCurrent")
    : resultsExpired
      ? t("author.collectiveDecision.public.results")
      : projection.status === "closed" ||
          projection.resultsRetention?.status === "results_available"
        ? t("author.collectiveDecision.public.resultsFinal")
        : t("author.collectiveDecision.public.results");
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
  const statusLabel = resolveCollectiveDecisionStatusDisplayLabel(projection.status, t);

  if (isPublicChoiceBallot) {
    return (
      <article className="icd-public" aria-label={t("author.collectiveDecision.public.aria")}>
        {isPreview ? (
          <p className="icd-public__meta">{t("author.collectiveDecision.public.previewMeta")}</p>
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
            electionStatus={resolvePublicChoiceElectionVotingStatusDisplayLabel(
              votingStatus,
              t,
            )}
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
            {t.rich("author.collectiveDecision.public.selectCandidateOnOverview", {
              overviewLink: (chunks) => (
                <a href={`${overviewHref}#overview`}>{chunks}</a>
              ),
            })}
          </p>
        ) : null}
      </article>
    );
  }

  const standardResultsHeading =
    projection.status === "opened"
      ? t("author.collectiveDecision.public.resultsCurrent")
      : projection.status === "closed"
        ? t("author.collectiveDecision.public.resultsFinal")
        : t("author.collectiveDecision.public.resultsVoting");

  return (
    <article className="icd-public" aria-label={t("author.collectiveDecision.public.aria")}>
      {isPreview ? (
        <p className="icd-public__meta">{t("author.collectiveDecision.public.previewMeta")}</p>
      ) : null}
      <section className="icd-public__section">
        <h3>{structured?.title || projection.question}</h3>
        <p>{structured?.decisionSummary ?? projection.question}</p>
        <p className="icd-public__meta">
          {projection.closedAt
            ? t("author.collectiveDecision.public.statusClosedMeta", {
                status: statusLabel,
                closedAt: new Date(projection.closedAt).toLocaleString(),
                steward: projection.stewardDisplayName,
              })
            : t("author.collectiveDecision.public.statusMeta", {
                status: statusLabel,
                closesAt: new Date(projection.closesAt).toLocaleString(),
                steward: projection.stewardDisplayName,
              })}
        </p>
      </section>

      <ListSection
        title={t("author.collectiveDecision.sections.approvedActions")}
        items={structured?.approvedActions}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.rejectedAlternatives")}
        items={structured?.rejectedAlternatives}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.roles")}
        items={structured?.responsibleRoles}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.priorities")}
        items={structured?.implementationPriorities}
      />

      {structured?.implementationTimeline ? (
        <section className="icd-public__section">
          <h3>{t("author.collectiveDecision.sections.timeline")}</h3>
          <p>{structured.implementationTimeline}</p>
        </section>
      ) : null}

      {structured?.decisionRationale ? (
        <section className="icd-public__section">
          <h3>{t("author.collectiveDecision.sections.rationale")}</h3>
          <p>{structured.decisionRationale}</p>
        </section>
      ) : null}

      <ListSection
        title={t("author.collectiveDecision.sections.risks")}
        items={structured?.decisionRisks}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.criteria")}
        items={structured?.successCriteria}
      />
      <ListSection
        title={t("author.collectiveDecision.sections.requiredResources")}
        items={structured?.requiredResources}
      />

      <section className="icd-public__section">
        <h3>{standardResultsHeading}</h3>
        <p>{projection.outcomeSummary}</p>
        <ul className="icd-public__stats" aria-label={t("author.collectiveDecision.public.voteTotalsAria")}>
          <li>
            {t("author.collectiveDecision.public.supportCount", {
              count:
                ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
                  ? ballotAggregates.total.support
                  : stats.supportCount,
            })}
          </li>
          <li>
            {t("author.collectiveDecision.public.doNotSupportCount", {
              count:
                ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
                  ? ballotAggregates.total.doNotSupport
                  : stats.doNotSupportCount,
            })}
          </li>
          <li>
            {t("author.collectiveDecision.public.abstainCount", {
              count:
                ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
                  ? ballotAggregates.total.abstain
                  : stats.abstainCount,
            })}
          </li>
          <li>
            {t("author.collectiveDecision.public.totalVotesCount", {
              count:
                ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
                  ? ballotAggregates.total.totalVotes
                  : stats.totalVotesCast,
            })}
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
          <h3>{t("author.collectiveDecision.sections.traceability")}</h3>
          <p>
            {(projection.traceability.decisionSessionId
              ? t("author.collectiveDecision.public.traceabilityFromSession", {
                  sessionId: projection.traceability.decisionSessionId,
                  sessionVersion: projection.traceability.decisionSessionVersion ?? "",
                })
              : t("author.collectiveDecision.public.traceabilityFromUpstream")) +
              (projection.traceability.petitionId
                ? t("author.collectiveDecision.public.traceabilityPetitionClause", {
                    petitionId: projection.traceability.petitionId,
                  })
                : "") +
              (projection.traceability.revisionId
                ? t("author.collectiveDecision.public.traceabilityRevisionClause", {
                    revisionId: projection.traceability.revisionId,
                    revisionVersion: projection.traceability.revisionVersion ?? "",
                  })
                : "") +
              t("author.collectiveDecision.public.traceabilitySignatures", {
                participants: projection.traceability.participantSignatures,
                members: projection.traceability.memberSignatures,
                visitors: projection.traceability.visitorSignals,
              })}
          </p>
        </section>
      ) : null}

      <ListSection
        title={t("author.collectiveDecision.sections.supportingReferences")}
        items={structured?.supportingReferences}
      />
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
  const t = useTranslations("initiativeExperience");
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
    {
      label: resolveInitiativeDecisionVoteChoiceDisplayLabel("support", t),
      count: support,
    },
    {
      label: resolveInitiativeDecisionVoteChoiceDisplayLabel("do_not_support", t),
      count: doNotSupport,
    },
    {
      label: resolveInitiativeDecisionVoteChoiceDisplayLabel("abstain", t),
      count: abstain,
    },
  ];

  return (
    <section className="pie-election-results" aria-labelledby="pie-cd-so-results-title">
      <header className="pie-election-results__heading">
        <h2 id="pie-cd-so-results-title">{resultsLabel}</h2>
        <p role="status">
          {votingOpen
            ? t("author.collectiveDecision.public.votingOpenNote")
            : t("author.collectiveDecision.public.votingClosedNote")}
        </p>
      </header>
      <p className="pie-election-results__total">
        {t.rich("author.collectiveDecision.public.totalEffectiveVoters", {
          count: () => <strong>{total}</strong>,
        })}
      </p>
      <ul className="pie-election-results__ternary">
        {rows.map((row) => {
          const percentage = total > 0 ? (row.count / total) * 100 : 0;
          return (
            <li key={row.label} className="pie-election-results__ternary-row">
              <strong>{row.label}</strong>
              <div
                className="pie-election-results__metrics"
                aria-label={t("author.collectiveDecision.public.votesMetricAria", {
                  count: row.count,
                  percent: formatPercent(percentage),
                })}
              >
                <div className="pie-election-results__count">
                  {t("author.collectiveDecision.public.votesMetric", { count: row.count })}
                </div>
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
