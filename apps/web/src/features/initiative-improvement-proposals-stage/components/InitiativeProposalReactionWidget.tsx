"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeProposalReactionKind, InitiativeProposalReactionSummary } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { setInitiativeProposalReaction } from "../api";

interface InitiativeProposalReactionWidgetProps {
  readonly collectionId: string;
  readonly proposalId: string;
  readonly reactionSummary: InitiativeProposalReactionSummary;
  readonly onReactionSummaryChange: (summary: InitiativeProposalReactionSummary) => void;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part D, Section 8/9 (Public Presentation /
 * Community Reactions). Support / Do Not Support — one reaction per
 * participant per proposal, counts update immediately, representative
 * statistics only (never framed as a vote). Guests see a sign-in prompt,
 * exactly like `InitiativeAnalysisReactionWidget` (Part B).
 */
export function InitiativeProposalReactionWidget({
  collectionId,
  proposalId,
  reactionSummary,
  onReactionSummaryChange,
}: InitiativeProposalReactionWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = t("collaboration.reaction.targets.proposal");

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
        detailFromError(reactionError, t("collaboration.reaction.saveFailed")),
      );
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "unauthenticated") {
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";

    return (
      <section className="iip-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
        <div>
          <p className="iip-reaction__title">
            {t("collaboration.reaction.supportTarget", { target })}
          </p>
          <p className="iip-reaction__note">
            {t("collaboration.reaction.guestStats", {
              supportCount: reactionSummary.support,
              opposeCount: reactionSummary.doNotSupport,
              supportLabel: t("sidebar.support.support"),
              opposeLabel: t("sidebar.support.doNotSupport"),
            })}
          </p>
        </div>
        <a className="iip-reaction__button" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          {t("collaboration.reaction.signInToReact")}
        </a>
      </section>
    );
  }

  return (
    <section className="iip-reaction" aria-label={t("collaboration.reaction.aria", { target })}>
      <p className="iip-reaction__title">{t("collaboration.reaction.title")}</p>
      <div className="iip-reaction__buttons">
        <button
          type="button"
          className="iip-reaction__button"
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
          className="iip-reaction__button"
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
      <p className="iip-reaction__note">{t("collaboration.reaction.noteLegal")}</p>
      {error ? (
        <p className="iip-reaction__note" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
