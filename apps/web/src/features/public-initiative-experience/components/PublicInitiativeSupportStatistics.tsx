"use client";

import type {
  InitiativeSupportAudienceBreakdown,
  InitiativeSupportSignalKind,
  PublicInitiativeSupportStatistics,
} from "@hu/types";
import { INITIATIVE_SUPPORT_TRANSPARENCY_NOTE } from "@hu/types";

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
}: {
  label: string;
  breakdown: InitiativeSupportAudienceBreakdown;
}) {
  return (
    <div className="pie-support__breakdown">
      <h4>{label}</h4>
      <ul>
        <li>
          <span>Total</span>
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
          <span>Participants</span>
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
          <span>Members</span>
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
          <span>Visitors</span>
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
  title = "Support",
}: PublicInitiativeSupportStatisticsProps) {
  const rootClass = className ? `pie-support ${className}` : "pie-support";

  return (
    <section className={rootClass} aria-labelledby="pie-support-title">
      <h2 id="pie-support-title" className="pie-support__title">
        {title}
      </h2>

      <div className="pie-support__actions">
        <button
          type="button"
          className={`pie-support__signal${statistics.currentUserSignal === "like" ? " pie-support__signal--active" : ""}`}
          aria-pressed={statistics.currentUserSignal === "like"}
          aria-label="Like this initiative"
          disabled={busy}
          onClick={() => onSignalChange(statistics.currentUserSignal === "like" ? "none" : "like")}
        >
          <img src="/icons/workspace/like.svg" alt="" aria-hidden="true" width={32} height={32} />
          Like
        </button>
        <button
          type="button"
          className={`pie-support__signal${statistics.currentUserSignal === "dislike" ? " pie-support__signal--active" : ""}`}
          aria-pressed={statistics.currentUserSignal === "dislike"}
          aria-label="Dislike this initiative"
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
          Dislike
        </button>
      </div>

      <BreakdownRow label="Like" breakdown={statistics.likes} />
      <BreakdownRow label="Dislike" breakdown={statistics.dislikes} />

      <div className="pie-support__metrics">
        <button
          type="button"
          className={`pie-support__bookmark${statistics.currentUserBookmarked ? " pie-support__bookmark--active" : ""}`}
          aria-pressed={statistics.currentUserBookmarked}
          disabled={busy}
          onClick={onBookmarkToggle}
        >
          Bookmarks <strong>{statistics.bookmarks.total}</strong>
        </button>
        <p>
          Views{" "}
          <strong>{statistics.views.available ? statistics.views.total : "Unavailable"}</strong>
        </p>
      </div>

      <p className="pie-support__note" role="note">
        {statistics.transparencyNote || INITIATIVE_SUPPORT_TRANSPARENCY_NOTE}
      </p>
    </section>
  );
}
