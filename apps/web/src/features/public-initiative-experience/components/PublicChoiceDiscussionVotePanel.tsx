"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoice,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  DEFAULT_PUBLIC_CHOICE_BALLOT_MODE,
  resolvePublicChoiceBallotMode,
} from "@hu/types";

import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisions,
} from "../../initiative-collective-decision/api";
import {
  isCollectiveDecisionVotingWindowOpen,
  resolveCollectiveDecisionVotingUnavailableCode,
} from "../../initiative-collective-decision-lifecycle/collective-decision-voting";
import { getPublicInitiative } from "../../initiatives/api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { listPublicChoiceCandidates } from "../../public-choice-candidate/api";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { resolveParticipationScopeDisplayLabel } from "../initiative-experience-i18n";

/**
 * Public Choice Architecture Pack 02A — Discussion-stage voting control.
 * SUPPORT_OPPOSE: Support / Do not support / Abstain.
 * SUPPORT_OPPOSE: Support / Do not support / Abstain ternary ballot.
 * SELECT_ONE_CANDIDATE: pointer to Collective Decision (voting lives there).
 * Visitors may vote without sign-in (credentials/cookies).
 */
export function PublicChoiceDiscussionVotePanel({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const authStatus = useClientAuthStatus();
  const [projection, setProjection] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [ballotMode, setBallotMode] = useState<PublicChoiceBallotMode>(
    DEFAULT_PUBLIC_CHOICE_BALLOT_MODE,
  );
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [currentVote, setCurrentVote] = useState<InitiativeDecisionVote | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const [initiative, listed, candidateList] = await Promise.all([
        getPublicInitiative(initiativeId),
        listPublicInitiativeCollectiveDecisions(initiativeId),
        listPublicChoiceCandidates(initiativeId).catch(() => [] as PublicChoiceCandidatePublicProjection[]),
      ]);

      const mode = resolvePublicChoiceBallotMode(
        (initiative as PublicInitiativeProjection).metadata.ballotMode,
      );
      setBallotMode(mode);
      setCandidates(candidateList);

      const opened =
        listed.decisions.find((item) => item.status === "opened") ?? listed.decisions[0] ?? null;

      if (!opened) {
        setProjection(null);
        setDecisionId(null);
        setCurrentVote(null);
        setLoadState("empty");
        return;
      }

      const detail = await getPublicInitiativeCollectiveDecision(opened.decisionId);
      if (!detail) {
        setProjection(null);
        setDecisionId(null);
        setCurrentVote(null);
        setLoadState("empty");
        return;
      }

      setDecisionId(opened.decisionId);
      setProjection(detail);
      if (detail.ballotMode) {
        setBallotMode(resolvePublicChoiceBallotMode(detail.ballotMode));
      }

      try {
        const vote = await getMyInitiativeDecisionVote(opened.decisionId);
        setCurrentVote(vote);
      } catch {
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

  const votingOpen = projection ? isCollectiveDecisionVotingWindowOpen(projection) : false;
  const unavailableCode = projection
    ? resolveCollectiveDecisionVotingUnavailableCode(projection)
    : null;
  const unavailableReason = unavailableCode
    ? t(`collaboration.vote.unavailableReasons.${unavailableCode}`)
    : t("collaboration.vote.unavailable");

  function voteChoiceLabel(choice: InitiativeDecisionVoteChoice): string {
    switch (choice) {
      case "support":
        return t("collaboration.vote.support");
      case "do_not_support":
        return t("collaboration.vote.doNotSupport");
      case "abstain":
        return t("collaboration.vote.abstain");
      default: {
        const _exhaustive: never = choice;
        return _exhaustive;
      }
    }
  }

  async function handleCast(payload: CastInitiativeDecisionVotePayload, pending: string) {
    if (!decisionId || busy || !votingOpen) {
      return;
    }

    const alreadySelected =
      payload.choice === "candidate"
        ? currentVote?.choice === "candidate" && currentVote.candidateId === payload.candidateId
        : currentVote?.choice === payload.choice && !currentVote.candidateId;

    if (alreadySelected) {
      setStatusMessage(t("collaboration.vote.alreadyRecorded"));
      return;
    }

    setBusy(true);
    setPendingKey(pending);
    setError(null);
    setStatusMessage(null);

    try {
      const vote = await castOrUpdateInitiativeDecisionVote(decisionId, payload);
      setCurrentVote(vote);
      setStatusMessage(t("collaboration.vote.voteRecorded"));
      await reload();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t("collaboration.vote.voteFailed"),
      );
    } finally {
      setBusy(false);
      setPendingKey(null);
    }
  }

  function describeCurrentSelection(): string {
    if (!currentVote) {
      return t("collaboration.vote.notVotedYet");
    }

    if (currentVote.choice === "candidate" && currentVote.candidateId) {
      const match = candidates.find((item) => item.candidateId === currentVote.candidateId);
      return match
        ? t("collaboration.vote.currentSelection", { name: match.name })
        : t("collaboration.vote.currentSelectionFallback");
    }

    return t("collaboration.vote.currentVote", {
      choice: voteChoiceLabel(
        currentVote.choice === "candidate" ? "abstain" : currentVote.choice,
      ),
    });
  }

  /** Pack 03/04 — SELECT_ONE: pointer only (no ballot). Pack 04: usually unmounted via discussionShowsVoteBallot=false. */
  if (ballotMode === "SELECT_ONE_CANDIDATE" && loadState !== "loading") {
    return (
      <section className="pie-public-choice-vote" aria-labelledby="pie-public-choice-vote-title">
        <h3 id="pie-public-choice-vote-title" className="pie-public-choice-vote__title">
          {t("collaboration.vote.titleSelectOne")}
        </h3>
        <p className="pie-public-choice-vote__help">
          {t("collaboration.vote.helpSelectOne")}
        </p>
      </section>
    );
  }

  return (
    <section className="pie-public-choice-vote" aria-labelledby="pie-public-choice-vote-title">
      <h3 id="pie-public-choice-vote-title" className="pie-public-choice-vote__title">
        {t("collaboration.vote.titleSupportOppose")}
      </h3>

      <p className="pie-public-choice-vote__help">
        {t("collaboration.vote.helpSupportOppose")}
      </p>

      {loadState === "loading" || authStatus === "pending" ? (
        <p role="status">{t("collaboration.vote.loading")}</p>
      ) : null}
      {loadState === "error" ? (
        <p role="alert">{t("collaboration.vote.error")}</p>
      ) : null}
      {loadState === "empty" ? (
        <p role="status">{t("collaboration.vote.empty")}</p>
      ) : null}

      {loadState === "ready" && projection && decisionId ? (
        !votingOpen ? (
          <p role="status">{unavailableReason}</p>
        ) : (
          <div className="pie-public-choice-vote__ballot">
            <p className="pie-public-choice-vote__current" role="status">
              {describeCurrentSelection()}
            </p>
            <p className="pie-public-choice-vote__meta">
              {t("collaboration.vote.closesMeta", {
                closesAt: new Date(projection.closesAt).toLocaleString(locale),
                scope: resolveParticipationScopeDisplayLabel(
                  projection.participationScope,
                  t,
                ),
              })}
            </p>

            {ballotMode === "SUPPORT_OPPOSE" ? (
              <div
                className="pie-public-choice-vote__choices"
                role="group"
                aria-label={t("collaboration.vote.voteChoicesAria")}
              >
                {(["support", "do_not_support", "abstain"] as const).map((choice) => {
                  const selected = currentVote?.choice === choice;
                  const pending = pendingKey === choice;
                  const label = voteChoiceLabel(choice);
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={
                        selected
                          ? "pie-public-choice-vote__choice pie-public-choice-vote__choice--selected"
                          : "pie-public-choice-vote__choice"
                      }
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => void handleCast({ choice }, choice)}
                    >
                      {pending
                        ? t("collaboration.vote.recordingChoice", { choice: label })
                        : label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <ul
                className="pie-public-choice-vote__candidates"
                aria-label={t("collaboration.vote.candidatesAria")}
              >
                {candidates.map((candidate) => {
                  const photo = resolveMediaUrl(candidate.photoUrl);
                  const selected =
                    currentVote?.choice === "candidate" &&
                    currentVote.candidateId === candidate.candidateId;
                  const pending = pendingKey === candidate.candidateId;
                  return (
                    <li key={candidate.candidateId} className="pie-public-choice-vote__candidate">
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          width={48}
                          height={48}
                          className="pie-public-choice-vote__candidate-photo"
                        />
                      ) : (
                        <span
                          className="pie-public-choice-vote__candidate-photo-placeholder"
                          aria-hidden
                        >
                          —
                        </span>
                      )}
                      <div className="pie-public-choice-vote__candidate-body">
                        <strong>{candidate.name}</strong>
                        {candidate.campaignPageUrl ? (
                          <a
                            href={candidate.campaignPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("collaboration.vote.campaignPage")}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className={
                            selected
                              ? "pie-public-choice-vote__choice pie-public-choice-vote__choice--selected"
                              : "pie-public-choice-vote__choice"
                          }
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() =>
                            void handleCast(
                              { choice: "candidate", candidateId: candidate.candidateId },
                              candidate.candidateId,
                            )
                          }
                        >
                          {pending
                            ? t("collaboration.vote.recording")
                            : selected
                              ? t("collaboration.vote.selected")
                              : t("collaboration.vote.select")}
                        </button>
                      </div>
                    </li>
                  );
                })}
                <li className="pie-public-choice-vote__candidate">
                  <button
                    type="button"
                    className={
                      currentVote?.choice === "abstain"
                        ? "pie-public-choice-vote__choice pie-public-choice-vote__choice--selected"
                        : "pie-public-choice-vote__choice"
                    }
                    aria-pressed={currentVote?.choice === "abstain"}
                    disabled={busy}
                    onClick={() => void handleCast({ choice: "abstain" }, "abstain")}
                  >
                    {pendingKey === "abstain"
                      ? t("collaboration.vote.recordingChoice", {
                          choice: voteChoiceLabel("abstain"),
                        })
                      : voteChoiceLabel("abstain")}
                  </button>
                </li>
              </ul>
            )}

            {busy ? (
              <p role="status" aria-live="polite">
                {t("collaboration.vote.submitting")}
              </p>
            ) : null}
            {statusMessage ? (
              <p role="status" aria-live="polite">
                {statusMessage}
              </p>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </div>
        )
      ) : null}
    </section>
  );
}
