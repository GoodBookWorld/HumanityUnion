"use client";

import { useState } from "react";

import type { InitiativeRevisionReactionKind, InitiativeRevisionReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeRevisionReaction } from "../api";

interface InitiativeRevisionReactionWidgetProps {
  readonly initiativeId: string;
  readonly version: number;
  readonly reactionSummary: InitiativeRevisionReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeRevisionReactionSummary) => void;
}

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions).
 * "Support Revision" / "Do Not Support Revision" — one reaction per
 * participant per published Revision version, counts update immediately,
 * representative statistics only (never framed as a vote). Guests see a
 * sign-in prompt, exactly like `InitiativeProposalReactionWidget` (Part D).
 */
export function InitiativeRevisionReactionWidget({
  initiativeId,
  version,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeRevisionReactionWidgetProps) {
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReact(kind: InitiativeRevisionReactionKind) {
    if (authStatus !== "authenticated" || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const next = reactionSummary.currentUserReaction === kind ? "none" : kind;

    try {
      const updated = await setInitiativeRevisionReaction(initiativeId, version, next);
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
      <section className="irv-reaction" aria-label="Revision reaction">
        <div>
          <p className="irv-reaction__title">Support Revision</p>
          <p className="irv-reaction__note">
            {reactionSummary.support} Support · {reactionSummary.doNotSupport} Do Not Support —
            representative statistics only, not a vote.
          </p>
        </div>
        <a className="irv-reaction__button" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in to react
        </a>
      </section>
    );
  }

  return (
    <section className="irv-reaction" aria-label="Revision reaction">
      <p className="irv-reaction__title">Reaction</p>
      <div className="irv-reaction__buttons">
        <button
          type="button"
          className="irv-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("support")}
        >
          Support Revision ({reactionSummary.support})
        </button>
        <button
          type="button"
          className="irv-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "do_not_support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("do_not_support")}
        >
          Do Not Support Revision ({reactionSummary.doNotSupport})
        </button>
      </div>
      <p className="irv-reaction__note">Representative statistics only — this is not a legal vote.</p>
      {error ? (
        <p className="irv-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
