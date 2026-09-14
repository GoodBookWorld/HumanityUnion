"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";
import {
  isPublicChoiceCandidateElectionBallot,
  PUBLIC_CHOICE_MAX_CANDIDATES,
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
  getPublicInitiativeCollectiveDecision,
  recallInitiativeDecisionVote,
} from "../../initiative-collective-decision/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { resolvePublicChoiceElectionVotingStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { loadPublicChoiceElectionResultSurface } from "../public-choice-election-result-surface";
import {
  notifyPublicChoiceElectionRefresh,
  usePublicChoiceElectionRefresh,
} from "../public-choice-election-refresh";
import { PublicChoiceCandidateSubmitPanel } from "./PublicChoiceCandidateSubmitPanel";

import "../../public-initiative-experience/public-initiative-experience.css";

interface PublicChoiceOverviewCandidateIntakeProps {
  initiativeId: string;
  /** When true, open the add-candidate form immediately (hash / CTA). */
  openSubmitInitially?: boolean;
  onOpenSubmitConsumed?: () => void;
}

function resolveIntakeUnavailableSuffix(
  electionStatus: string,
  t: (key: string) => string,
): string {
  switch (electionStatus) {
    case "NOT_STARTED":
      return t("publicChoice.candidateIntake.votingOpensWhenPublished");
    case "CLOSED":
      return t("publicChoice.candidateIntake.unavailableClosed");
    case "EXPIRED":
      return t("publicChoice.candidateIntake.unavailableExpired");
    default:
      return t("publicChoice.candidateIntake.unavailableNotOpen");
  }
}

/**
 * Pack 04 / Fix 05 — PUBLIC_CHOICE candidate-election Overview surface.
 * Roster + Select / Selected / Recall (Decision Vote authority) for all voters.
 * Add candidate: authenticated Participants open the form; Visitors get Register CTA.
 * Stay on Overview after submit.
 */
