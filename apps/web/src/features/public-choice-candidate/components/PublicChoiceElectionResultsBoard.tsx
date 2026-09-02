"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionSelectOneAggregates,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";

import "../../public-initiative-experience/public-initiative-experience.css";

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function ParticipationBreakdown({
  breakdown,
}: {
  breakdown: InitiativeDecisionSelectOneAggregates["participationBreakdown"];
}) {
  const t = useTranslations("initiativeExperience");
  return (
    <section className="pie-election-results__participation" aria-labelledby="pie-participation-title">
      <h3 id="pie-participation-title">{t("publicChoice.results.participationTitle")}</h3>
      <p className="pie-election-results__participation-note">
        {t("publicChoice.results.participationNote")}
      </p>
      <ul className="pie-election-results__participation-list">
        <li>
          <span>{t("publicChoice.results.totalVoters")}</span>
          <strong>{breakdown.totalEffectiveVoters}</strong>
        </li>
        <li>
          <span>{t("publicChoice.results.visitors")}</span>
          <strong>
            {breakdown.visitors} ({formatPercent(breakdown.visitorPercentage)})
          </strong>
        </li>
        <li>
          <span>{t("publicChoice.results.participants")}</span>
          <strong>
            {breakdown.participants} ({formatPercent(breakdown.participantPercentage)})
          </strong>
        </li>
        <li>
          <span>{t("publicChoice.results.members")}</span>
          <strong>
            {breakdown.members} ({formatPercent(breakdown.memberPercentage)})
          </strong>
        </li>
      </ul>
    </section>
  );
}

export interface PublicChoiceElectionResultsBoardProps {
  initiativeId: string;
  candidates: PublicChoiceCandidatePublicProjection[];
  aggregates: InitiativeDecisionSelectOneAggregates;
  resultsLabel: string;
  votingOpen: boolean;
  /** Localized voting-status display label (canonical code resolved by caller). */
  electionStatus?: string;
  downloadAvailable: boolean;
  onDownload: () => void;
  downloadBusy: boolean;
  shareSlot?: ReactNode;
  /** When voting is open, link back to Overview (or another vote surface). */
  voteHref?: string;
  showDisclaimer?: boolean;
}

/**
 * Pack 04 — shared SELECT_ONE ranking / progress / participation / disclaimer.
 * Canonical aggregate order (already ranked). Used by Election page and CD results.
 */
export function PublicChoiceElectionResultsBoard({
  initiativeId,
  candidates,
  aggregates,
  resultsLabel,
  votingOpen,
  electionStatus,
  downloadAvailable,
  onDownload,
  downloadBusy,
  shareSlot,
  voteHref,
  showDisclaimer = true,
}: PublicChoiceElectionResultsBoardProps) {
  const t = useTranslations("initiativeExperience");
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const rankedIds = new Set(aggregates.candidates.map((item) => item.candidateId));
  const unrankedCandidates = candidates.filter((candidate) => !rankedIds.has(candidate.candidateId));
  const overviewVoteHref =
    voteHref ?? `/initiatives/public/${encodeURIComponent(initiativeId)}#overview`;
  const candidateFallback = t("publicChoice.results.candidateFallback");

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
                {downloadBusy
                  ? t("publicChoice.results.preparing")
                  : t("publicChoice.results.download")}
              </button>
            ) : null}
          </div>
        </div>
        {electionStatus ? (
          <p className="pie-election-results__status" role="status">
            {t("publicChoice.results.electionStatus", { status: electionStatus })}
          </p>
        ) : null}
        {votingOpen ? (
          <p role="status">
            {t("publicChoice.results.votingOpenRanking")}{" "}
            <Link href={overviewVoteHref}>{t("publicChoice.results.voteOnOverview")}</Link>
          </p>
        ) : (
          <p role="status">{t("publicChoice.results.votingClosedRanking")}</p>
        )}
      </header>

      <p className="pie-election-results__total">
        {t.rich("publicChoice.results.totalEffectiveVoters", {
          count: () => <strong>{aggregates.totalEffectiveVoters}</strong>,
        })}
      </p>

      {candidates.length === 0 ? (
        <p className="pie-election-results__empty" role="status">
          {t("publicChoice.results.noCandidates")}
        </p>
      ) : null}

      <ol className="pie-election-results__ranking">
        {aggregates.candidates.map((tally) => {
          const candidate = byId.get(tally.candidateId);
          const photo = resolveMediaUrl(candidate?.photoUrl);
          const barWidth = Math.max(0, Math.min(100, tally.percentage));
          const displayName = candidate?.name ?? candidateFallback;
          const percentLabel = formatPercent(tally.percentage);

          return (
            <li key={tally.candidateId} className="pie-election-results__row">
              <div
                className="pie-election-results__rank"
                aria-label={t("publicChoice.results.rankAria", { rank: tally.rank })}
              >
                {tally.rank}
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
                  <strong>{displayName}</strong>
                  {candidate?.isBlocked ? (
                    <p className="pie-election-results__blocked" role="status">
                      {t("publicChoice.results.blocked")}
                    </p>
                  ) : null}
                  {candidate?.campaignPageUrl ? (
                    <p>
                      <a href={candidate.campaignPageUrl} target="_blank" rel="noopener noreferrer">
                        {t("collaboration.vote.campaignPage")}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                className="pie-election-results__metrics"
                aria-label={t("publicChoice.results.votesMetricAria", {
                  count: tally.count,
                  percent: percentLabel,
                })}
              >
                <div className="pie-election-results__count">
                  {t("publicChoice.results.votesCount", { count: tally.count })}
                </div>
                <div className="pie-election-results__percent">{percentLabel}</div>
                <div
                  className="pie-election-results__bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(tally.percentage.toFixed(1))}
                  aria-label={t("publicChoice.results.voteShareAria", { name: displayName })}
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
                  {candidate.isBlocked ? (
                    <p className="pie-election-results__blocked" role="status">
                      {t("publicChoice.results.blocked")}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="pie-election-results__metrics">
                <div className="pie-election-results__count">
                  {t("publicChoice.results.votesCount", { count: 0 })}
                </div>
                <div className="pie-election-results__percent">0.0%</div>
                <div className="pie-election-results__bar" role="presentation" aria-hidden>
                  <span style={{ width: "0%" }} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="pie-election-results__abstain">
        <strong>{t("publicChoice.results.abstain")}</strong>
        <span>{t("publicChoice.results.votesCount", { count: aggregates.abstain })}</span>
        <span>{formatPercent(aggregates.abstainPercentage)}</span>
      </div>

      <ParticipationBreakdown breakdown={aggregates.participationBreakdown} />

      {showDisclaimer ? (
        <section
          className="pie-election-page__disclaimer"
          role="note"
          aria-labelledby="pie-results-disclaimer-title"
        >
          <h2 id="pie-results-disclaimer-title">{t("publicChoice.results.disclaimerTitle")}</h2>
          <p>{t("publicChoice.results.disclaimerBody")}</p>
        </section>
      ) : null}
    </section>
  );
}
