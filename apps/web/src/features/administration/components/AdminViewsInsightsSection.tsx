"use client";

import { useEffect, useState } from "react";

import type {
  AuthUserPublic,
  MembershipStatisticsPayload,
  PlatformStatisticsCounts,
  PlatformStatisticsMeta,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { fetchPublicBlogPosts } from "../../blog/api";
import { listEditorialReviewQueue } from "../../blog/editorial-api";
import {
  fetchMembershipStatistics,
  formatMembershipStatisticValue,
} from "../../membership-statistics/membership-statistics-api";
import { PublicStatisticsGrid } from "../../platform-statistics/components/PublicStatisticsGrid";
import {
  fetchPlatformStatistics,
  formatPlatformStatisticValue,
} from "../../platform-statistics/platform-statistics-api";
import {
  ADMIN_OVERVIEW_STATISTIC_CARDS,
  type AdminOverviewStatisticKey,
} from "../admin-overview-statistics-config";
import { AdminCapabilityGap } from "./AdminCapabilityGap";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "../../platform-statistics/platform-statistics.css";
import "./admin-panel.css";

interface AdminViewsInsightsSectionProps {
  user: AuthUserPublic;
}

/**
 * Insights uses existing civic/ops aggregates only — not web traffic history.
 */
export function AdminViewsInsightsSection({ user: _user }: AdminViewsInsightsSectionProps) {
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [meta, setMeta] = useState<PlatformStatisticsMeta | null>(null);
  const [membership, setMembership] = useState<MembershipStatisticsPayload | null>(null);
  const [publishedBlogTotal, setPublishedBlogTotal] = useState<number | null>(null);
  const [editorialPending, setEditorialPending] = useState<number | null>(null);
  const [platformStatsError, setPlatformStatsError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [blogError, setBlogError] = useState(false);
  const [editorialError, setEditorialError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      fetchPlatformStatistics(),
      fetchMembershipStatistics(),
      fetchPublicBlogPosts({ limit: 1, offset: 0 }),
      listEditorialReviewQueue({ limit: 1, offset: 0 }),
    ]).then(([platformResult, membershipResult, blogResult, editorialResult]) => {
      if (cancelled) {
        return;
      }

      if (platformResult.status === "fulfilled") {
        setCounts(platformResult.value.data);
        setMeta(platformResult.value.meta);
        setPlatformStatsError(false);
      } else {
        setCounts(null);
        setMeta(null);
        setPlatformStatsError(true);
      }

      if (membershipResult.status === "fulfilled") {
        setMembership(membershipResult.value);
        setMembershipError(false);
      } else {
        setMembership(null);
        setMembershipError(true);
      }

      if (blogResult.status === "fulfilled") {
        setPublishedBlogTotal(blogResult.value.total);
        setBlogError(false);
      } else {
        setPublishedBlogTotal(null);
        setBlogError(true);
      }

      if (editorialResult.status === "fulfilled") {
        setEditorialPending(editorialResult.value.total);
        setEditorialError(false);
      } else {
        setEditorialPending(null);
        setEditorialError(true);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function resolveCardValue(key: string): number | null {
    const statisticKey = key as AdminOverviewStatisticKey;

    if (statisticKey === "humanityUnionMembers") {
      if (membershipError) {
        return null;
      }
      return membership?.members ?? null;
    }

    if (statisticKey === "publishedBlogPosts") {
      if (blogError) {
        return null;
      }
      return publishedBlogTotal;
    }

    if (statisticKey === "editorialPending") {
      if (editorialError) {
        return null;
      }
      return editorialPending;
    }

    if (platformStatsError || !counts) {
      return null;
    }

    return counts[statisticKey as keyof PlatformStatisticsCounts] ?? null;
  }

  function formatCardValue(key: string, value: number): string {
    if (key === "humanityUnionMembers") {
      return formatMembershipStatisticValue(value);
    }
    return formatPlatformStatisticValue(value);
  }

  const allUnavailable =
    platformStatsError && membershipError && blogError && editorialError;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Insights">
        <p className="hu-caption admin-panel__note">
          These figures are civic and operational aggregates from existing platform APIs —
          not historical web analytics traffic.
        </p>
        {meta ? (
          <ProfileField
            label="Recently active window (days)"
            value={String(meta.activeMemberWindowDays)}
          />
        ) : null}
      </ProfileSection>

      <section className="platform-statistics admin-panel__statistics" aria-labelledby="admin-insights-stats">
        <h2 id="admin-insights-stats" className="profile-section__title">
          Operational totals
        </h2>
        <PublicStatisticsGrid
          cards={ADMIN_OVERVIEW_STATISTIC_CARDS}
          loading={loading}
          allUnavailable={allUnavailable}
          unavailableMessage="Operational statistics are temporarily unavailable."
          loadingMessage="Loading operational statistics…"
          resolveValue={resolveCardValue}
          formatValue={formatCardValue}
          showDescriptions
        />
      </section>

      <AdminCapabilityGap
        title="Historical trends / all-time Views / Visitors"
        message="Time-series Views, Visitors, and monthly/yearly web analytics are not persisted."
        details={[
          "Membership growth time-series dimensions are typed as future-only and not implemented.",
          "No chart library or historical analytics API exists in the repository.",
        ]}
      />
    </div>
  );
}
