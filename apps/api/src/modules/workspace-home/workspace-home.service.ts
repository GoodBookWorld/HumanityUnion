import { CIVIC_NOTIFICATION_EVENT_REGISTRY } from "@hu/types";

import { listMyCivicAccountabilities } from "../civic-accountability/civic-accountability.service.js";
import { listMyDecisionSessions } from "../decision-session/decision-session.service.js";
import { listMyInitiativeCollaborativeAnalyses } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.service.js";
import { listMyInitiativeCollectiveDecisions } from "../initiative-collective-decision/initiative-collective-decision.service.js";
import { listUnreadDirectMessageSenderParticipantIds } from "../direct-messaging/index.js";
import {
  countActiveCollaborationsForParticipant,
  listWorkspaceAlliesForParticipant,
} from "../initiative-discussion-collaboration/index.js";
import { listMyInitiativeImplementationCommitments } from "../initiative-implementation-commitment/initiative-implementation-commitment.service.js";
import { listMyInitiativeImplementationTrackings } from "../initiative-implementation-tracking/initiative-implementation-tracking.service.js";
import { listMyInitiativeImprovementProposals } from "../initiative-improvement-proposal/initiative-improvement-proposal.service.js";
import { listMyInitiativePublicImpacts } from "../initiative-public-impact/initiative-public-impact.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { listMyInitiatives } from "../initiatives/initiative.service.js";
import {
  getOrCreateMemberProfileForUser,
  getWorkspaceMemberIdentityForUser,
} from "../member-profile/member-profile.service.js";
import { listMyOfficialResponses } from "../official-response/official-response.service.js";
import { getParticipantStatistics } from "../participant-statistics/participant-statistics.service.js";
import { loadParticipationAreaWorkspaceForParticipant } from "../participation-area/participation-area.service.js";
import { listMyPublicCivicArchiveRecords } from "../public-civic-archive/public-civic-archive.service.js";
import { countUnreadNotifications } from "../notifications/notification.service.js";
import {
  formatWorkspaceReadinessSummary,
  resolveWorkspaceReadinessForUser,
} from "../closed-beta/closed-beta.service.js";
import { buildWorkspaceCommunityOpportunities } from "../community-intelligence/index.js";
import { buildWorkspaceHomeTimeline } from "./workspace-home-timeline.js";
import type {
  WorkspaceHomeAlliesSummary,
  WorkspaceHomeAssistantContext,
  WorkspaceHomeLinkItem,
  WorkspaceHomePublicContribution,
  WorkspaceHomeQuickAction,
  WorkspaceHomeResponsibility,
  WorkspaceHomeState,
} from "./workspace-home.types.js";

