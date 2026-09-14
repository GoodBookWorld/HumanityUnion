import type { MembershipStatisticsPayload } from "@hu/types";
import { useTranslations } from "next-intl";

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
  title,
  className,
  showUpdatedAt = false,
}: MembershipParticipationStatisticsPanelProps) {
  const t = useTranslations("membershipPublic");
  const resolvedTitle = title ?? t("statistics.defaultTitle");
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
        {resolvedTitle}
      </h3>

      {loading ? (
        <p className="membership-participation-statistics__status">
          {t("statistics.loading")}
        </p>
      ) : null}

      {error ? (
        <p className="membership-participation-statistics__status" role="status">
          {t("statistics.unavailable")}
        </p>
      ) : null}

      {!loading && !error && statistics ? (
        <>
          <dl className="membership-participation-statistics__grid">
            <div className="membership-participation-statistics__item">
              <dt>{t("statistics.totalParticipation")}</dt>
              <dd>{formatMembershipStatisticValue(statistics.totalParticipation)}</dd>
            </div>
            <div className="membership-participation-statistics__item">
              <dt>{t("statistics.members")}</dt>
              <dd>{formatMembershipStatisticValue(statistics.members)}</dd>
            </div>
            <div className="membership-participation-statistics__item">
              <dt>{t("statistics.participants")}</dt>
              <dd>{formatMembershipStatisticValue(statistics.participants)}</dd>
            </div>
          </dl>
          {showUpdatedAt ? (
            <p className="membership-participation-statistics__updated">
              {t("statistics.lastUpdated", {
                when: new Date(statistics.updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          ) : null}
          <MembershipVotingExplanation className="membership-participation-statistics__note" />
        </>
      ) : null}
    </section>
  );
}
