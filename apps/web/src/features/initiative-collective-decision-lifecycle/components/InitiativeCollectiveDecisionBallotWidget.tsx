"use client";

import { useEffect, useState } from "react";

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
  INITIATIVE_DECISION_VOTE_CHOICES,
  describeCollectiveDecisionVotingUnavailable,
  isCollectiveDecisionVotingWindowOpen,
  labelInitiativeDecisionVoteChoice,
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
  const unavailableReason = describeCollectiveDecisionVotingUnavailable(projection);

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
          loadError instanceof Error
            ? loadError.message
            : "Your current vote could not be loaded.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, decisionId, votingOpen]);

  async function handleCast(choice: InitiativeDecisionVoteChoice) {
    if (authStatus !== "authenticated" || busy || !votingOpen) {
      return;
    }

    if (currentVote?.choice === choice) {
      setStatusMessage(`Your vote is already recorded as ${labelInitiativeDecisionVoteChoice(choice)}.`);
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
          ? `Vote updated to ${labelInitiativeDecisionVoteChoice(choice)}.`
          : `Vote recorded as ${labelInitiativeDecisionVoteChoice(choice)}.`,
      );
      await onVoteSucceeded(vote);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your vote could not be recorded.",
      );
    } finally {
      setBusy(false);
      setPendingChoice(null);
    }
  }

  if (!votingOpen) {
    return (
      <section className="icd-ballot" aria-label="Collective Decision voting">
        <h3 className="icd-ballot__title">Participant Vote</h3>
        <p className="icd-ballot__note" role="status">
          {unavailableReason ?? "Voting is not available."}
        </p>
      </section>
    );
  }

  if (authStatus === "pending" || voteLoadState === "loading") {
    return (
      <section className="icd-ballot" aria-label="Collective Decision voting">
        <h3 className="icd-ballot__title">Participant Vote</h3>
        <p className="icd-ballot__note" role="status">
          Checking your voting status…
        </p>
      </section>
    );
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.href : "/";

    return (
      <section className="icd-ballot" aria-label="Collective Decision voting">
        <h3 className="icd-ballot__title">Participant Vote</h3>
        <p className="icd-ballot__note">
          Sign in as a Participant to cast your vote on this Collective Decision. Choices are
          Support, Do Not Support, or Abstain.
        </p>
        <p className="icd-ballot__meta">
          Closes {new Date(projection.closesAt).toLocaleString()} · Scope{" "}
          {projection.participationScope}
        </p>
        <a className="icd-ballot__signin" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in to vote
        </a>
      </section>
    );
  }

  return (
    <section className="icd-ballot" aria-label="Collective Decision voting">
      <h3 className="icd-ballot__title">Participant Vote</h3>
      <p className="icd-ballot__note">
        Cast your vote on this Collective Decision. You may change your choice while voting remains
        open. Backend eligibility rules apply.
      </p>
      <p className="icd-ballot__meta">
        Closes {new Date(projection.closesAt).toLocaleString()} · Scope{" "}
        {projection.participationScope}
      </p>

      {currentVote ? (
        <p className="icd-ballot__current" role="status">
          Your current vote:{" "}
          <strong>{labelInitiativeDecisionVoteChoice(currentVote.choice)}</strong>
        </p>
      ) : (
        <p className="icd-ballot__current" role="status">
          You have not voted yet.
        </p>
      )}

      <div className="icd-ballot__choices" role="group" aria-label="Vote choices">
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
                ? `Recording ${labelInitiativeDecisionVoteChoice(choice)}…`
                : labelInitiativeDecisionVoteChoice(choice)}
            </button>
          );
        })}
      </div>

      {busy ? (
        <p className="icd-ballot__note" role="status" aria-live="polite">
          Submitting your vote…
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
