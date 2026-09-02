"use client";

import type {
  InitiativeSupportAudienceBreakdown,
  InitiativeSupportSignalKind,
  PublicInitiativeSupportStatistics,
} from "@hu/types";
import { useTranslations } from "next-intl";

interface PublicInitiativeSupportStatisticsProps {
  statistics: PublicInitiativeSupportStatistics;
  onSignalChange: (signal: InitiativeSupportSignalKind) => void;
  onBookmarkToggle: () => void;
  busy?: boolean;
  className?: string;
  title?: string;
}

function BreakdownRow({
  label,
  breakdown,
  totalLabel,
  participantsLabel,
  membersLabel,
  visitorsLabel,
}: {
  label: string;
  breakdown: InitiativeSupportAudienceBreakdown;
  totalLabel: string;
  participantsLabel: string;
  membersLabel: string;
  visitorsLabel: string;
}) {
  return (
    <div className="pie-support__breakdown">
      <h4>{label}</h4>
      <ul>
        <li>
          <span>{totalLabel}</span>
          <strong>{breakdown.total}</strong>
        </li>
        <li>
          <img
            src="/icons/workspace/members.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
          <span>{participantsLabel}</span>
          <strong>{breakdown.participants}</strong>
        </li>
        <li>
          <img
            src="/icons/workspace/member-check.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
          <span>{membersLabel}</span>
          <strong>{breakdown.members}</strong>
        </li>
        <li>
          <img
            src="/illustrations/test-account.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
          <span>{visitorsLabel}</span>
          <strong>{breakdown.visitors}</strong>
        </li>
      </ul>
    </div>
  );
}

export function PublicInitiativeSupportStatistics({
  statistics,
  onSignalChange,
  onBookmarkToggle,
  busy = false,
  className,
  title,
}: PublicInitiativeSupportStatisticsProps) {
  const t = useTranslations("initiativeExperience");
  const rootClass = className ? `pie-support ${className}` : "pie-support";
  const resolvedTitle = title ?? t("sidebar.support.title");
  // Prefer catalog chrome; preserve arbitrary server transparency notes without English matching.
  const transparencyNote =
    statistics.transparencyNote?.trim() || t("sidebar.support.transparencyNote");

  return (
    <section className={rootClass} aria-labelledby="pie-support-title">
      <h2 id="pie-support-title" className="pie-support__title">
        {resolvedTitle}
      </h2>
      <p className="pie-support__subtitle">{t("sidebar.support.subtitle")}</p>

      <div className="pie-support__actions">
        <button
          type="button"
          className={`pie-support__signal${statistics.currentUserSignal === "like" ? " pie-support__signal--active" : ""}`}
          aria-pressed={statistics.currentUserSignal === "like"}
          aria-label={t("sidebar.support.supportAria")}
          disabled={busy}
          onClick={() => onSignalChange(statistics.currentUserSignal === "like" ? "none" : "like")}
        >
          <img src="/icons/workspace/like.svg" alt="" aria-hidden="true" width={32} height={32} />
          {t("sidebar.support.support")}
        </button>
        <button
          type="button"
          className={`pie-support__signal${statistics.currentUserSignal === "dislike" ? " pie-support__signal--active" : ""}`}
          aria-pressed={statistics.currentUserSignal === "dislike"}
          aria-label={t("sidebar.support.doNotSupportAria")}
          disabled={busy}
          onClick={() =>
            onSignalChange(statistics.currentUserSignal === "dislike" ? "none" : "dislike")
          }
        >
          <img
            src="/icons/workspace/dislike.svg"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
          />
          {t("sidebar.support.doNotSupport")}
        </button>
      </div>

      <BreakdownRow
        label={t("sidebar.support.support")}
        breakdown={statistics.likes}
        totalLabel={t("sidebar.support.total")}
        participantsLabel={t("sidebar.support.participants")}
        membersLabel={t("sidebar.support.members")}
        visitorsLabel={t("sidebar.support.visitors")}
      />
      <BreakdownRow
        label={t("sidebar.support.doNotSupport")}
        breakdown={statistics.dislikes}
        totalLabel={t("sidebar.support.total")}
        participantsLabel={t("sidebar.support.participants")}
        membersLabel={t("sidebar.support.members")}
        visitorsLabel={t("sidebar.support.visitors")}
      />

      <div className="pie-support__metrics">
        <button
          type="button"
          className={`pie-support__bookmark${statistics.currentUserBookmarked ? " pie-support__bookmark--active" : ""}`}
          aria-pressed={statistics.currentUserBookmarked}
          disabled={busy}
          onClick={onBookmarkToggle}
        >
          {t("sidebar.support.bookmarks")} <strong>{statistics.bookmarks.total}</strong>
        </button>
        <p>
          {t("sidebar.support.views")}{" "}
          <strong>
            {statistics.views.available
              ? statistics.views.total
              : t("sidebar.support.unavailable")}
          </strong>
        </p>
      </div>

      <p className="pie-support__note" role="note">
        {transparencyNote}
      </p>
    </section>
  );
}