function formatParticipationLabel(input: {
  country?: string;
  region?: string;
  community?: string;
}): string | null {
  const parts = [input.community, input.region, input.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function resolveCivicStage(initiatives: ReturnType<typeof listMyInitiatives>): string | null {
  const active = initiatives.find(
    (initiative) =>
      initiative.lifecyclePhase === "draft" || initiative.lifecyclePhase === "published",
  );

  if (!active) {
    return initiatives.length > 0 ? "Review archived initiatives" : "Begin civic participation";
  }

  return active.lifecyclePhase === "draft"
    ? "Draft initiative in progress"
    : "Published initiative active";
}

/**
 * UX Evolution Pack 01 — Quick Actions Finalization.
 *
 * "Notification Center" was removed (previously id: "notification-center",
 * href: "/notifications") — it duplicated the notification bell and the
 * Settings → Notifications sidebar link. The `/notifications` route, its
 * API, and its data are untouched; this list simply no longer links to it
 * a second time from here.
 */
function buildQuickActions(): WorkspaceHomeQuickAction[] {
  return [
    {
      id: "continue-draft-initiative",
      label: "Continue Draft Initiative",
      href: "/initiatives",
      available: true,
    },
    {
      id: "continue-analysis",
      label: "Continue Analysis",
      href: "/initiatives",
      available: true,
    },
    {
      id: "continue-proposal",
      label: "Continue Proposal",
      href: "/initiatives",
      available: true,
    },
    {
      id: "continue-revision",
      label: "Continue Revision",
      href: "/initiatives",
      available: true,
    },
    {
      id: "open-initiatives",
      label: "Open My Initiatives",
      href: "/initiatives",
      available: true,
    },
    {
      id: "participation-area",
      label: "Participation Area",
      href: "/member#participation-area",
      available: true,
    },
    {
      id: "search-civic-records",
      label: "Search civic records",
      href: "/search",
      available: true,
    },
    {
      id: "civic-activity",
      label: "View Civic Activity",
      href: "/civic-activity",
      available: true,
    },
    {
      id: "create-initiative",
      label: "Create New Initiative",
      href: "/initiatives",
      available: true,
    },
  ];
}

function buildResponsibilities(input: {
  identity: RequestIdentity;
  initiatives: ReturnType<typeof listMyInitiatives>;
  analyses: ReturnType<typeof listMyInitiativeCollaborativeAnalyses>;
  proposals: ReturnType<typeof listMyInitiativeImprovementProposals>;
  trackings: ReturnType<typeof listMyInitiativeImplementationTrackings>;
  accountabilities: ReturnType<typeof listMyCivicAccountabilities>;
}): WorkspaceHomeResponsibility[] {
  const responsibilities: WorkspaceHomeResponsibility[] = [];

  const stewardInitiatives = input.initiatives.filter(
    (initiative) => initiative.stewardId === input.identity.participantId,
  );

  if (stewardInitiatives.length > 0) {
    responsibilities.push({
      id: "steward",
      label: "You are steward of",
      items: stewardInitiatives.slice(0, 5).map((initiative) => initiative.title),
    });
  }

  const authoredAnalyses = input.analyses.filter(
    (analysis) => analysis.authorId === input.identity.participantId && analysis.status === "draft",
  );

  if (authoredAnalyses.length > 0) {
    responsibilities.push({
      id: "author-analyses",
      label: "You are author of draft analyses",
      items: authoredAnalyses.slice(0, 5).map((analysis) => analysis.title),
    });
  }

  const authoredProposals = input.proposals.filter(
    (proposal) => proposal.authorId === input.identity.participantId && proposal.status === "draft",
  );

  if (authoredProposals.length > 0) {
    responsibilities.push({
      id: "author-proposals",
      label: "You are author of draft proposals",
      items: authoredProposals.slice(0, 5).map((proposal) => proposal.targetSection),
    });
  }

  const pendingTracking = input.trackings.filter((tracking) => tracking.status === "active");

  if (pendingTracking.length > 0) {
    responsibilities.push({
      id: "implementation-tracking",
      label: "You have pending implementation tracking",
      items: pendingTracking.slice(0, 5).map((tracking) => tracking.summary),
    });
  }

  const activeAccountability = input.accountabilities.filter(
    (accountability) => accountability.status === "active",
  );

  if (activeAccountability.length > 0) {
    responsibilities.push({
      id: "accountability",
      label: "You have accountability records requiring attention",
      items: activeAccountability
        .slice(0, 5)
        .map((accountability) => accountability.accountabilityId),
    });
  }

  return responsibilities;
}

function buildRecentPublicContributions(input: {
  initiatives: ReturnType<typeof listMyInitiatives>;
  trackings: ReturnType<typeof listMyInitiativeImplementationTrackings>;
  impacts: ReturnType<typeof listMyInitiativePublicImpacts>;
  archives: ReturnType<typeof listMyPublicCivicArchiveRecords>;
}): WorkspaceHomePublicContribution[] {
  const contributions: WorkspaceHomePublicContribution[] = [];

  for (const initiative of input.initiatives) {
    if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
      continue;
    }

    const publishedEvent = initiative.timeline.find(
      (event) => event.eventType === "initiative_published",
    );

    contributions.push({
      id: initiative.initiativeId,
      kind: "initiative",
      title: initiative.title,
      href: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`,
      publishedAt: publishedEvent?.timestamp ?? initiative.updatedAt,
    });
  }

  for (const tracking of input.trackings) {
    if (tracking.status !== "active" && tracking.status !== "completed") {
      continue;
    }

    contributions.push({
      id: tracking.trackingId,
      kind: "tracking",
      title: tracking.summary,
      href: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      publishedAt: tracking.activatedAt ?? tracking.updatedAt,
    });
  }

  for (const impact of input.impacts) {
    if (!impact.publishedAt) {
      continue;
    }

    contributions.push({
      id: impact.impactId,
      kind: "public-impact",
      title: impact.title,
      href: `/public-impact/${encodeURIComponent(impact.impactId)}`,
      publishedAt: impact.publishedAt,
    });
  }

  for (const archive of input.archives) {
    if (archive.status !== "published" || !archive.archivedAt) {
      continue;
    }

    contributions.push({
      id: archive.archiveRecordId,
      kind: "archive",
      title: archive.title,
      href: `/civic-archive/${encodeURIComponent(archive.initiativeId)}`,
      publishedAt: archive.archivedAt,
    });
  }

  return contributions
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 5);
}

/**
 * Communication UX Pack 03.3.1 Part 4/11 — injectable so the Workspace
 * Messages "Active Allies" panel (`workspace-home.routes.ts`
 * `GET /home/allies`) and this module's own full `GET /home` payload call
 * through the exact same aggregation, and so both can be call-count tested
 * without Mongo (no duplicate service/projection/query).
 */
export interface AlliesSummaryDependencies {
  listWorkspaceAlliesForParticipant: typeof listWorkspaceAlliesForParticipant;
  countActiveCollaborationsForParticipant: typeof countActiveCollaborationsForParticipant;
  listUnreadDirectMessageSenderParticipantIds: typeof listUnreadDirectMessageSenderParticipantIds;
}

const defaultAlliesSummaryDependencies: AlliesSummaryDependencies = {
  listWorkspaceAlliesForParticipant,
  countActiveCollaborationsForParticipant,
  listUnreadDirectMessageSenderParticipantIds,
};

/**
 * Profile UX Pack 01 Part 9/11 — see `workspace-allies.service.ts` for the
 * exact "Allies" / "Collaborations" definitions this projects.
 *
 * Communication UX Pack 03.2 Part 4/5 — `hasUnreadMessages` is resolved
 * with exactly one additional batch query
 * (`listUnreadDirectMessageSenderParticipantIds`), never one Direct
 * Messaging lookup per Ally card, so this stays a single bounded Workspace
 * response regardless of how many Allies are displayed.
 *
 * Communication UX Pack 03.3.1 Part 4 — exported (with injectable deps) so
 * the Workspace Messages "Active Allies" panel can reuse this exact
 * aggregation through its own small route instead of loading the entire
 * `WorkspaceHomeState` (which would run every unrelated Workspace Home
 * query — initiatives, decision sessions, statistics, etc. — just to reach
 * this one field).
 */
export async function buildAlliesSummary(
  participantId: string,
  deps: AlliesSummaryDependencies = defaultAlliesSummaryDependencies,
): Promise<WorkspaceHomeAlliesSummary> {
  const [allies, collaborationsCount, unreadSenderIds] = await Promise.all([
    deps.listWorkspaceAlliesForParticipant(participantId),
    deps.countActiveCollaborationsForParticipant(participantId),
    deps.listUnreadDirectMessageSenderParticipantIds(participantId),
  ]);

  return {
    items: allies.map((ally) => ({
      participantId: ally.participantId,
      displayName: ally.author.displayName,
      avatarUrl: ally.author.avatarUrl,
      profileUrl: ally.author.profileUrl,
      sharedInitiativeCount: ally.sharedInitiativeCount,
      hasUnreadMessages: unreadSenderIds.has(ally.participantId),
    })),
    alliesCount: allies.length,
    collaborationsCount,
  };
}

function countActiveWork(activeWork: WorkspaceHomeState["activeWork"]): number {
  return [
    activeWork.draftInitiatives,
    activeWork.openDecisionSessions,
    activeWork.openCollectiveDecisions,
    activeWork.publishedCommitments,
    activeWork.activeTracking,
    activeWork.pendingOfficialResponses,
    activeWork.activeAccountability,
    activeWork.archiveDrafts,
    activeWork.pendingParticipationTransition ? [activeWork.pendingParticipationTransition] : [],
  ].reduce((total, items) => total + items.length, 0);
}

function toLinkItem(input: {
  id: string;
  title: string;
  href: string;
  status?: string;
  updatedAt?: string;
}): WorkspaceHomeLinkItem {
  return input;
}

export async function getWorkspaceHomeForParticipant(input: {
  identity: RequestIdentity;
  userId: string;
  displayName: string;
}): Promise<WorkspaceHomeState> {
  const profile = await getOrCreateMemberProfileForUser({
    userId: input.userId,
    displayName: input.displayName,
  });
  const identity = await getWorkspaceMemberIdentityForUser(input.userId);
  const participation = await loadParticipationAreaWorkspaceForParticipant({
    participantId: input.identity.participantId,
    userId: input.userId,
  });

  const initiatives = listMyInitiatives(input.identity);
  const analyses = listMyInitiativeCollaborativeAnalyses(input.identity);
  const proposals = listMyInitiativeImprovementProposals(input.identity);
  const decisionSessions = listMyDecisionSessions(input.identity);
  const collectiveDecisions = listMyInitiativeCollectiveDecisions(input.identity);
  const commitments = listMyInitiativeImplementationCommitments(input.identity);
  const trackings = listMyInitiativeImplementationTrackings(input.identity);
  const impacts = listMyInitiativePublicImpacts(input.identity);
  const archives = listMyPublicCivicArchiveRecords(input.identity);
  const officialResponses = listMyOfficialResponses(input.identity);
  const accountabilities = listMyCivicAccountabilities(input.identity);
  const unreadNotificationCount = await countUnreadNotifications(input.userId);
  const allies = await buildAlliesSummary(input.identity.participantId);
  const statistics = await getParticipantStatistics(input.identity.participantId);
  const communityIntelligence = await buildWorkspaceCommunityOpportunities({
    participantId: input.identity.participantId,
    memberId: input.identity.participantId,
  });

  const activeWork = {
    draftInitiatives: initiatives
      .filter((initiative) => initiative.lifecyclePhase === "draft")
      .slice(0, 8)
      .map((initiative) =>
        toLinkItem({
          id: initiative.initiativeId,
          title: initiative.title,
          href: "/initiatives",
          status: initiative.lifecyclePhase,
          updatedAt: initiative.updatedAt,
        }),
      ),
    openDecisionSessions: decisionSessions
      .filter((session) => session.status === "published")
      .slice(0, 8)
      .map((session) =>
        toLinkItem({
          id: session.sessionId,
          title: session.title,
          href: `/decision-sessions/public/${encodeURIComponent(session.sessionId)}`,
          status: session.status,
          updatedAt: session.updatedAt,
        }),
      ),
    openCollectiveDecisions: collectiveDecisions
      .filter((decision) => decision.status === "opened")
      .slice(0, 8)
      .map((decision) =>
        toLinkItem({
          id: decision.decisionId,
          title: decision.question,
          href: `/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`,
          status: decision.status,
          updatedAt: decision.updatedAt,
        }),
      ),
    pendingParticipationTransition: participation.pendingTransition
      ? {
          effectiveAt: participation.pendingTransition.effectiveAt,
          labels: participation.pendingLabels ?? {},
        }
      : null,
    publishedCommitments: commitments
      .filter((commitment) => commitment.status === "published")
      .slice(0, 8)
      .map((commitment) =>
        toLinkItem({
          id: commitment.commitmentId,
          title: commitment.commitmentTitle,
          href: `/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`,
          status: commitment.status,
          updatedAt: commitment.updatedAt,
        }),
      ),
    activeTracking: trackings
      .filter((tracking) => tracking.status === "active")
      .slice(0, 8)
      .map((tracking) =>
        toLinkItem({
          id: tracking.trackingId,
          title: tracking.summary,
          href: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
          status: tracking.status,
          updatedAt: tracking.updatedAt,
        }),
      ),
    pendingOfficialResponses: officialResponses
      .filter((response) => response.publicationStatus === "draft")
      .slice(0, 8)
      .map((response) =>
        toLinkItem({
          id: response.responseId,
          title: response.subject,
          href: "/initiatives",
          status: response.publicationStatus,
          updatedAt: response.updatedAt,
        }),
      ),
    activeAccountability: accountabilities
      .filter((accountability) => accountability.status === "active")
      .slice(0, 8)
      .map((accountability) =>
        toLinkItem({
          id: accountability.accountabilityId,
          title: `Accountability ${accountability.accountabilityId.slice(0, 8)}`,
          href: `/initiatives`,
          status: accountability.status,
          updatedAt: accountability.updatedAt,
        }),
      ),
    archiveDrafts: archives
      .filter((archive) => archive.status === "draft")
      .slice(0, 8)
      .map((archive) =>
        toLinkItem({
          id: archive.archiveRecordId,
          title: archive.title,
          href: `/initiatives`,
          status: archive.status,
          updatedAt: archive.updatedAt,
        }),
      ),
  };

  const responsibilities = buildResponsibilities({
    identity: input.identity,
    initiatives,
    analyses,
    proposals,
    trackings,
    accountabilities,
  });

  const recentActivity = buildWorkspaceHomeTimeline({
    initiatives,
    analyses,
    proposals,
    decisionSessions,
    commitments,
    trackings,
    impacts,
  });

  const participationArea = {
    country: participation.labels.country ?? identity.country,
    region: participation.labels.region ?? identity.region,
    community: participation.labels.community ?? identity.community,
    verificationStatus: participation.activeArea?.verificationStatus ?? "unverified",
  };

  const workspaceReadiness = await resolveWorkspaceReadinessForUser({
    userId: input.userId,
    identity: input.identity,
    displayName: profile.displayName,
  });

  const readinessSummary = formatWorkspaceReadinessSummary(workspaceReadiness);

  const assistantContext: WorkspaceHomeAssistantContext = {
    participantName: profile.displayName,
    participationAreaLabel: formatParticipationLabel(participationArea),
    activeWorkCount: countActiveWork(activeWork),
    pendingResponsibilities: responsibilities.length,
    unreadNotificationCount,
    currentSection: "Workspace Home",
    nextCivicStage: resolveCivicStage(initiatives),
    workspaceReadinessStatus: workspaceReadiness.status,
    workspaceReadinessMissing: workspaceReadiness.missing,
    contextSummary: `Welcome back, ${profile.displayName}. ${readinessSummary}. Your workspace summarizes ${countActiveWork(activeWork)} active civic work items, ${responsibilities.length} current responsibilities, and ${unreadNotificationCount} unread notifications.`,
  };

  return {
    welcome: {
      displayName: profile.displayName,
      avatarUrl: identity.avatarUrl,
      language: profile.language,
      civicStage: resolveCivicStage(initiatives),
      participationArea,
    },
    statistics,
    quickActions: buildQuickActions(),
    activeWork,
    recentActivity,
    responsibilities,
    participationSummary: {
      country: participationArea.country,
      region: participationArea.region,
      community: participationArea.community,
      verificationStatus: participationArea.verificationStatus,
      pendingTransition: activeWork.pendingParticipationTransition,
      manageHref: "/member#participation-area",
    },
    notifications: {
      unreadCount: unreadNotificationCount,
      href: "/notifications",
      message:
        unreadNotificationCount > 0
          ? `${unreadNotificationCount} unread civic notification${unreadNotificationCount === 1 ? "" : "s"}.`
          : "No unread civic notifications.",
      registryEventCount: CIVIC_NOTIFICATION_EVENT_REGISTRY.length,
    },
    recentPublicContributions: buildRecentPublicContributions({
      initiatives,
      trackings,
      impacts,
      archives,
    }),
    allies,
    communityIntelligence,
    assistantContext,
    workspaceReadiness,
    loadedAt: new Date().toISOString(),
  };
}
