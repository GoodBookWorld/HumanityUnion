"use client";

import type { MembershipStatisticsPayload } from "@hu/types";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { fetchMembershipStatistics } from "../../membership-statistics/membership-statistics-api";
import { MembershipParticipationStatisticsPanel } from "./MembershipParticipationStatisticsPanel";

interface MembershipPlatformStatisticsSectionProps {
  title?: string;
  className?: string;
  showUpdatedAt?: boolean;
}

export function MembershipPlatformStatisticsSection({
  title,
  className,
  showUpdatedAt = false,
}: MembershipPlatformStatisticsSectionProps) {
  const t = useTranslations("membershipPublic");
  const [statistics, setStatistics] = useState<MembershipStatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchMembershipStatistics()
      .then((payload) => {
        if (!cancelled) {
          setStatistics(payload);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatistics(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MembershipParticipationStatisticsPanel
      statistics={statistics}
      loading={loading}
      error={error}
      title={title ?? t("platformStatisticsTitle")}
      className={className}
      showUpdatedAt={showUpdatedAt}
    />
  );
}
