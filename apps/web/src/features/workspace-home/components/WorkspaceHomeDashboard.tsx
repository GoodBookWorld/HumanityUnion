"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
import {
  resolveWorkspaceActivityEventLabel,
  resolveWorkspaceQuickActionLabel,
} from "../workspace-home-i18n";
import { AlliesWidget } from "./AlliesWidget";
import { WorkspaceWelcomeBanner } from "./WorkspaceWelcomeBanner";

import "./workspace-home-dashboard.css";

interface WorkspaceHomeDashboardProps {
  onLoaded?: (state: WorkspaceHomeState) => void;
}

export function WorkspaceHomeDashboard({ onLoaded }: WorkspaceHomeDashboardProps) {
  const t = useTranslations("workspace");
  const tCivic = useTranslations("civicActivity");
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
            loadError instanceof Error ? loadError.message : t("home.loadError"),
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
  }, [authStatus, onLoaded, t]);

  if (loading) {
    return <p>{t("home.loading")}</p>;
  }

  if (error || !state) {
    return <p>{error ?? t("home.unavailable")}</p>;
  }

  return (
    <div className="workspace-home-dashboard">
      <BetaOnboardingChecklist />

      <section className="workspace-home-section" aria-label={t("home.welcomeAria")}>
        <WorkspaceWelcomeBanner workspaceReadiness={state.workspaceReadiness} />
      </section>

      <PwaStandaloneInitiativeFeed />

      <section
        className="workspace-home-section"
        aria-label={t("home.personalStatisticsAria")}
      >
        <PersonalStatisticsCards statistics={state.statistics} />
      </section>

      <section className="workspace-home-section">
        <ProfileSection title={t("home.quickActionsTitle")}>
          <div className="workspace-home-actions">
            {state.quickActions.map((action) => {
              const label = resolveWorkspaceQuickActionLabel(t, action.id);
              return action.available ? (
                <Link key={action.id} className="workspace-home-actions__link" href={action.href}>
                  <span className="workspace-home-actions__label">{label}</span>
                </Link>
              ) : (
                <span
                  key={action.id}
                  className="workspace-home-actions__disabled"
                  aria-disabled="true"
                  title={action.unavailableReason}
                >
                  <span className="workspace-home-actions__label">{label}</span>
                  {action.unavailableReason ? (
                    <span className="workspace-home-actions__reason">
                      {action.unavailableReason}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title={t("home.alliesTitle")}>
          <AlliesWidget allies={state.allies.items} />
        </ProfileSection>
      </section>

      <section
        className="workspace-home-section"
        aria-label={t("home.collaborationOpportunitiesAria")}
      >
        <CollaborationOpportunitiesWidget
          items={state.communityIntelligence?.items ?? []}
          emptyMessage={t("home.ciEmpty")}
        />
      </section>

      <section className="workspace-home-section">
        <ProfileSection title={t("home.membershipTitle")}>
          <MembershipWorkspaceWidget />
          <MembershipPlatformStatisticsSection
            title={t("home.platformMembershipStats")}
            className="membership-workspace-widget__platform-stats"
            showUpdatedAt
          />
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title={t("home.recentActivityTitle")}>
          {state.recentActivity.length === 0 ? (
            <p className="workspace-home-empty">{t("home.noRecentActivity")}</p>
          ) : (
            <ul className="workspace-home-timeline">
              {state.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <p className="workspace-home-timeline__date">
                    {formatInitiativeDate(entry.occurredAt)}
                  </p>
                  <p className="workspace-home-timeline__label">
                    {resolveWorkspaceActivityEventLabel(t, tCivic, entry.label)}
                  </p>
                  <p>{entry.detail}</p>
                  {entry.href ? <Link href={entry.href}>{t("home.openRecord")}</Link> : null}
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </section>
    </div>
  );
}
