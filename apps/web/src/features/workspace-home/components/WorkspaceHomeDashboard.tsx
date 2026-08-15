"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { BetaOnboardingChecklist } from "../../closed-beta/components/BetaOnboardingChecklist";
import { PersonalStatisticsCards } from "../../personal-statistics/components/PersonalStatisticsCards";
import { MembershipWorkspaceWidget } from "../../membership/components/MembershipWorkspaceWidget";
import { MembershipPlatformStatisticsSection } from "../../membership/components/MembershipPlatformStatisticsSection";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { CollaborationOpportunitiesWidget } from "../../community-intelligence/components/CollaborationOpportunitiesWidget";
import { PwaStandaloneInitiativeFeed } from "../../pwa/components/PwaStandaloneInitiativeFeed";
import { getWorkspaceHome, type WorkspaceHomeState } from "../workspace-home-api";
import { AlliesWidget } from "./AlliesWidget";
import { WorkspaceWelcomeBanner } from "./WorkspaceWelcomeBanner";

import "./workspace-home-dashboard.css";

/**
 * UX Evolution Pack 01 — Workspace Home Visual Correction.
 * Profile UX Pack 02 Part 1 — added the "Personal statistics" section
 * directly below Welcome.
 *
 * The central column now renders exactly six sections, in this fixed
 * order: Welcome banner, Personal statistics, Quick Actions, Allies,
 * Membership, My Recent Activity. "Participation Summary", "Notifications",
 * and "Recent Public Contributions" were removed from this page only — their backend data
 * (`WorkspaceHomeState.participationSummary` / `.notifications` /
 * `.recentPublicContributions`), routes, and dedicated pages
 * (`/preferences`, `/notifications`, etc.) are untouched. The "Preferred
 * landing section" control (and all of its state, storage, and
 * scroll-into-view/focus behavior) has been removed entirely — see
 * `workspace-preferences-store.ts`, which no longer exports any
 * landing-section functions (confirmed unused anywhere else before
 * removal). The page now simply renders top-to-bottom with normal browser
 * scrolling and no section-anchor IDs, since nothing links to them anymore.
 */
interface WorkspaceHomeDashboardProps {
  onLoaded?: (state: WorkspaceHomeState) => void;
}

export function WorkspaceHomeDashboard({ onLoaded }: WorkspaceHomeDashboardProps) {
  const authStatus = useClientAuthStatus();
  const [state, setState] = useState<WorkspaceHomeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setState(null);
      setError(null);
      setLoading(authStatus === "pending");
      return;
    }

    let cancelled = false;

    async function loadWorkspaceHome() {
      try {
        const loaded = await getWorkspaceHome();

        if (!cancelled) {
          setState(loaded);
          setError(null);
          onLoaded?.(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load workspace home.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaceHome();

    function handleProfileUpdated() {
      void loadWorkspaceHome();
    }

    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [authStatus, onLoaded]);

  if (loading) {
    return <p>Loading your workspace...</p>;
  }

  if (error || !state) {
    return <p>{error ?? "Workspace home is unavailable."}</p>;
  }

  return (
    <div className="workspace-home-dashboard">
      <BetaOnboardingChecklist />

      <section className="workspace-home-section" aria-label="Workspace welcome">
        <WorkspaceWelcomeBanner workspaceReadiness={state.workspaceReadiness} />
      </section>

      <PwaStandaloneInitiativeFeed />

      <section className="workspace-home-section" aria-label="Personal statistics">
        <PersonalStatisticsCards statistics={state.statistics} />
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Quick Actions">
          <div className="workspace-home-actions">
            {state.quickActions.map((action) =>
              action.available ? (
                <Link key={action.id} className="workspace-home-actions__link" href={action.href}>
                  <span className="workspace-home-actions__label">{action.label}</span>
                </Link>
              ) : (
                <span
                  key={action.id}
                  className="workspace-home-actions__disabled"
                  aria-disabled="true"
                  title={action.unavailableReason}
                >
                  <span className="workspace-home-actions__label">{action.label}</span>
                  {action.unavailableReason ? (
                    <span className="workspace-home-actions__reason">
                      {action.unavailableReason}
                    </span>
                  ) : null}
                </span>
              ),
            )}
          </div>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Allies">
          <AlliesWidget allies={state.allies.items} />
        </ProfileSection>
      </section>

      <section
        className="workspace-home-section"
        aria-label="Collaboration Opportunities"
      >
        <CollaborationOpportunitiesWidget
          items={state.communityIntelligence?.items ?? []}
          emptyMessage={
            state.communityIntelligence?.emptyMessage ??
            "No collaboration opportunities are available yet."
          }
        />
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Membership">
          <MembershipWorkspaceWidget />
          <MembershipPlatformStatisticsSection
            title="Platform Membership participation"
            className="membership-workspace-widget__platform-stats"
            showUpdatedAt
          />
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="My Recent Activity">
          {state.recentActivity.length === 0 ? (
            <p className="workspace-home-empty">No recent activity yet.</p>
          ) : (
            <ul className="workspace-home-timeline">
              {state.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <p className="workspace-home-timeline__date">
                    {formatInitiativeDate(entry.occurredAt)}
                  </p>
                  <p className="workspace-home-timeline__label">{entry.label}</p>
                  <p>{entry.detail}</p>
                  {entry.href ? <Link href={entry.href}>Open record</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </section>
    </div>
  );
}
