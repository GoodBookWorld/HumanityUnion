"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  InitiativeDecisionSupportOpposeAggregates,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER,
  publicChoiceElectionVotingStatusLabel,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";
import { formatPublicGeography } from "@hu/geography";

import {
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../../initiative-collective-decision/api";
import {
  CivicShareButton,
  resolveAbsoluteCivicShareUrl,
} from "../../civic-share";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../../public-choice-candidate/api";
import { PublicChoiceElectionResultsBoard } from "../../public-choice-candidate/components/PublicChoiceElectionResultsBoard";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";

import "../public-initiative-experience.css";

function formatDateTime(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SupportOpposeResults({
  aggregates,
  resultsLabel,
  votingOpen,
  fallback,
  downloadAvailable,
  onDownload,
  downloadBusy,
  shareSlot,
}: {
  aggregates: InitiativeDecisionSupportOpposeAggregates | null;
  resultsLabel: string;
  votingOpen: boolean;
  fallback: { support: number; doNotSupport: number; abstain: number; total: number };
  downloadAvailable: boolean;
  onDownload: () => void;
  downloadBusy: boolean;
  shareSlot?: ReactNode;
}) {
  const support = aggregates?.total.support ?? fallback.support;
  const doNotSupport = aggregates?.total.doNotSupport ?? fallback.doNotSupport;
  const abstain = aggregates?.total.abstain ?? fallback.abstain;
  const total = aggregates?.total.totalVotes ?? fallback.total;

  const rows = [
    { label: "Support", count: support },
    { label: "Do not support", count: doNotSupport },
    { label: "Abstain", count: abstain },
  ];

  return (
    <section className="pie-election-results" aria-labelledby="pie-election-results-title">
      <header className="pie-election-results__heading">
        <div className="pie-election-results__heading-row">
          <h2 id="pie-election-results-title">{resultsLabel}</h2>
          <div className="pie-election-results__heading-actions">
            {shareSlot}
            {downloadAvailable ? (
              <button
                type="button"
                className="pie-election-results__download"
                onClick={onDownload}
                disabled={downloadBusy}
              >
                {downloadBusy ? "Preparing…" : "Download results"}
              </button>
            ) : null}
          </div>
        </div>
        {votingOpen ? (
          <p role="status">Voting is open. These are current community results.</p>
        ) : (
          <p role="status">Voting is closed. These are final community results.</p>
        )}
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
                  aria-label={`${row.label} share of effective votes`}
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

/**
 * Pack 04 — presentation-ready Public Choice election results page.
 * Select/Recall voting lives on Overview; this page is results + share.
 */
export function PublicChoiceElectionPage({ initiativeId }: { initiativeId: string }) {
  const [initiative, setInitiative] = useState<PublicInitiativeProjection | null>(null);
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadState("loading");
    try {
      const [publicInitiative, candidateList, listed] = await Promise.all([
        getPublicInitiative(initiativeId),
        listPublicChoiceCandidates(initiativeId).catch(() => []),
        listPublicInitiativeCollectiveDecisions(initiativeId),
      ]);
      setInitiative(publicInitiative);
      setCandidates(candidateList);

      const opened =
        listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;
      setDecision(
        opened ? await getPublicInitiativeCollectiveDecision(opened.decisionId) : null,
      );
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ballotMode: PublicChoiceBallotMode = resolvePublicChoiceBallotMode(
    decision?.ballotMode ?? initiative?.metadata.ballotMode,
  );

  const votingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt:
      decision?.resultsRetention?.resultsExpiredAt ??
      initiative?.metadata.publicChoiceResultsExpiredAt,
    resultsRetentionStatus: decision?.resultsRetention?.status,
  });
  const votingOpen = votingStatus === "OPEN";
  const resultsExpired = votingStatus === "EXPIRED";
  const electionStatusLabel = publicChoiceElectionVotingStatusLabel(votingStatus);

  const resultsLabel = votingOpen
    ? "CURRENT RESULTS"
    : resultsExpired
      ? "RESULTS"
      : decision?.status === "closed" || decision?.resultsRetention?.status === "results_available"
        ? "FINAL RESULTS"
        : "RESULTS";

  const selectOneAggregates = useMemo(() => {
    const aggregates = decision?.ballotAggregates;
    return aggregates?.ballotMode === "SELECT_ONE_CANDIDATE" ? aggregates : null;
  }, [decision?.ballotAggregates]);

  const downloadAvailable =
    Boolean(decision?.resultsRetention?.downloadAvailable) && !resultsExpired;

  const totalVoters =
    selectOneAggregates?.totalEffectiveVoters ??
    (decision?.ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
      ? decision.ballotAggregates.total.totalVotes
      : decision?.statistics.totalVotesCast) ??
    0;

  async function handleDownload(): Promise<void> {
    if (!decision || downloadBusy) {
      return;
    }
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      await downloadPublicChoiceResultsPdf(initiativeId, decision.decisionId);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloadBusy(false);
    }
  }

  if (loadState === "loading") {
    return <p role="status">Loading election…</p>;
  }

  if (loadState === "error" || !initiative) {
    return <p role="alert">Election could not be loaded.</p>;
  }

  const electionName = initiative.metadata.communityAssociation?.trim() || initiative.title;
  const cover =
    resolveMediaUrl(
      initiative.metadata.imageUrl ??
        initiative.metadata.coverMedia?.thumbnailUrl ??
        initiative.metadata.coverMedia?.url,
    ) ?? undefined;
  const aggregates = decision?.ballotAggregates;
  const initiativeHref = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  const overviewVoteHref = `${initiativeHref}#overview`;
  const electionPath = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;

  const startOfVoting =
    formatDateTime(decision?.openedAt) ?? formatDateTime(initiative.metadata.startDate);
  const endOfVoting =
    formatDateTime(decision?.closedAt) ??
    formatDateTime(decision?.closesAt) ??
    formatDateTime(initiative.metadata.completionDate);

  const geography = formatPublicGeography({
    countryCode: initiative.metadata.countrySlug,
    regionCode: initiative.metadata.regionSlug,
    communitySlug: initiative.metadata.communitySlug,
    regionLabel: initiative.metadata.region,
    communityAssociation: initiative.metadata.communityAssociation,
  });

  const sharePayload = {
    url: resolveAbsoluteCivicShareUrl(electionPath),
    title: electionName,
    image: cover,
    optionalText: initiative.description?.slice(0, 160),
    contentType: "initiative" as const,
    initiativeId,
  };

  const shareSlot = <CivicShareButton payload={sharePayload} ariaLabel={`Share ${electionName}`} />;

  if (resultsExpired) {
    return (
      <article className="pie-election-page pie-election-page--expired">
        <p>
          <Link href={initiativeHref}>← Back to Initiative</Link>
        </p>
        <header className="pie-election-page__header">
          <p className="pie-election-page__eyebrow">Humanity Union community vote</p>
          <h1 className="pie-election-page__title">{electionName}</h1>
          <p role="status" className="pie-election-page__expired-message">
            Results no longer available
          </p>
          <p>
            The temporary results retention period has ended. Detailed election data has been
            removed.
          </p>
        </header>
        <p>
          <Link href={initiativeHref}>Back to Initiative</Link>
        </p>
      </article>
    );
  }

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

  return (
    <article className="pie-election-page">
      <p>
        <Link href={initiativeHref}>← Back to Initiative</Link>
      </p>

      <p className="pie-election-page__eyebrow">Humanity Union community vote</p>
      <h1 className="pie-election-page__title">{electionName}</h1>

      <div className="pie-election-page__intro">
        <div className="pie-election-page__intro-media">
          {cover ? (
            <img src={cover} alt={initiative.metadata.imageAltText || electionName} />
          ) : (
            <div className="pie-election-page__intro-media-empty" aria-hidden />
          )}
        </div>
        <div className="pie-election-page__intro-body">
          {initiative.description ? <p>{initiative.description}</p> : null}
          <ul className="pie-election-page__meta">
            <li>Geography: {geography || "—"}</li>
            <li>Start of Voting: {startOfVoting ?? "—"}</li>
            <li>End of Voting: {endOfVoting ?? "—"}</li>
            <li>Status: {electionStatusLabel}</li>
            <li>Total voters: {totalVoters}</li>
          </ul>
          {votingOpen ? (
            <p>
              <Link className="hu-button hu-button--primary" href={overviewVoteHref}>
                Vote on Overview
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {downloadError ? <p role="alert">{downloadError}</p> : null}

      {ballotMode === "SELECT_ONE_CANDIDATE" ? (
        <PublicChoiceElectionResultsBoard
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={selectOneAggregates ?? emptySelectOne}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          electionStatus={electionStatusLabel}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          shareSlot={shareSlot}
          voteHref={overviewVoteHref}
          showDisclaimer={false}
        />
      ) : (
        <SupportOpposeResults
          aggregates={aggregates?.ballotMode === "SUPPORT_OPPOSE" ? aggregates : null}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          shareSlot={shareSlot}
          fallback={{
            support: decision?.statistics.supportCount ?? 0,
            doNotSupport: decision?.statistics.doNotSupportCount ?? 0,
            abstain: decision?.statistics.abstainCount ?? 0,
            total: decision?.statistics.totalVotesCast ?? 0,
          }}
        />
      )}

      <section className="pie-election-page__disclaimer" role="note" aria-labelledby="pie-disclaimer-title">
        <h2 id="pie-disclaimer-title">Community voting results</h2>
        <p>{PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER}</p>
      </section>
    </article>
  );
}
