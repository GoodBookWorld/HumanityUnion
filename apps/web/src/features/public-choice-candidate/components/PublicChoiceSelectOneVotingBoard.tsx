"use client";

/**
 * @deprecated Pack 04 — Select/Recall voting lives on Overview
 * (`PublicChoiceOverviewCandidateIntake`). Collective Decision mounts
 * `PublicChoiceElectionResultsBoard` only. Do not mount from new surfaces.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
  getPublicInitiativeCollectiveDecision,
} from "../../initiative-collective-decision/api";
import {
  describeCollectiveDecisionVotingUnavailable,
  isCollectiveDecisionVotingWindowOpen,
} from "../../initiative-collective-decision-lifecycle/collective-decision-voting";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../api";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceSelectOneVotingBoardProps {
  initiativeId: string;
  decisionId: string;
  projection: PublicInitiativeCollectiveDecisionProjection;
  onVoteSucceeded?: (vote: InitiativeDecisionVote) => void;
  onProjectionRefresh?: () => void;
}

/**
 * @deprecated Pack 04 — legacy CD voting cards. Prefer Overview intake.
 */
export function PublicChoiceSelectOneVotingBoard({
  initiativeId,
  decisionId,
  projection,
  onVoteSucceeded,
  onProjectionRefresh,
}: PublicChoiceSelectOneVotingBoardProps) {
  const authStatus = useClientAuthStatus();
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [currentVote, setCurrentVote] = useState<InitiativeDecisionVote | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const votingOpen = isCollectiveDecisionVotingWindowOpen(projection);
  const unavailableReason = describeCollectiveDecisionVotingUnavailable(projection);
  const aggregates =
    projection.ballotAggregates?.ballotMode === "SELECT_ONE_CANDIDATE"
      ? projection.ballotAggregates
      : null;

  const tallyById = useMemo(() => {
    const map = new Map<string, { count: number; percentage: number; rank: number; isTie: boolean }>();
    for (const row of aggregates?.candidates ?? []) {
      map.set(row.candidateId, {
        count: row.count,
        percentage: row.percentage,
        rank: row.rank,
        isTie: row.isTie,
      });
    }
    return map;
  }, [aggregates]);

  const selectedCandidateId =
    currentVote?.choice === "candidate" ? currentVote.candidateId ?? null : null;
  const selectedAbstain = currentVote?.choice === "abstain";
  const hasSelection = Boolean(selectedCandidateId || selectedAbstain);
  const rosterLocked = votingOpen && hasSelection && !changing;

  const reloadVoteAndCandidates = useCallback(async () => {
    try {
      const [listed, vote] = await Promise.all([
        listPublicChoiceCandidates(initiativeId),
        getMyInitiativeDecisionVote(decisionId).catch(() => null),
      ]);
      setCandidates(listed);
      setCurrentVote(vote);
    } catch {
      setCandidates([]);
    }
  }, [initiativeId, decisionId]);

  useEffect(() => {
    void reloadVoteAndCandidates();
  }, [reloadVoteAndCandidates]);

  async function cast(payload: CastInitiativeDecisionVotePayload, pending: string): Promise<void> {
    if (!votingOpen || busy) {
      return;
    }

    setBusy(true);
    setPendingId(pending);
    setError(null);
    setStatusMessage(null);

    try {
      const vote = await castOrUpdateInitiativeDecisionVote(decisionId, payload);
      setCurrentVote(vote);
      setChanging(false);
      setStatusMessage("Vote recorded.");
      onVoteSucceeded?.(vote);
      const refreshed = await getPublicInitiativeCollectiveDecision(decisionId);
      if (refreshed) {
        onProjectionRefresh?.();
      }
      await reloadVoteAndCandidates();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Could not record vote.",
      );
    } finally {
      setBusy(false);
      setPendingId(null);
    }
  }

  if (!votingOpen) {
    const electionHref = `${buildInitiativeExperienceHref(initiativeId)}/election`;
    return (
      <section className="pc-vote-board" aria-label="Candidate voting closed">
        <p className="pc-vote-board__closed" role="status">
          Voting is closed. {unavailableReason ?? "View final results on the election page."}
        </p>
        <p>
          <a className="hu-button hu-button--secondary" href={electionHref}>
            View election
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="pc-vote-board" aria-label="Candidate voting">
      <p className="pc-vote-board__lead">
        Choose one candidate. Your previous selection is replaced if you change your vote.
        {authStatus === "unauthenticated" ? " Visitors may vote without registering." : null}
      </p>

      <ul className="pc-vote-board__list">
        {candidates.map((candidate) => {
          const tally = tallyById.get(candidate.candidateId);
          const selected = selectedCandidateId === candidate.candidateId;
          const disabledOthers = rosterLocked && !selected;
          const photo = resolveMediaUrl(candidate.photoUrl);
          const preview = (
            <>
              {photo ? (
                <img className="pc-vote-card__photo" src={photo} alt="" width={72} height={72} />
              ) : (
                <span className="pc-vote-card__photo pc-vote-card__photo--empty" />
              )}
              <span className="pc-vote-card__name">{candidate.name}</span>
            </>
          );

          return (
            <li
              key={candidate.candidateId}
              className={`pc-vote-card${selected ? " pc-vote-card--selected" : ""}${
                disabledOthers ? " pc-vote-card--dimmed" : ""
              }`}
            >
              <div className="pc-vote-card__main">
                <div className="pc-vote-card__preview">
                  {candidate.campaignPageUrl ? (
                    <a
                      className="pc-vote-card__identity"
                      href={candidate.campaignPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {preview}
                    </a>
                  ) : (
                    <div className="pc-vote-card__identity">{preview}</div>
                  )}
                </div>
                <div className="pc-vote-card__actions">
                  {selected ? (
                    <>
                      <span className="pc-vote-card__badge" role="status">
                        Selected
                      </span>
                      <button
                        type="button"
                        className="hu-button hu-button--secondary"
                        disabled={busy}
                        onClick={() => setChanging(true)}
                      >
                        Change vote
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="hu-button hu-button--primary"
                      disabled={busy || disabledOthers}
                      aria-disabled={disabledOthers}
                      onClick={() =>
                        void cast(
                          { choice: "candidate", candidateId: candidate.candidateId },
                          candidate.candidateId,
                        )
                      }
                    >
                      {pendingId === candidate.candidateId ? "Saving…" : "Vote"}
                    </button>
                  )}
                </div>
              </div>
              <aside className="pc-vote-card__stats" aria-label={`${candidate.name} results`}>
                <p className="pc-vote-card__count">{tally?.count ?? 0}</p>
                <p className="pc-vote-card__pct">
                  {(tally?.percentage ?? 0).toFixed(1)}%
                  {tally ? ` · #${tally.rank}${tally.isTie ? " (tie)" : ""}` : ""}
                </p>
                <div
                  className="pc-vote-card__bar"
                  role="meter"
                  aria-valuenow={Math.round(tally?.percentage ?? 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${Math.min(100, tally?.percentage ?? 0)}%` }} />
                </div>
                <p className="pc-vote-card__live">CURRENT</p>
              </aside>
            </li>
          );
        })}
      </ul>

      <div
        className={`pc-vote-card pc-vote-card--abstain${selectedAbstain ? " pc-vote-card--selected" : ""}${
          rosterLocked && !selectedAbstain ? " pc-vote-card--dimmed" : ""
        }`}
      >
        <div className="pc-vote-card__main">
          <div className="pc-vote-card__preview">
            <span className="pc-vote-card__name">Abstain</span>
          </div>
          <div className="pc-vote-card__actions">
            {selectedAbstain ? (
              <>
                <span className="pc-vote-card__badge" role="status">
                  Selected
                </span>
                <button
                  type="button"
                  className="hu-button hu-button--secondary"
                  disabled={busy}
                  onClick={() => setChanging(true)}
                >
                  Change vote
                </button>
              </>
            ) : (
              <button
                type="button"
                className="hu-button hu-button--secondary"
                disabled={busy || (rosterLocked && !selectedAbstain)}
                onClick={() => void cast({ choice: "abstain" }, "abstain")}
              >
                {pendingId === "abstain" ? "Saving…" : "Abstain"}
              </button>
            )}
          </div>
        </div>
        <aside className="pc-vote-card__stats">
          <p className="pc-vote-card__count">{aggregates?.abstain ?? 0}</p>
          <p className="pc-vote-card__pct">
            {(aggregates?.abstainPercentage ?? 0).toFixed(1)}%
          </p>
        </aside>
      </div>

      {aggregates ? (
        <p className="pc-vote-board__totals">
          Total voters: {aggregates.totalEffectiveVoters} · Visitors{" "}
          {aggregates.participationBreakdown.visitors} · Participants{" "}
          {aggregates.participationBreakdown.participants} · Members{" "}
          {aggregates.participationBreakdown.members}
        </p>
      ) : null}

      {statusMessage ? (
        <p role="status" className="pc-vote-board__status">
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="pc-vote-board__error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