export function PublicChoiceOverviewCandidateIntake({
  initiativeId,
  openSubmitInitially = false,
  onOpenSubmitConsumed,
}: PublicChoiceOverviewCandidateIntakeProps) {
  const t = useTranslations("initiativeExperience");
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
  const [editingCandidate, setEditingCandidate] =
    useState<PublicChoiceCandidatePublicProjection | null>(null);
  const [resultsExpired, setResultsExpired] = useState(false);
  const [electionBlocked, setElectionBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const hasCompletedLoadRef = useRef(false);

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    if (!hasCompletedLoadRef.current) {
      setLoadState("loading");
    }
    try {
      const surface = await loadPublicChoiceElectionResultSurface(initiativeId);
      if (generation !== loadGenerationRef.current) {
        return;
      }

      const ballotMode = resolvePublicChoiceBallotMode(
        surface.decision?.ballotMode ?? surface.initiative?.metadata.ballotMode,
      );
      if (
        surface.initiative &&
        !isPublicChoiceCandidateElectionBallot(surface.initiative.metadata.ballotMode) &&
        !isPublicChoiceCandidateElectionBallot(ballotMode)
      ) {
        hasCompletedLoadRef.current = true;
        setLoadState("hidden");
        return;
      }

      // Soft-fail initiative GET: still show roster when candidates load.
      if (surface.initiativeLoadFailed && surface.candidates.length === 0 && !surface.decision) {
        hasCompletedLoadRef.current = true;
        setLoadState("error");
        return;
      }

      setResultsExpired(
        Boolean(
          surface.initiative?.metadata.publicChoiceResultsExpiredAt ??
            surface.decision?.resultsRetention?.resultsExpiredAt,
        ),
      );
      setElectionBlocked(Boolean(surface.initiative?.isAdministrativelyBlocked));
      setCandidates(surface.candidates);

      if (!surface.decision) {
        setDecisionId(null);
        setProjection(null);
        setCurrentVote(null);
        hasCompletedLoadRef.current = true;
        setLoadState("ready");
        return;
      }

      setDecisionId(surface.decision.decisionId);
      setProjection(surface.decision);
      try {
        setCurrentVote(await getMyInitiativeDecisionVote(surface.decision.decisionId));
      } catch {
        setCurrentVote(null);
      }
      if (generation !== loadGenerationRef.current) {
        return;
      }
      hasCompletedLoadRef.current = true;
      setLoadState("ready");
    } catch {
      if (generation !== loadGenerationRef.current) {
        return;
      }
      hasCompletedLoadRef.current = true;
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  usePublicChoiceElectionRefresh(initiativeId, reload);

  useEffect(() => {
    if (openSubmitInitially) {
      setShowSubmit(true);
      onOpenSubmitConsumed?.();
    }
  }, [openSubmitInitially, onOpenSubmitConsumed]);

  /**
   * Fix 05 — Align Select/Recall with Pack 04 election status (OPEN).
   * Do not gate controls on the older openedAt-required window helper; that
   * hid Select/Recall while the status label still displayed "Open".
   */
  const electionStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: projection?.status,
    openedAt: projection?.openedAt,
    closesAt: projection?.closesAt,
    closedAt: projection?.closedAt,
    resultsExpiredAt: projection?.resultsRetention?.resultsExpiredAt,
    resultsRetentionStatus: projection?.resultsRetention?.status,
  });
  const votingOpen = electionStatus === "OPEN" && !electionBlocked;
  const electionStatusLabel = resolvePublicChoiceElectionVotingStatusDisplayLabel(
    electionStatus,
    t,
  );
  const unavailableSuffix = projection
    ? resolveIntakeUnavailableSuffix(electionStatus, t)
    : t("publicChoice.candidateIntake.votingOpensWhenPublished");

  const selectedCandidateId =
    currentVote?.choice === "candidate" ? (currentVote.candidateId ?? null) : null;
  /** Fix 07A — live UI locks only on an effective candidate Select (Abstain row removed). */
  const hasSelection = Boolean(selectedCandidateId);
  const rosterLocked = votingOpen && hasSelection;

  function openSubmitForm(): void {
    setEditingCandidate(null);
    setShowSubmit(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#add-candidate");
    }
  }

  function openEditForm(candidate: PublicChoiceCandidatePublicProjection): void {
    setEditingCandidate(candidate);
    setShowSubmit(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#add-candidate");
    }
  }

  function closeSubmitForm(): void {
    setShowSubmit(false);
    setEditingCandidate(null);
  }

  async function handleSubmitted(): Promise<void> {
    closeSubmitForm();
    await reload();
    notifyPublicChoiceElectionRefresh(initiativeId);
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
      setStatusMessage(t("publicChoice.candidateIntake.selectionRecorded"));
      const refreshed = await getPublicInitiativeCollectiveDecision(decisionId);
      if (refreshed) {
        setProjection(refreshed);
      }
      notifyPublicChoiceElectionRefresh(initiativeId);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t("publicChoice.candidateIntake.couldNotRecord"),
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
      setStatusMessage(t("publicChoice.candidateIntake.selectionRecalled"));
      const refreshed = await getPublicInitiativeCollectiveDecision(decisionId);
      if (refreshed) {
        setProjection(refreshed);
      }
      notifyPublicChoiceElectionRefresh(initiativeId);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t("publicChoice.candidateIntake.couldNotRecall"),
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
    return (
      <p className="pie-overview-candidates__status">
        {t("publicChoice.candidateIntake.loading")}
      </p>
    );
  }

  if (loadState === "error") {
    return (
      <p className="pie-overview-candidates__status" role="alert">
        {t("publicChoice.candidateIntake.loadFailed")}
      </p>
    );
  }

  const electionHref = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;

  return (
    <section
      className="pie-overview-candidates"
      aria-labelledby="pie-overview-candidates-title"
    >
      <h2 id="pie-overview-candidates-title">{t("publicChoice.candidateIntake.title")}</h2>
      <p className="pie-overview-candidates__lead">
        {t("publicChoice.candidateIntake.lead")}
        {authStatus === "unauthenticated"
          ? t("publicChoice.candidateIntake.visitorsMayVote")
          : null}
      </p>
      {electionBlocked ? (
        <p className="pie-overview-candidates__status" role="status">
          {t("publicChoice.candidateIntake.electionBlocked")}
        </p>
      ) : null}
      <p className="pie-overview-candidates__status" role="status">
        {t("publicChoice.candidateIntake.electionStatus", { status: electionStatusLabel })}
        {!votingOpen && projection ? ` — ${unavailableSuffix}` : null}
        {!projection ? ` — ${t("publicChoice.candidateIntake.votingNotStartedYet")}` : null}
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
              className={`pc-overview-vote-row${
                selected ? " pc-overview-vote-row--selected" : ""
              }${dimmed ? " pc-overview-vote-row--dimmed" : ""}${
                candidate.isBlocked ? " pc-overview-vote-row--blocked" : ""
              }`}
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
                {candidate.isBlocked ? (
                  <span className="pc-overview-vote-row__blocked" role="status">
                    {t("publicChoice.candidateIntake.blocked")}
                  </span>
                ) : null}
                {candidate.viewerCanManage && !resultsExpired ? (
                  <button
                    type="button"
                    className="hu-button hu-button--secondary pc-overview-vote-row__edit"
                    disabled={busy}
                    onClick={() => openEditForm(candidate)}
                  >
                    {t("publicChoice.candidateIntake.edit")}
                  </button>
                ) : null}
                {votingOpen ? (
                  selected ? (
                    <>
                      <span className="pc-overview-vote-row__badge" role="status">
                        {t("publicChoice.candidateIntake.selected")}
                      </span>
                      <button
                        type="button"
                        className="hu-button pc-overview-vote-row__recall"
                        disabled={busy}
                        aria-busy={pendingId === "recall"}
                        aria-pressed="true"
                        onClick={() => void recall()}
                      >
                        {pendingId === "recall"
                          ? t("publicChoice.candidateIntake.recalling")
                          : t("publicChoice.candidateIntake.recall")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="hu-button hu-button--primary"
                      disabled={busy || dimmed || !decisionId || Boolean(candidate.isBlocked)}
                      aria-disabled={dimmed || !decisionId || Boolean(candidate.isBlocked)}
                      aria-busy={pendingId === candidate.candidateId}
                      onClick={() =>
                        void cast(
                          { choice: "candidate", candidateId: candidate.candidateId },
                          candidate.candidateId,
                        )
                      }
                    >
                      {pendingId === candidate.candidateId
                        ? t("publicChoice.candidateIntake.saving")
                        : t("publicChoice.candidateIntake.select")}
                    </button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}

        {!resultsExpired &&
        !electionBlocked &&
        authenticated &&
        candidates.length < PUBLIC_CHOICE_MAX_CANDIDATES ? (
          <li className="pie-overview-candidates__add-row">
            <button
              type="button"
              className="pie-overview-candidates__add hu-button hu-button--secondary"
              onClick={openSubmitForm}
            >
              {t("publicChoice.candidateIntake.addCandidateCta")}
            </button>
          </li>
        ) : null}

        {!resultsExpired &&
        !electionBlocked &&
        authenticated &&
        candidates.length >= PUBLIC_CHOICE_MAX_CANDIDATES ? (
          <li className="pie-overview-candidates__add-row">
            <p className="pie-overview-candidates__status" role="status">
              {t("publicChoice.candidateIntake.atMaxCandidates", {
                max: PUBLIC_CHOICE_MAX_CANDIDATES,
              })}
            </p>
          </li>
        ) : null}

        {!resultsExpired && !electionBlocked && authStatus === "unauthenticated" ? (
          <li className="pie-overview-candidates__add-row">
            <a
              className="pie-overview-candidates__add hu-button hu-button--secondary"
              href={`/register?returnTo=${encodeURIComponent(
                `/initiatives/public/${encodeURIComponent(initiativeId)}#add-candidate`,
              )}`}
            >
              {t("publicChoice.candidateIntake.addCandidateCta")}
            </a>
          </li>
        ) : null}
      </ul>

      {!votingOpen ? (
        <p className="pie-overview-candidates__status">
          <a className="hu-button hu-button--secondary" href={electionHref}>
            {t("publicChoice.candidateIntake.viewElection")}
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

      {showSubmit && authenticated && !electionBlocked ? (
        <PublicChoiceCandidateSubmitPanel
          initiativeId={initiativeId}
          candidateCount={candidates.length}
          editingCandidate={editingCandidate}
          onSubmitted={() => void handleSubmitted()}
          onDeleted={() => void handleSubmitted()}
          onCancel={closeSubmitForm}
        />
      ) : null}
    </section>
  );
}
