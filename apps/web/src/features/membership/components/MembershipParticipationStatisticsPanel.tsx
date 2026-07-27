import type { MembershipStatisticsPayload } from "@hu/types";

import { formatMembershipStatisticValue } from "../../membership-statistics/membership-statistics-api";
import { MembershipVotingExplanation } from "./MembershipVotingExplanation";

import "./membership-participation-statistics.css";

interface MembershipParticipationStatisticsPanelProps {
  statistics: MembershipStatisticsPayload | null;
  loading?: boolean;
  error?: boolean;
  title?: string;
  className?: string;
  showUpdatedAt?: boolean;
}

export function MembershipParticipationStatisticsPanel({
  statistics,
  loading = false,
  error = false,
  title = "Membership participation",
  className,
  showUpdatedAt = false,
}: MembershipParticipationStatisticsPanelProps) {
  const rootClassName = className
    ? `membership-participation-statistics ${className}`
    : "membership-participation-statistics";

  return (
    <section
      className={rootClassName}
      aria-labelledby="membership-participation-statistics-title"
      aria-busy={loading}
    >
      <h3
        id="membership-participation-statistics-title"
        className="membership-participation-statistics__title"
      >
        {title}
      </h3>

      {loading ? (
        <p className="membership-participation-statistics__status">
          Loading participation statistics...
        </p>
      ) : null}

      {error ? (
        <p className="membership-participation-statistics__status" role="status">
          Participation statistics are temporarily unavailable.
        </p>
      ) : null}

      {!loading && !error && statistics ? (
        <>
          <dl className="membership-participation-statistics__grid">
            <div className="membership-participation-statistics__item">
              <dt>Total participation</dt>
              <dd>{formatMembershipStatisticValue(statistics.totalParticipation)}</dd>
            </div>
            <div className="membership-participation-statistics__item">
              <dt>Members</dt>
              <dd>{formatMembershipStatisticValue(statistics.members)}</dd>
            </div>
            <div className="membership-participation-statistics__item">
              <dt>Participants</dt>
              <dd>{formatMembershipStatisticValue(statistics.participants)}</dd>
            </div>
          </dl>
          {showUpdatedAt ? (
            <p className="membership-participation-statistics__updated">
              Last updated{" "}
              {new Date(statistics.updatedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          <MembershipVotingExplanation className="membership-participation-statistics__note" />
        </>
      ) : null}
    </section>
  );
}
