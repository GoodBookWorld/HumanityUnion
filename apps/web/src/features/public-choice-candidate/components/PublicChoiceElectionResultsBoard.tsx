"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type {
  InitiativeDecisionSelectOneAggregates,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";
import { PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER } from "@hu/types";

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

export interface PublicChoiceElectionResultsBoardProps {
  initiativeId: string;
  candidates: PublicChoiceCandidatePublicProjection[];
  aggregates: InitiativeDecisionSelectOneAggregates;
  resultsLabel: string;
  votingOpen: boolean;
  /** Pack 04 — single status label (Not started / Open / Closed / Expired). */
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
  const byId = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const rankedIds = new Set(aggregates.candidates.map((item) => item.candidateId));
  const unrankedCandidates = candidates.filter((candidate) => !rankedIds.has(candidate.candidateId));
  const overviewVoteHref =
    voteHref ?? `/initiatives/public/${encodeURIComponent(initiativeId)}#overview`;

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
        {electionStatus ? (
          <p className="pie-election-results__status" role="status">
            Election status: {electionStatus}
          </p>
        ) : null}
        {votingOpen ? (
          <p role="status">
            Voting is open. Current community ranking — no winner is declared.{" "}
            <Link href={overviewVoteHref}>Vote on Overview</Link>
          </p>
        ) : (
          <p role="status">
            Voting is closed. Top-ranked candidates reflect effective votes. Ties remain ties.
          </p>
        )}
      </header>

      <p className="pie-election-results__total">
        Total effective voters: <strong>{aggregates.totalEffectiveVoters}</strong>
      </p>

      {candidates.length === 0 ? (
        <p className="pie-election-results__empty" role="status">
          No candidates have been added yet.
        </p>
      ) : null}

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
                  {candidate?.isBlocked ? (
                    <p className="pie-election-results__blocked" role="status">
                      Blocked
                    </p>
                  ) : null}
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
                  {candidate.isBlocked ? (
                    <p className="pie-election-results__blocked" role="status">
                      Blocked
                    </p>
                  ) : null}
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
      </ol>

      <div className="pie-election-results__abstain">
        <strong>Abstain</strong>
        <span>{aggregates.abstain} votes</span>
        <span>{formatPercent(aggregates.abstainPercentage)}</span>
      </div>

      <ParticipationBreakdown breakdown={aggregates.participationBreakdown} />

      {showDisclaimer ? (
        <section
          className="pie-election-page__disclaimer"
          role="note"
          aria-labelledby="pie-results-disclaimer-title"
        >
          <h2 id="pie-results-disclaimer-title">Community voting results</h2>
          <p>{PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER}</p>
        </section>
      ) : null}
    </section>
  );
}
