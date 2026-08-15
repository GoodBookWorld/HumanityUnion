"use client";

import { useState } from "react";

import type { InitiativeAnalysisReactionKind, InitiativeAnalysisReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeAnalysisReaction } from "../api";

interface InitiativeAnalysisReactionWidgetProps {
  readonly analysisId: string;
  readonly reactionSummary: InitiativeAnalysisReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeAnalysisReactionSummary) => void;
}

/**
 * Initiative Lifecycle — Part B, Section 8/9 (Public Result / Reaction
 * Model). "Support Analysis" / "Do Not Support Analysis" — one reaction
 * per participant, counts update immediately, representative statistics
 * only (never framed as a vote). Guests follow the existing platform
 * rule already used for Discussion comment reactions
 * (`PublicDiscussionPanel`'s `CommentActions`): unauthenticated visitors
 * see a sign-in prompt instead of a working button, rather than being
 * silently ignored.
 */
export function InitiativeAnalysisReactionWidget({
  analysisId,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeAnalysisReactionWidgetProps) {
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReact(kind: InitiativeAnalysisReactionKind) {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const next = reactionSummary.currentUserReaction === kind ? "none" : kind;

    try {
      const updated = await setInitiativeAnalysisReaction(analysisId, next);
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
      <section className="ica-reaction" aria-label="Analysis reaction">
        <div>
          <p className="ica-reaction__title">Support Analysis</p>
          <p className="ica-reaction__note">
            {reactionSummary.support} Support · {reactionSummary.doNotSupport} Do Not Support —
            representative statistics only, not a vote.
          </p>
        </div>
        <a
          className="ica-reaction__button"
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        >
          Sign in to react
        </a>
      </section>
    );
  }

  return (
    <section className="ica-reaction" aria-label="Analysis reaction">
      <p className="ica-reaction__title">Reaction</p>
      <div className="ica-reaction__buttons">
        <button
          type="button"
          className="ica-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("support")}
        >
          Support Analysis ({reactionSummary.support})
        </button>
        <button
          type="button"
          className="ica-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "do_not_support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("do_not_support")}
        >
          Do Not Support Analysis ({reactionSummary.doNotSupport})
        </button>
      </div>
      <p className="ica-reaction__note">Representative statistics only — this is not a legal vote.</p>
      {error ? (
        <p className="ica-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
