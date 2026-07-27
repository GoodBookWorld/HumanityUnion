"use client";

import { useEffect, useState } from "react";

import type { MembershipStatisticsPayload, PlatformStatisticsCounts } from "@hu/types";

import {
  fetchMembershipStatistics,
  formatMembershipStatisticValue,
} from "../../membership-statistics/membership-statistics-api";
import { fetchPlatformStatistics, formatPlatformStatisticValue } from "../platform-statistics-api";
import { HOME_STATISTIC_CARDS } from "../public-statistics-config";
import { PublicStatisticsGrid } from "./PublicStatisticsGrid";

import "../platform-statistics.css";

export function HumanityUnionInNumbers() {
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
      return formatMembershipStatisticValue(value);
    }

    return formatPlatformStatisticValue(value);
  }

  const allUnavailable = platformError && membershipError;

  return (
    <section
      className="public-home-v2__section public-home-v2__platform-statistics platform-statistics"
      aria-labelledby="platform-statistics-title"
      aria-busy={loading}
    >
      <h2 id="platform-statistics-title">Humanity Union in Numbers</h2>
      <p className="public-home-v2__section-intro platform-statistics__intro">
        A factual summary of civic activity across the platform.
      </p>

      <PublicStatisticsGrid
        cards={HOME_STATISTIC_CARDS}
        loading={loading}
        allUnavailable={allUnavailable}
        unavailableMessage="Platform statistics are temporarily unavailable."
        loadingMessage="Loading platform statistics..."
        resolveValue={resolveCardValue}
        formatValue={formatCardValue}
        showDescriptions
      />
    </section>
  );
}
