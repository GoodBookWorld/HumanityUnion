"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  InitiativeDecisionSelectOneAggregates,
  InitiativeDecisionSupportOpposeAggregates,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER,
  buildPublicChoiceCandidatePresentationSlotPlan,
  resolvePublicChoiceBallotMode,
} from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../../initiative-collective-decision/api";
import { isCollectiveDecisionVotingWindowOpen } from "../../initiative-collective-decision-lifecycle/collective-decision-voting";
import { buildPublicChoiceCandidateSubmitHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../../public-choice-candidate/api";
import { PublicChoiceCandidateSubmitPanel } from "../../public-choice-candidate/components/PublicChoiceCandidateSubmitPanel";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";

import "../public-initiative-experience.css";

function formatGeo(initiative: PublicInitiativeProjection): string {
  const parts = [
    initiative.metadata.communityAssociation,
    initiative.metadata.region,
    initiative.metadata.countrySlug,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.join(" · ") || "—";
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildAddCandidateHref(initiativeId: string, authenticated: boolean): string {
  const submitHref = buildPublicChoiceCandidateSubmitHref(initiativeId);
  if (authenticated) {
    return submitHref;
  }
  return `/register?returnTo=${encodeURIComponent(submitHref)}`;
}

function ParticipationBreakdown({
  breakdown,
}: {
  breakdown: {
    visitors: number;
    participants: number;
    members: number;
    visitorPercentage: number;
    participantPercentage: number;
    memberPercentage: number;
    totalEffectiveVoters: number;
  };
}) {
  return (
    <section className="pie-election-results__participation" aria-labelledby="pie-participation-title">
      <h3 id="pie-participation-title">Participation breakdown</h3>
      <p className="pie-election-results__participation-note">
        Visitor, Participant, and Member are mutually exclusive. A Member vote counts once as Member —
        never also as Participant. Visitor identity is never shown publicly.
      </p>
      <ul className="pie-election-results__participation-list">
        <li>
          <span>Total voters</span>
          <strong>{breakdown.totalEffectiveVoters}</strong>
        </li>
        <li>
          <span>Visitors</span>
          <strong>
            {breakdown.visitors} ({formatPercent(breakdown.visitorPercentage)})
          </strong>
        </li>
        <li>
          <span>Participants</span>
          <strong>
            {breakdown.participants} ({formatPercent(breakdown.participantPercentage)})
          </strong>
        </li>
        <li>
          <span>Members</span>
          <strong>
            {breakdown.members} ({formatPercent(breakdown.memberPercentage)})
          </strong>
        </li>
      </ul>
    </section>
  );
}

function CandidatePlaceholderRow({
  href,
  index,
}: {
  href: string;
  index: number;
}) {
  return (
    <li className="pie-election-results__row pie-election-results__row--placeholder">
      <Link
        href={href}
        className="pie-election-results__placeholder-link"
        aria-label={`Add candidate, empty slot ${index + 1}`}
      >
        <span className="pie-election-results__photo-placeholder" aria-hidden>
          +
        </span>
        <span className="pie-election-results__placeholder-copy">
          <strong>Add candidate</strong>
          <span className="pie-election-results__placeholder-muted">Empty candidate slot</span>
        </span>
        <span className="pie-election-results__metrics pie-election-results__metrics--placeholder">
          <span className="pie-election-results__percent">—</span>
          <span className="pie-election-results__bar pie-election-results__bar--empty" aria-hidden>
            <span style={{ width: "0%" }} />
          </span>
          <span className="pie-election-results__count">—</span>
        </span>
      </Link>
    </li>
  );
}

function SelectOneResults({
  initiativeId,
  candidates,
  aggregates,
  resultsLabel,
  votingOpen,
  downloadAvailable,
  onDownload,
  downloadBusy,
  authenticated,
}: {
  initiativeId: string;
  candidates: PublicChoiceCandidatePublicProjection[];
  aggregates: InitiativeDecisionSelectOneAggregates;
  resultsLabel: string;
  votingOpen: boolean;
  downloadAvailable: boolean;
  onDownload: () => void;
  downloadBusy: boolean;
  authenticated: boolean;
}) {
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const slotPlan = buildPublicChoiceCandidatePresentationSlotPlan(candidates.length);
  const addHref = buildAddCandidateHref(initiativeId, authenticated);
  const rankedIds = new Set(aggregates.candidates.map((item) => item.candidateId));
  const unrankedCandidates = candidates.filter((candidate) => !rankedIds.has(candidate.candidateId));

  return (
    <section className="pie-election-results" aria-labelledby="pie-election-results-title">
      <header className="pie-election-results__heading">
        <div className="pie-election-results__heading-row">
          <h2 id="pie-election-results-title">{resultsLabel}</h2>
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
        {votingOpen ? (
          <p role="status">Voting is open. Current community ranking — no winner is declared.</p>
        ) : (
          <p role="status">
            Voting is closed. Top-ranked candidates reflect effective votes. Ties remain ties.
          </p>
        )}
      </header>

      <p className="pie-election-results__total">
        Total effective voters: <strong>{aggregates.totalEffectiveVoters}</strong>
      </p>

      <ol className="pie-election-results__ranking">
        {aggregates.candidates.map((tally) => {
          const candidate = byId.get(tally.candidateId);
          const photo = resolveMediaUrl(candidate?.photoUrl);
          const barWidth = Math.max(0, Math.min(100, tally.percentage));

          return (
            <li key={tally.candidateId} className="pie-election-results__row">
              <div className="pie-election-results__rank" aria-label={`Rank ${tally.rank}`}>
                {tally.rank}
                {tally.isTie ? <span className="pie-election-results__tie">Tie</span> : null}
              </div>
              <div className="pie-election-results__identity">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    width={72}
                    height={72}
                    className="pie-election-results__photo"
                  />
                ) : (
                  <span className="pie-election-results__photo-placeholder" aria-hidden>
                    —
                  </span>
                )}
                <div>
                  <strong>{candidate?.name ?? "Candidate"}</strong>
                  {candidate?.campaignPageUrl ? (
                    <p>
                      <a href={candidate.campaignPageUrl} target="_blank" rel="noopener noreferrer">
                        Campaign page
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                className="pie-election-results__metrics"
                aria-label={`${tally.count} votes, ${formatPercent(tally.percentage)}`}
              >
                <div className="pie-election-results__count">{tally.count} votes</div>
                <div className="pie-election-results__percent">{formatPercent(tally.percentage)}</div>
                <div
                  className="pie-election-results__bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(tally.percentage.toFixed(1))}
                  aria-label={`${candidate?.name ?? "Candidate"} share of effective votes`}
                >
                  <span style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            </li>
          );
        })}

        {unrankedCandidates.map((candidate) => {
          const photo = resolveMediaUrl(candidate.photoUrl);
          return (
            <li key={candidate.candidateId} className="pie-election-results__row">
              <div className="pie-election-results__rank" aria-hidden>
                —
              </div>
              <div className="pie-election-results__identity">
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    width={72}
                    height={72}
                    className="pie-election-results__photo"
                  />
                ) : (
                  <span className="pie-election-results__photo-placeholder" aria-hidden>
                    —
                  </span>
                )}
                <div>
                  <strong>{candidate.name}</strong>
                </div>
              </div>
              <div className="pie-election-results__metrics">
                <div className="pie-election-results__count">0 votes</div>
                <div className="pie-election-results__percent">0.0%</div>
                <div className="pie-election-results__bar" role="presentation" aria-hidden>
                  <span style={{ width: "0%" }} />
                </div>
              </div>
            </li>
          );
        })}

        {Array.from({ length: slotPlan.placeholderCount }, (_, index) => (
          <CandidatePlaceholderRow key={`placeholder-${index}`} href={addHref} index={index} />
        ))}
      </ol>

      <div className="pie-election-results__abstain">
        <strong>Abstain</strong>
        <span>{aggregates.abstain} votes</span>
        <span>{formatPercent(aggregates.abstainPercentage)}</span>
      </div>

      <ParticipationBreakdown breakdown={aggregates.participationBreakdown} />
    </section>
  );
}

function SupportOpposeResults({
  aggregates,
  resultsLabel,
  votingOpen,
  fallback,
  downloadAvailable,
  onDownload,
  downloadBusy,
}: {
  aggregates: InitiativeDecisionSupportOpposeAggregates | null;
  resultsLabel: string;
  votingOpen: boolean;
  fallback: { support: number; doNotSupport: number; abstain: number; total: number };
  downloadAvailable: boolean;
  onDownload: () => void;
  downloadBusy: boolean;
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
      {aggregates?.participationBreakdown ? (
        <ParticipationBreakdown breakdown={aggregates.participationBreakdown} />
      ) : null}
    </section>
  );
}

/**
 * Pack 02C — presentation-ready Public Choice election results.
 * Canonical Decision Vote aggregates only; temporary 72-hour retention.
 */
export function PublicChoiceElectionPage({ initiativeId }: { initiativeId: string }) {
  const authStatus = useClientAuthStatus();
  const authenticated = authStatus === "authenticated";
  const [initiative, setInitiative] = useState<PublicInitiativeProjection | null>(null);
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showCandidateSubmit, setShowCandidateSubmit] = useState(false);

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

  useEffect(() => {
    function syncHash(): void {
      setShowCandidateSubmit(window.location.hash === "#add-candidate");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const ballotMode: PublicChoiceBallotMode = resolvePublicChoiceBallotMode(
    decision?.ballotMode ?? initiative?.metadata.ballotMode,
  );
  const votingOpen = decision ? isCollectiveDecisionVotingWindowOpen(decision) : false;
  const retention = decision?.resultsRetention;
  const resultsExpired =
    retention?.status === "results_expired" ||
    Boolean(initiative?.metadata.publicChoiceResultsExpiredAt);
  const resultsLabel = votingOpen
    ? "CURRENT RESULTS"
    : resultsExpired
      ? "RESULTS"
      : decision?.status === "closed" || retention?.status === "results_available"
        ? "FINAL RESULTS"
        : "RESULTS";

  const selectOneAggregates = useMemo(() => {
    const aggregates = decision?.ballotAggregates;
    return aggregates?.ballotMode === "SELECT_ONE_CANDIDATE" ? aggregates : null;
  }, [decision?.ballotAggregates]);

  const downloadAvailable = Boolean(retention?.downloadAvailable) && !resultsExpired;

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

  if (resultsExpired) {
    return (
      <article className="pie-election-page pie-election-page--expired">
        <p>
          <Link href={initiativeHref}>← Back to Initiative</Link>
        </p>
        <header className="pie-election-page__header">
          <p className="pie-election-page__eyebrow">Humanity Union community vote</p>
          <h1>{electionName}</h1>
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

  return (
    <article className="pie-election-page">
      <p>
        <Link href={initiativeHref}>← Back to Initiative</Link>
      </p>

      <header className="pie-election-page__header">
        <p className="pie-election-page__eyebrow">Humanity Union community vote</p>
        <h1>{electionName}</h1>
        <p>{initiative.description}</p>
        {cover ? (
          <img src={cover} alt={initiative.metadata.imageAltText || electionName} />
        ) : null}
        <ul className="pie-election-page__meta">
          <li>Geography: {formatGeo(initiative)}</li>
          <li>
            Voting status:{" "}
            {decision
              ? votingOpen
                ? "Open"
                : decision.status === "closed" || retention?.status === "results_available"
                  ? "Closed"
                  : decision.status
              : "Not opened"}
          </li>
          <li>
            Ballot type:{" "}
            {ballotMode === "SELECT_ONE_CANDIDATE" ? "Choose one candidate" : "Support / Oppose"}
          </li>
          {decision ? (
            <li>
              Voting period:{" "}
              {decision.openedAt
                ? `Opened ${new Date(decision.openedAt).toLocaleString()}`
                : "—"}
              {" · "}
              {votingOpen
                ? `Closes ${new Date(decision.closesAt).toLocaleString()}`
                : decision.closedAt
                  ? `Closed ${new Date(decision.closedAt).toLocaleString()}`
                  : `Scheduled close ${new Date(decision.closesAt).toLocaleString()}`}
            </li>
          ) : null}
          {retention?.expiresAt ? (
            <li>
              Temporary results available until {new Date(retention.expiresAt).toLocaleString()}
            </li>
          ) : null}
        </ul>
      </header>

      {downloadError ? <p role="alert">{downloadError}</p> : null}

      {showCandidateSubmit && authenticated ? (
        <PublicChoiceCandidateSubmitPanel
          initiativeId={initiativeId}
          onSubmitted={() => {
            void reload();
          }}
        />
      ) : null}

      {showCandidateSubmit && !authenticated && authStatus !== "pending" ? (
        <p role="status">
          <a href={`/register?returnTo=${encodeURIComponent(buildPublicChoiceCandidateSubmitHref(initiativeId))}`}>
            Register
          </a>{" "}
          to add a candidate.
        </p>
      ) : null}

      {ballotMode === "SELECT_ONE_CANDIDATE" ? (
        <SelectOneResults
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={
            selectOneAggregates ?? {
              ballotMode: "SELECT_ONE_CANDIDATE",
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
            }
          }
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          authenticated={authenticated}
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
