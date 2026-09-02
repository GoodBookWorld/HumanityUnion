"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoice,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
} from "../../initiative-collective-decision/api";
import {
  resolveInitiativeDecisionVoteChoiceDisplayLabel,
  resolveParticipationScopeDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";

import {
  INITIATIVE_DECISION_VOTE_CHOICES,
  describeCollectiveDecisionVotingUnavailable,
  isCollectiveDecisionVotingWindowOpen,
} from "../collective-decision-voting";

interface InitiativeCollectiveDecisionBallotWidgetProps {
  readonly decisionId: string;
  readonly projection: PublicInitiativeCollectiveDecisionProjection;
  readonly onVoteSucceeded: (vote: InitiativeDecisionVote) => void | Promise<void>;
}

/**
 * Lifecycle UX Pack 01 — Participant ballot on the canonical Collective
 * Decision public result (Initiative lifecycle shell).
 *
 * Reuses POST `/api/v1/initiative-collective-decisions/:decisionId/vote` and
 * GET `.../my-vote`. Does not invent ballot choices or a parallel vote domain.
 */
export function InitiativeCollectiveDecisionBallotWidget({
  decisionId,
  projection,
  onVoteSucceeded,
}: InitiativeCollectiveDecisionBallotWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [currentVote, setCurrentVote] = useState<InitiativeDecisionVote | null>(null);
  const [voteLoadState, setVoteLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [pendingChoice, setPendingChoice] = useState<InitiativeDecisionVoteChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const votingOpen = isCollectiveDecisionVotingWindowOpen(projection);
  // Contract debt: English prose without stable reason codes — do not sentence-match.
  const unavailableReason = describeCollectiveDecisionVotingUnavailable(projection);

  function choiceLabel(choice: string): string {
    return resolveInitiativeDecisionVoteChoiceDisplayLabel(choice, t);
  }

  useEffect(() => {
    if (!votingOpen || authStatus !== "authenticated") {
      setCurrentVote(null);
      setVoteLoadState(authStatus === "pending" ? "loading" : "idle");
      return;
    }

    let cancelled = false;
    setVoteLoadState("loading");

    void (async () => {
      try {
        const vote = await getMyInitiativeDecisionVote(decisionId);
        if (!cancelled) {
          setCurrentVote(vote);
          setVoteLoadState("ready");
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(loadError)) {
          setCurrentVote(null);
          setVoteLoadState("idle");
          return;
        }

        setVoteLoadState("error");
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : t("author.collectiveDecision.ballot.voteLoadFailed"),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, decisionId, t, votingOpen]);

  async function handleCast(choice: InitiativeDecisionVoteChoice) {
    if (authStatus !== "authenticated" || busy || !votingOpen) {
      return;
    }

    if (currentVote?.choice === choice) {
      setStatusMessage(
        t("author.collectiveDecision.ballot.alreadyRecorded", {
          choice: choiceLabel(choice),
        }),
      );
      return;
    }

    setBusy(true);
    setPendingChoice(choice);
    setError(null);
    setStatusMessage(null);

    try {
      const vote = await castOrUpdateInitiativeDecisionVote(decisionId, choice);
      setCurrentVote(vote);
      setVoteLoadState("ready");
      setStatusMessage(
        currentVote
          ? t("author.collectiveDecision.ballot.voteUpdated", { choice: choiceLabel(choice) })
          : t("author.collectiveDecision.ballot.voteRecorded", { choice: choiceLabel(choice) }),
      );
      await onVoteSucceeded(vote);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error && submissionError.message.trim()
          ? submissionError.message
          : t("author.collectiveDecision.ballot.voteSubmitFailed"),
      );
    } finally {
      setBusy(false);
      setPendingChoice(null);
    }
  }

  const closesMeta = t("collaboration.vote.closesMeta", {
    closesAt: new Date(projection.closesAt).toLocaleString(),
    scope: resolveParticipationScopeDisplayLabel(projection.participationScope, t),
  });

  if (!votingOpen) {
    return (
      <section className="icd-ballot" aria-label={t("author.collectiveDecision.ballot.aria")}>
        <h3 className="icd-ballot__title">{t("author.collectiveDecision.ballot.title")}</h3>
        <p className="icd-ballot__note" role="status">
          {unavailableReason ?? t("collaboration.vote.unavailable")}
        </p>
      </section>
    );
  }

  if (authStatus === "pending" || voteLoadState === "loading") {
    return (
      <section className="icd-ballot" aria-label={t("author.collectiveDecision.ballot.aria")}>
        <h3 className="icd-ballot__title">{t("author.collectiveDecision.ballot.title")}</h3>
        <p className="icd-ballot__note" role="status">
          {t("author.collectiveDecision.ballot.checkingStatus")}
        </p>
      </section>
    );
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.href : "/";

    return (
      <section className="icd-ballot" aria-label={t("author.collectiveDecision.ballot.aria")}>
        <h3 className="icd-ballot__title">{t("author.collectiveDecision.ballot.title")}</h3>
        <p className="icd-ballot__note">{t("author.collectiveDecision.ballot.signInNote")}</p>
        <p className="icd-ballot__meta">{closesMeta}</p>
        <a className="icd-ballot__signin" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          {t("collaboration.vote.signInToVote")}
        </a>
      </section>
    );
  }

  return (
    <section className="icd-ballot" aria-label={t("author.collectiveDecision.ballot.aria")}>
      <h3 className="icd-ballot__title">{t("author.collectiveDecision.ballot.title")}</h3>
      <p className="icd-ballot__note">{t("author.collectiveDecision.ballot.castNote")}</p>
      <p className="icd-ballot__meta">{closesMeta}</p>

      {currentVote ? (
        <p className="icd-ballot__current" role="status">
          {t("collaboration.vote.currentVote", { choice: choiceLabel(currentVote.choice) })}
        </p>
      ) : (
        <p className="icd-ballot__current" role="status">
          {t("collaboration.vote.notVotedYet")}
        </p>
      )}

      <div className="icd-ballot__choices" role="group" aria-label={t("collaboration.vote.voteChoicesAria")}>
        {INITIATIVE_DECISION_VOTE_CHOICES.map((choice) => {
          const selected = currentVote?.choice === choice;
          const pending = pendingChoice === choice;

          return (
            <button
              key={choice}
              type="button"
              className={
                selected ? "icd-ballot__choice icd-ballot__choice--selected" : "icd-ballot__choice"
              }
              aria-pressed={selected}
              disabled={busy}
              onClick={() => void handleCast(choice)}
            >
              {pending
                ? t("collaboration.vote.recordingChoice", { choice: choiceLabel(choice) })
                : choiceLabel(choice)}
            </button>
          );
        })}
      </div>

      {busy ? (
        <p className="icd-ballot__note" role="status" aria-live="polite">
          {t("collaboration.vote.submitting")}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="icd-ballot__success" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {error ? (
        <p className="icd-ballot__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
