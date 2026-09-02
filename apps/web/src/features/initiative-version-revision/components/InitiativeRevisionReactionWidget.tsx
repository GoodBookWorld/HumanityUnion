"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeRevisionReactionKind, InitiativeRevisionReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeRevisionReaction } from "../api";

interface InitiativeRevisionReactionWidgetProps {
  readonly initiativeId: string;
  readonly version: number;
  readonly reactionSummary: InitiativeRevisionReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeRevisionReactionSummary) => void;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions).
 * Support / Do Not Support — one reaction per participant per published
 * Revision version, counts update immediately, representative statistics
 * only (never framed as a vote). Guests see a sign-in prompt, exactly
 * like `InitiativeProposalReactionWidget` (Part D).
 */
export function InitiativeRevisionReactionWidget({
  initiativeId,
  version,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeRevisionReactionWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = t("collaboration.reaction.targets.revision");

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
        detailFromError(reactionError, t("collaboration.reaction.saveFailed")),
      );
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";

    return (
      <section className="irv-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
        <div>
          <p className="irv-reaction__title">
            {t("collaboration.reaction.supportTarget", { target })}
          </p>
          <p className="irv-reaction__note">
            {t("collaboration.reaction.guestStats", {
              supportCount: reactionSummary.support,
              opposeCount: reactionSummary.doNotSupport,
              supportLabel: t("sidebar.support.support"),
              opposeLabel: t("sidebar.support.doNotSupport"),
            })}
          </p>
        </div>
        <a className="irv-reaction__button" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          {t("collaboration.reaction.signInToReact")}
        </a>
      </section>
    );
  }

  return (
    <section className="irv-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
      <p className="irv-reaction__title">{t("collaboration.reaction.title")}</p>
      <div className="irv-reaction__buttons">
        <button
          type="button"
          className="irv-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("support")}
        >
          {t("collaboration.reaction.supportTargetWithCount", {
            target,
            count: reactionSummary.support,
          })}
        </button>
        <button
          type="button"
          className="irv-reaction__button"
          aria-pressed={reactionSummary.currentUserReaction === "do_not_support"}
          disabled={busy || authStatus === "pending"}
          onClick={() => void handleReact("do_not_support")}
        >
          {t("collaboration.reaction.opposeTargetWithCount", {
            target,
            count: reactionSummary.doNotSupport,
          })}
        </button>
      </div>
      <p className="irv-reaction__note">{t("collaboration.reaction.noteLegal")}</p>
      {error ? (
        <p className="irv-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
