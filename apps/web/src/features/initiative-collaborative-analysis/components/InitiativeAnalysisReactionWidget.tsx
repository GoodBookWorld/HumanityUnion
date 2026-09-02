"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeAnalysisReactionKind, InitiativeAnalysisReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeAnalysisReaction } from "../api";

interface InitiativeAnalysisReactionWidgetProps {
  readonly analysisId: string;
  readonly reactionSummary: InitiativeAnalysisReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeAnalysisReactionSummary) => void;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part B, Section 8/9 (Public Result / Reaction
 * Model). Support / Do Not Support — one reaction per participant, counts
 * update immediately, representative statistics only (never framed as a
 * vote). Guests follow the existing platform rule already used for
 * Discussion comment reactions (`PublicDiscussionPanel`'s
 * `CommentActions`): unauthenticated visitors see a sign-in prompt
 * instead of a working button, rather than being silently ignored.
 */
export function InitiativeAnalysisReactionWidget({
  analysisId,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeAnalysisReactionWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = t("collaboration.reaction.targets.analysis");

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
        detailFromError(reactionError, t("collaboration.reaction.saveFailed")),
      );
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";

    return (
      <section className="ica-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
        <div>
          <p className="ica-reaction__title">
            {t("collaboration.reaction.supportTarget", { target })}
          </p>
          <p className="ica-reaction__note">
            {t("collaboration.reaction.guestStats", {
              supportCount: reactionSummary.support,
              opposeCount: reactionSummary.doNotSupport,
              supportLabel: t("sidebar.support.support"),
              opposeLabel: t("sidebar.support.doNotSupport"),
            })}
          </p>
        </div>
        <a
          className="ica-reaction__button"
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        >
          {t("collaboration.reaction.signInToReact")}
        </a>
      </section>
    );
  }

  return (
    <section className="ica-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
      <p className="ica-reaction__title">{t("collaboration.reaction.title")}</p>
      <div className="ica-reaction__buttons">
        <button
          type="button"
          className="ica-reaction__button"
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
          className="ica-reaction__button"
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
      <p className="ica-reaction__note">{t("collaboration.reaction.noteLegal")}</p>
      {error ? (
        <p className="ica-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
