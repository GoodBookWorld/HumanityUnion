"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { BetaOnboardingChecklist } from "../../closed-beta/components/BetaOnboardingChecklist";
import { MembershipWorkspaceWidget } from "../../membership/components/MembershipWorkspaceWidget";
import { MembershipPlatformStatisticsSection } from "../../membership/components/MembershipPlatformStatisticsSection";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import {
  getPreferredLandingSection,
  setPreferredLandingSection,
} from "../workspace-preferences-store";
import {
  getWorkspaceHome,
  type WorkspaceHomeActiveWork,
  type WorkspaceHomeLinkItem,
  type WorkspaceHomeState,
} from "../workspace-home-api";

import "./workspace-home-dashboard.css";

const SECTION_IDS = [
  "section-personal-welcome",
  "section-quick-actions",
  "section-my-active-civic-work",
  "section-my-recent-activity",
  "section-my-responsibilities",
  "section-participation-summary",
  "section-workspace-notifications",
  "section-recent-public-contributions",
] as const;

function formatArea(labels: { country?: string; region?: string; community?: string }): string {
  const parts = [labels.community, labels.region, labels.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not declared";
}

function ActiveWorkCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: WorkspaceHomeLinkItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <article className="workspace-home-card">
      <h3 className="workspace-home-card__title">{title}</h3>
      <ul className="workspace-home-card__list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href}>{item.title}</Link>
            {item.status ? (
              <span className="workspace-home-card__status">{item.status}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {emptyLabel ? null : null}
    </article>
  );
}

function renderActiveWorkCards(activeWork: WorkspaceHomeActiveWork) {
  const cards = [
    <ActiveWorkCard
      key="draft-initiatives"
      title="Draft Initiatives"
      items={activeWork.draftInitiatives}
    />,
    <ActiveWorkCard
      key="open-decision-sessions"
      title="Open Decision Sessions"
      items={activeWork.openDecisionSessions}
    />,
    <ActiveWorkCard
      key="open-collective-decisions"
      title="Open Collective Decisions"
      items={activeWork.openCollectiveDecisions}
    />,
    activeWork.pendingParticipationTransition ? (
      <article key="pending-participation" className="workspace-home-card">
        <h3 className="workspace-home-card__title">Pending Participation Area transition</h3>
        <p>{formatArea(activeWork.pendingParticipationTransition.labels)}</p>
        <p className="workspace-home-card__meta">
          Effective {formatInitiativeDate(activeWork.pendingParticipationTransition.effectiveAt)}
        </p>
        <Link href="/member#participation-area">Manage Participation Area</Link>
      </article>
    ) : null,
    <ActiveWorkCard
      key="published-commitments"
      title="Published Commitments"
      items={activeWork.publishedCommitments}
    />,
    <ActiveWorkCard
      key="active-tracking"
      title="Active Tracking"
      items={activeWork.activeTracking}
    />,
    <ActiveWorkCard
      key="pending-official-responses"
      title="Pending Official Responses"
      items={activeWork.pendingOfficialResponses}
    />,
    <ActiveWorkCard
      key="active-accountability"
      title="Active Civic Accountability"
      items={activeWork.activeAccountability}
    />,
    <ActiveWorkCard key="archive-drafts" title="Archive drafts" items={activeWork.archiveDrafts} />,
  ].filter(Boolean);

  if (cards.length === 0) {
    return <p className="workspace-home-empty">No active civic work items yet.</p>;
  }

  return <div className="workspace-home-grid">{cards}</div>;
}

interface WorkspaceHomeDashboardProps {
  onLoaded?: (state: WorkspaceHomeState) => void;
}

export function WorkspaceHomeDashboard({ onLoaded }: WorkspaceHomeDashboardProps) {
  const [state, setState] = useState<WorkspaceHomeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [onLoaded]);

  useEffect(() => {
    const preferred = getPreferredLandingSection();

    if (!preferred || !SECTION_IDS.includes(preferred as (typeof SECTION_IDS)[number])) {
      return;
    }

    const element = document.getElementById(preferred);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  if (loading) {
    return <p>Loading your workspace...</p>;
  }

  if (error || !state) {
    return <p>{error ?? "Workspace home is unavailable."}</p>;
  }

  return (
    <div className="workspace-home-dashboard">
      <BetaOnboardingChecklist />

      <section className="workspace-home-section">
        <ProfileSection title="Workspace Readiness" id="section-workspace-readiness">
          <div className="workspace-readiness">
            {state.workspaceReadiness.status === "ready" ? (
              <p className="workspace-readiness__title">Workspace Ready</p>
            ) : (
              <>
                <p className="workspace-readiness__title">Missing:</p>
                <p className="workspace-readiness__missing">
                  {state.workspaceReadiness.missing.join(", ")}
                </p>
              </>
            )}
          </div>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Personal Welcome" id="section-personal-welcome">
          <div className="workspace-home-welcome">
            <HumanityAvatar
              className="workspace-home-welcome__avatar"
              avatarUrl={state.welcome.avatarUrl}
              size={64}
            />
            <div>
              <p className="workspace-home-welcome__name">{state.welcome.displayName}</p>
              <p>{formatArea(state.welcome.participationArea)}</p>
              <p>Current civic stage: {state.welcome.civicStage ?? "Not started"}</p>
              <p>Language: {state.welcome.language}</p>
              <Link href="/member">Edit Profile</Link>
            </div>
          </div>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Membership" id="section-membership">
          <MembershipWorkspaceWidget />
          <MembershipPlatformStatisticsSection
            title="Platform Membership participation"
            className="membership-workspace-widget__platform-stats"
            showUpdatedAt
          />
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Quick Actions" id="section-quick-actions">
          <div className="workspace-home-actions">
            {state.quickActions.map((action) =>
              action.available ? (
                <Link key={action.id} className="workspace-home-actions__link" href={action.href}>
                  {action.label}
                </Link>
              ) : (
                <span
                  key={action.id}
                  className="workspace-home-actions__disabled"
                  aria-disabled="true"
                  title={action.unavailableReason}
                >
                  {action.label} · {action.unavailableReason}
                </span>
              ),
            )}
          </div>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="My Active Civic Work" id="section-my-active-civic-work">
          {renderActiveWorkCards(state.activeWork)}
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="My Recent Activity" id="section-my-recent-activity">
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

      <section className="workspace-home-section">
        <ProfileSection title="My Responsibilities" id="section-my-responsibilities">
          {state.responsibilities.length === 0 ? (
            <p className="workspace-home-empty">No current responsibilities.</p>
          ) : (
            <div className="workspace-home-responsibilities">
              {state.responsibilities.map((responsibility) => (
                <article key={responsibility.id}>
                  <h3>{responsibility.label}</h3>
                  <ul>
                    {responsibility.items.map((item, index) => (
                      <li key={`${responsibility.id}-${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Participation Summary" id="section-participation-summary">
          <p>{formatArea(state.participationSummary)}</p>
          <p>Verification cohort: {state.participationSummary.verificationStatus}</p>
          {state.participationSummary.pendingTransition ? (
            <p>
              Pending transition to{" "}
              {formatArea(state.participationSummary.pendingTransition.labels)} on{" "}
              {formatInitiativeDate(state.participationSummary.pendingTransition.effectiveAt)}
            </p>
          ) : null}
          <Link href={state.participationSummary.manageHref}>Manage Participation Area</Link>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection title="Notifications" id="section-workspace-notifications">
          <p>{state.notifications.message}</p>
          <p className="workspace-home-card__meta">
            {state.notifications.registryEventCount} civic notification events registered.
          </p>
          <Link href={state.notifications.href}>Open Notification Center</Link>
        </ProfileSection>
      </section>

      <section className="workspace-home-section">
        <ProfileSection
          title="Recent Public Contributions"
          id="section-recent-public-contributions"
        >
          {state.recentPublicContributions.length === 0 ? (
            <p className="workspace-home-empty">No public contributions yet.</p>
          ) : (
            <ul className="workspace-home-card__list">
              {state.recentPublicContributions.map((contribution) => (
                <li key={contribution.id}>
                  <Link href={contribution.href}>{contribution.title}</Link>
                  <span className="workspace-home-card__status">{contribution.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </section>

      <div className="workspace-home-preferences">
        <label htmlFor="workspace-landing-section">Preferred landing section</label>
        <select
          id="workspace-landing-section"
          defaultValue={getPreferredLandingSection() ?? "section-personal-welcome"}
          onChange={(event) => setPreferredLandingSection(event.target.value)}
        >
          {SECTION_IDS.map((sectionId) => (
            <option key={sectionId} value={sectionId}>
              {sectionId.replace(/-/g, " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
