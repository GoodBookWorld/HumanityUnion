"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  isPublicChoiceCandidateElectionBallot,
  publicChoiceElectionVotingStatusLabel,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
  recallInitiativeDecisionVote,
} from "../../initiative-collective-decision/api";
import {
  describeCollectiveDecisionVotingUnavailable,
  isCollectiveDecisionVotingWindowOpen,
} from "../../initiative-collective-decision-lifecycle/collective-decision-voting";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../api";
import { PublicChoiceCandidateSubmitPanel } from "./PublicChoiceCandidateSubmitPanel";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceOverviewCandidateIntakeProps {
  initiativeId: string;
  /** When true, open the add-candidate form immediately (hash / CTA). */
  openSubmitInitially?: boolean;
  onOpenSubmitConsumed?: () => void;
}

/**
 * Pack 04 — PUBLIC_CHOICE candidate-election Overview surface.
 * Roster + Select / Selected / Recall (Decision Vote authority).
 * Add candidate: authenticated Participants only. Stay on Overview after submit.
 */
export function PublicChoiceOverviewCandidateIntake({
  initiativeId,
  openSubmitInitially = false,
  onOpenSubmitConsumed,
}: PublicChoiceOverviewCandidateIntakeProps) {
  const authStatus = useClientAuthStatus();
  const authenticated = authStatus === "authenticated";
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [projection, setProjection] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [currentVote, setCurrentVote] = useState<InitiativeDecisionVote | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "hidden" | "error">("loading");
  const [showSubmit, setShowSubmit] = useState(false);
  const [resultsExpired, setResultsExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadState("loading");
    try {
      const [initiative, listed, candidateList] = await Promise.all([
        getPublicInitiative(initiativeId),
        listPublicInitiativeCollectiveDecisions(initiativeId),
        listPublicChoiceCandidates(initiativeId),
      ]);

      if (!isPublicChoiceCandidateElectionBallot(initiative.metadata.ballotMode)) {
        setLoadState("hidden");
        return;
      }

      setResultsExpired(Boolean(initiative.metadata.publicChoiceResultsExpiredAt));
      setCandidates(candidateList);

      const opened =
        listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;

      if (!opened) {
        setDecisionId(null);
        setProjection(null);
        setCurrentVote(null);
        setLoadState("ready");
        return;
      }

      const detail = await getPublicInitiativeCollectiveDecision(opened.decisionId);
      setDecisionId(opened.decisionId);
      setProjection(detail);
      if (detail) {
        try {
          setCurrentVote(await getMyInitiativeDecisionVote(opened.decisionId));
        } catch {
          setCurrentVote(null);
        }
      } else {
        setCurrentVote(null);
      }
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (openSubmitInitially) {
      setShowSubmit(true);
      onOpenSubmitConsumed?.();
    }
  }, [openSubmitInitially, onOpenSubmitConsumed]);

  const votingOpen = projection ? isCollectiveDecisionVotingWindowOpen(projection) : false;
  const unavailableReason = projection
    ? describeCollectiveDecisionVotingUnavailable(projection)
    : "Voting opens when the election ballot is published.";

  const electionStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: projection?.status,
    openedAt: projection?.openedAt,
    closesAt: projection?.closesAt,
    closedAt: projection?.closedAt,
    resultsExpiredAt: projection?.resultsRetention?.resultsExpiredAt,
    resultsRetentionStatus: projection?.resultsRetention?.status,
  });
  const electionStatusLabel = publicChoiceElectionVotingStatusLabel(electionStatus);

  const selectedCandidateId =
    currentVote?.choice === "candidate" ? (currentVote.candidateId ?? null) : null;
  const selectedAbstain = currentVote?.choice === "abstain";
  const hasSelection = Boolean(selectedCandidateId || selectedAbstain);
  const rosterLocked = votingOpen && hasSelection;

  function openSubmitForm(): void {
    setShowSubmit(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#add-candidate");
    }
  }

  async function handleSubmitted(): Promise<void> {
    setShowSubmit(false);
    await reload();
  }

  async function cast(payload: CastInitiativeDecisionVotePayload, pending: string): Promise<void> {
    if (!decisionId || !votingOpen || busy) {
      return;
    }

    setBusy(true);
    setPendingId(pending);
    setError(null);
    setStatusMessage(null);

    try {
      const vote = await castOrUpdateInitiativeDecisionVote(decisionId, payload);
      setCurrentVote(vote);
      setStatusMessage("Selection recorded.");
      const refreshed = await getPublicInitiativeCollectiveDecision(decisionId);
      if (refreshed) {
        setProjection(refreshed);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Could not record selection.",
      );
    } finally {
      setBusy(false);
      setPendingId(null);
    }
  }

  async function recall(): Promise<void> {
    if (!decisionId || !votingOpen || busy || !hasSelection) {
      return;
    }

    setBusy(true);
    setPendingId("recall");
    setError(null);
    setStatusMessage(null);

    try {
      await recallInitiativeDecisionVote(decisionId);
      setCurrentVote(null);
      setStatusMessage("Selection recalled.");
      const refreshed = await getPublicInitiativeCollectiveDecision(decisionId);
      if (refreshed) {
        setProjection(refreshed);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Could not recall selection.",
      );
    } finally {
      setBusy(false);
      setPendingId(null);
    }
  }

  if (loadState === "hidden") {
    return null;
  }

  if (loadState === "loading") {
    return <p className="pie-overview-candidates__status">Loading candidates…</p>;
  }

  if (loadState === "error") {
    return (
      <p className="pie-overview-candidates__status" role="alert">
        Candidates could not be loaded.
      </p>
    );
  }

  const electionHref = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;

  return (
    <section
      className="pie-overview-candidates"
      aria-labelledby="pie-overview-candidates-title"
    >
      <h2 id="pie-overview-candidates-title">Candidates</h2>
      <p className="pie-overview-candidates__lead">
        Select one candidate. Use Recall to clear your selection and choose again.
        {authStatus === "unauthenticated" ? " Visitors may vote without registering." : null}
      </p>
      <p className="pie-overview-candidates__status" role="status">
        Election status: {electionStatusLabel}
        {!votingOpen && projection ? ` — ${unavailableReason}` : null}
        {!projection ? " — Voting has not started yet." : null}
      </p>

      <ul className="pie-overview-candidates__list">
        {candidates.map((candidate) => {
          const selected = selectedCandidateId === candidate.candidateId;
          const dimmed = rosterLocked && !selected;
          const photo = resolveMediaUrl(candidate.photoUrl);
          const nameBlock = (
            <>
              {photo ? (
                <img
                  className="pie-overview-candidates__photo"
                  src={photo}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : (
                <span className="pie-overview-candidates__photo pie-overview-candidates__photo--empty" />
              )}
              <span className="pie-overview-candidates__name">{candidate.name}</span>
            </>
          );

          return (
            <li
              key={candidate.candidateId}
              className={`pie-election-results__row pc-overview-vote-row${
                selected ? " pc-overview-vote-row--selected" : ""
              }${dimmed ? " pc-overview-vote-row--dimmed" : ""}`}
            >
              {candidate.campaignPageUrl ? (
                <a
                  className="pie-overview-candidates__identity"
                  href={candidate.campaignPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {nameBlock}
                </a>
              ) : (
                <div className="pie-overview-candidates__identity">{nameBlock}</div>
              )}
              <div className="pc-overview-vote-row__actions">
                {votingOpen ? (
                  selected ? (
                    <>
                      <span className="pc-overview-vote-row__badge" role="status">
                        Selected
                      </span>
                      <button
                        type="button"
                        className="hu-button hu-button--secondary"
                        disabled={busy}
                        onClick={() => void recall()}
                      >
                        {pendingId === "recall" ? "Recalling…" : "Recall"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="hu-button hu-button--primary"
                      disabled={busy || dimmed || !decisionId}
                      aria-disabled={dimmed || !decisionId}
                      onClick={() =>
                        void cast(
                          { choice: "candidate", candidateId: candidate.candidateId },
                          candidate.candidateId,
                        )
                      }
                    >
                      {pendingId === candidate.candidateId ? "Saving…" : "Select"}
                    </button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}

        {votingOpen && decisionId ? (
          <li
            className={`pie-election-results__row pc-overview-vote-row${
              selectedAbstain ? " pc-overview-vote-row--selected" : ""
            }${rosterLocked && !selectedAbstain ? " pc-overview-vote-row--dimmed" : ""}`}
          >
            <div className="pie-overview-candidates__identity">
              <span className="pie-overview-candidates__name">Abstain</span>
            </div>
            <div className="pc-overview-vote-row__actions">
              {selectedAbstain ? (
                <>
                  <span className="pc-overview-vote-row__badge" role="status">
                    Selected
                  </span>
                  <button
                    type="button"
                    className="hu-button hu-button--secondary"
                    disabled={busy}
                    onClick={() => void recall()}
                  >
                    {pendingId === "recall" ? "Recalling…" : "Recall"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="hu-button hu-button--secondary"
                  disabled={busy || (rosterLocked && !selectedAbstain)}
                  onClick={() => void cast({ choice: "abstain" }, "abstain")}
                >
                  {pendingId === "abstain" ? "Saving…" : "Select"}
                </button>
              )}
            </div>
          </li>
        ) : null}

        {!resultsExpired && authenticated ? (
          <li className="pie-election-results__row pie-election-results__row--add">
            <button
              type="button"
              className="pie-overview-candidates__add"
              onClick={openSubmitForm}
            >
              + Add candidate
            </button>
          </li>
        ) : null}
      </ul>

      {!votingOpen ? (
        <p className="pie-overview-candidates__status">
          <a className="hu-button hu-button--secondary" href={electionHref}>
            View election
          </a>
        </p>
      ) : null}

      {statusMessage ? (
        <p role="status" className="pie-overview-candidates__status">
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="pie-overview-candidates__error">
          {error}
        </p>
      ) : null}

      {showSubmit && authenticated ? (
        <PublicChoiceCandidateSubmitPanel
          initiativeId={initiativeId}
          onSubmitted={() => void handleSubmitted()}
          onCancel={() => setShowSubmit(false)}
        />
      ) : null}
    </section>
  );
}
