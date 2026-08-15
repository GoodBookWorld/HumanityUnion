"use client";

import { useState } from "react";

import type { InitiativeProposalReactionKind, InitiativeProposalReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeProposalReaction } from "../api";

interface InitiativeProposalReactionWidgetProps {
  readonly collectionId: string;
  readonly proposalId: string;
  readonly reactionSummary: InitiativeProposalReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeProposalReactionSummary) => void;
}

/**
 * Initiative Lifecycle — Part D, Section 8/9 (Public Presentation /
 * Community Reactions). "Support Proposal" / "Do Not Support Proposal" —
 * one reaction per participant per proposal, counts update immediately,
 * representative statistics only (never framed as a vote). Guests see a
 * sign-in prompt, exactly like `InitiativeAnalysisReactionWidget`
 * (Part B).
 */
export function InitiativeProposalReactionWidget({
  collectionId,
  proposalId,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeProposalReactionWidgetProps) {
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReact(kind: InitiativeProposalReactionKind) {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const next = reactionSummary.currentUserReaction === kind ? "none" : kind;

    try {
      const updated = await setInitiativeProposalReaction(collectionId, proposalId, next);
      onReactionSummaryChange(updated);
    } catch (reactionError) {
      setError(
        reactionError instanceof Error ? reactionError.message : "This reaction could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";

    return (
      <section className="iip-reaction" aria-label="Proposal reaction">
        <div>
          <p className="iip-reaction__title">Support Proposal</p>
          <p className="iip-reaction__note">
            {reactionSummary.support} Support · {reactionSummary.doNotSupport} Do Not Support —
            representative statistics only, not a vote.
          </p>
        </div>
        <a className="iip-reaction__button" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in to react
        </a>
      </section>
    );
  }

  return (
    <section className="iip-reaction" aria-label="Proposal reaction">
      <p className="iip-reaction__title">Reaction</p>
      <div className="iip-reaction__buttons">
        <button
          type="button"
          className="iip-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("support")}
        >
          Support Proposal ({reactionSummary.support})
        </button>
        <button
          type="button"
          className="iip-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "do_not_support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("do_not_support")}
        >
          Do Not Support Proposal ({reactionSummary.doNotSupport})
        </button>
      </div>
      <p className="iip-reaction__note">Representative statistics only — this is not a legal vote.</p>
      {error ? (
        <p className="iip-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
