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

import { ProfileSection } from "../../../components/member/ProfileSection";
import { fetchPublicBlogPosts } from "../../blog/api";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import { getMyMemberProfile } from "../../member-profile/member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";
import { resolveDisplayName } from "../../member-profile/participant-profile-surface-presentation";
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
import { AdminEditorsOverviewSummary } from "./AdminEditorsOverviewSummary";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "../../platform-statistics/platform-statistics.css";
import "./admin-panel.css";
import "./admin-editors.css";

interface AdminOverviewSectionProps {
  user: AuthUserPublic;
}

export function AdminOverviewSection({ user }: AdminOverviewSectionProps) {
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [meta, setMeta] = useState<PlatformStatisticsMeta | null>(null);
  const [membership, setMembership] = useState<MembershipStatisticsPayload | null>(null);
  const [platform, setPlatform] = useState<PlatformConfigPublic | null>(null);
  const [publishedBlogTotal, setPublishedBlogTotal] = useState<number | null>(null);
  const [platformStatsError, setPlatformStatsError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [blogError, setBlogError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [techOpen, setTechOpen] = useState(false);
  /** Pack 11A — Profile displayName authority (not auth.users snapshot). */
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileDisplayName() {
      try {
        const profile = await getMyMemberProfile();
        if (!cancelled) {
          setProfileDisplayName(resolveDisplayName(profile));
        }
      } catch {
        if (!cancelled) {
          setProfileDisplayName(resolveDisplayName({ displayName: undefined }));
        }
      }
    }

    void loadProfileDisplayName();

    function handleProfileUpdated() {
      void loadProfileDisplayName();
    }

    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      fetchPlatformStatistics(),
      fetchMembershipStatistics(),
      getPlatformConfig(),
      fetchPublicBlogPosts({ limit: 1, offset: 0, includeDiscovery: false }),
    ]).then(([platformResult, membershipResult, configResult, blogResult]) => {
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

  const allUnavailable = platformStatsError && membershipError && blogError;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Administrator">
        <AdminMetricDetailsGrid
          aria-label="Administrator details"
          cells={[
            {
              label: "Display name",
              value: profileDisplayName ?? resolveDisplayName({ displayName: undefined }),
            },
            { label: "Email", value: user.email },
            { label: "Role", value: user.role === "admin" ? "Administrator" : user.role },
            { label: "Account status", value: user.status === "active" ? "Active" : "Disabled" },
          ]}
        />
        <details
          className="admin-panel__tech-details"
          open={techOpen}
          onToggle={(event) => setTechOpen(event.currentTarget.open)}
        >
          <summary>Technical details</summary>
          <dl className="admin-panel__tech-list">
            <div>
              <dt>User ID</dt>
              <dd>
                <code>{user.userId}</code>
              </dd>
            </div>
            <div>
              <dt>Participant / Member ID</dt>
              <dd>
                <code>{user.memberId}</code>
              </dd>
            </div>
          </dl>
        </details>
      </ProfileSection>

      <ProfileSection title="Platform status">
        <AdminMetricDetailsGrid
          aria-label="Platform status"
          cells={[
            {
              label: "Platform mode",
              value: platform?.platformMode ?? "Unavailable",
            },
            {
              label: "Registration / invite gate",
              value: platform
                ? platform.registrationRequiresInvite
                  ? "Invite required"
                  : "Open registration"
                : "Unavailable",
            },
            {
              label: "Beta banner",
              value: platform
                ? platform.showBetaBanner
                  ? "Visible"
                  : "Hidden"
                : "Unavailable",
            },
            {
              label: "Active Participant window",
              value: meta ? `${meta.activeMemberWindowDays} days` : "Unavailable",
              caption: "activity measurement window",
              methodological: true,
            },
          ]}
        />
      </ProfileSection>

      <section
        className="platform-statistics admin-panel__statistics admin-panel__statistics--overview"
        aria-labelledby="admin-overview-stats"
      >
        <h2 id="admin-overview-stats" className="profile-section__title">
          Operational overview
        </h2>
        <p className="hu-caption admin-panel__note">
          Metrics come from existing platform, membership, and Blog APIs. Unavailable values are
          shown as Unavailable — never invented. Subscriber analytics live under Views →
          Subscribers.
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

      <ProfileSection title="Editors">
        <AdminEditorsOverviewSummary />
      </ProfileSection>
    </div>
  );
}
