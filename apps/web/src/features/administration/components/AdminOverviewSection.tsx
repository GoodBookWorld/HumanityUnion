"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  AuthUserPublic,
  MembershipStatisticsPayload,
  PlatformConfigPublic,
  PlatformStatisticsCounts,
  PlatformStatisticsMeta,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { listEditorialReviewQueue } from "../../blog/editorial-api";
import { fetchPublicBlogPosts } from "../../blog/api";
import { getPlatformConfig } from "../../closed-beta/platform-api";
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
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "../../platform-statistics/platform-statistics.css";
import "./admin-panel.css";

interface AdminOverviewSectionProps {
  user: AuthUserPublic;
}

export function AdminOverviewSection({ user }: AdminOverviewSectionProps) {
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [meta, setMeta] = useState<PlatformStatisticsMeta | null>(null);
  const [membership, setMembership] = useState<MembershipStatisticsPayload | null>(null);
  const [platform, setPlatform] = useState<PlatformConfigPublic | null>(null);
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
      getPlatformConfig(),
      fetchPublicBlogPosts({ limit: 1, offset: 0 }),
      listEditorialReviewQueue({ limit: 1, offset: 0 }),
    ]).then(([platformResult, membershipResult, configResult, blogResult, editorialResult]) => {
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

      if (configResult.status === "fulfilled") {
        setPlatform(configResult.value);
      } else {
        setPlatform(null);
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

      <ProfileSection title="Administrator">
        <ProfileField label="Display name" value={user.displayName} />
        <ProfileField label="Email" value={user.email} />
        <ProfileField label="Role" value={user.role} />
        <ProfileField label="Participant / Member ID" value={user.memberId} />
        <ProfileField label="Account status" value={user.status} />
      </ProfileSection>

      <ProfileSection title="Platform status">
        <ProfileField label="Platform mode" value={platform?.platformMode ?? "Unavailable"} />
        <ProfileField
          label="Registration requires invite"
          value={
            platform
              ? platform.registrationRequiresInvite
                ? "Yes"
                : "No"
              : "Unavailable"
          }
        />
        <ProfileField
          label="Beta banner"
          value={platform ? (platform.showBetaBanner ? "Visible" : "Hidden") : "Unavailable"}
        />
        {meta ? (
          <ProfileField
            label="Active Participant window (days)"
            value={String(meta.activeMemberWindowDays)}
          />
        ) : null}
      </ProfileSection>

      <section className="platform-statistics admin-panel__statistics" aria-labelledby="admin-overview-stats">
        <h2 id="admin-overview-stats" className="profile-section__title">
          Operational overview
        </h2>
        <p className="hu-caption admin-panel__note">
          Metrics come from existing platform, membership, Blog, and Editorial APIs.
          Unavailable values are shown as Unavailable — never invented.
        </p>
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

      <ProfileSection title="Quick links">
        <ul className="admin-panel__links">
          <li>
            <Link className="admin-panel__link" href="/admin/publishing">
              Publishing
            </Link>
            <span className="hu-caption"> — Editorial queue and published Blog totals</span>
          </li>
          <li>
            <Link className="admin-panel__link" href="/workspace/editorial">
              Editorial Review
            </Link>
            <span className="hu-caption"> — existing Workspace editorial workflow</span>
          </li>
          <li>
            <Link className="admin-panel__link" href="/admin/beta-access">
              Beta Access
            </Link>
            <span className="hu-caption"> — invite management</span>
          </li>
          <li>
            <Link className="admin-panel__link" href="/admin/initiatives">
              Initiatives
            </Link>
            <span className="hu-caption"> — operational Initiative inventory</span>
          </li>
        </ul>
      </ProfileSection>
    </div>
  );
}
