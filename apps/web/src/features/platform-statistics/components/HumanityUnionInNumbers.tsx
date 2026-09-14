"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { MembershipStatisticsPayload, PlatformStatisticsCounts } from "@hu/types";

import {
  fetchMembershipStatistics,
  formatMembershipStatisticValue,
} from "../../membership-statistics/membership-statistics-api";
import { fetchPlatformStatistics, formatPlatformStatisticValue } from "../platform-statistics-api";
import { HOME_STATISTIC_CARDS, type HomeStatisticKey } from "../public-statistics-config";
import { PublicStatisticsGrid } from "./PublicStatisticsGrid";

import "../platform-statistics.css";

export function HumanityUnionInNumbers() {
  const t = useTranslations("publicHome.statistics");
  const tMetrics = useTranslations("publicStatistics.metrics");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const locale = useLocale();
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [membershipStatistics, setMembershipStatistics] =
    useState<MembershipStatisticsPayload | null>(null);
  const [platformError, setPlatformError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.allSettled([fetchPlatformStatistics(), fetchMembershipStatistics()]).then(
      ([platformResult, membershipResult]) => {
        if (platformResult.status === "fulfilled") {
          setCounts(platformResult.value.data);
          setPlatformError(false);
        } else {
          setCounts(null);
          setPlatformError(true);
        }

        if (membershipResult.status === "fulfilled") {
          setMembershipStatistics(membershipResult.value);
          setMembershipError(false);
        } else {
          setMembershipStatistics(null);
          setMembershipError(true);
        }

        setLoading(false);
      },
    );
  }, []);

  function resolveCardValue(key: string): number | null {
    if (key === "humanityUnionMembers") {
      if (membershipError) {
        return null;
      }

      return membershipStatistics?.members ?? null;
    }

    if (platformError || !counts) {
      return null;
    }

    return counts[key as keyof PlatformStatisticsCounts] ?? null;
  }

  function formatCardValue(key: string, value: number): string {
    if (key === "humanityUnionMembers") {
      return formatMembershipStatisticValue(value, locale);
    }

    return formatPlatformStatisticValue(value, locale);
  }

  // Prefer shared metric labels when present; keep Home-specific descriptions.
  const localizedCards = HOME_STATISTIC_CARDS.map((card) => {
    const sharedKey =
      card.key === "users"
        ? "participants"
        : card.key === "humanityUnionMembers"
          ? "members"
          : card.key;
    const label = tMetrics.has(`${sharedKey}.label`)
      ? tMetrics(`${sharedKey}.label`)
      : t(`cards.${card.key as HomeStatisticKey}.label`);
    return {
      ...card,
      label,
      description: t(`cards.${card.key as HomeStatisticKey}.description`, siteName),
    };
  });

  const allUnavailable = platformError && membershipError;

  return (
    <section
      className="public-home-v2__section public-home-v2__platform-statistics platform-statistics"
      aria-labelledby="platform-statistics-title"
      aria-busy={loading}
    >
      <h2 id="platform-statistics-title">{t("title", siteName)}</h2>
      <p className="public-home-v2__section-intro platform-statistics__intro">{t("intro")}</p>

      <PublicStatisticsGrid
        cards={localizedCards}
        loading={loading}
        allUnavailable={allUnavailable}
        unavailableMessage={t("unavailable")}
        loadingMessage={t("loading")}
        aboutMetricLabel={t("aboutMetric")}
        unavailableValueLabel={t("unavailableValue")}
        formatUnavailableAriaLabel={(label) => t("unavailableAria", { label })}
        resolveValue={resolveCardValue}
        formatValue={formatCardValue}
        showDescriptions
      />
    </section>
  );
}
