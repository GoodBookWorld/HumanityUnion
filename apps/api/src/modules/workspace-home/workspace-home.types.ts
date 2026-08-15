import type {
  CommunityWorkspaceOpportunitiesResponse,
  ParticipantStatistics,
  WorkspaceReadiness,
} from "@hu/types";

export interface WorkspaceHomeLinkItem {
  id: string;
  title: string;
  href: string;
  status?: string;
  updatedAt?: string;
}

export interface WorkspaceHomeQuickAction {
  id: string;
  label: string;
  href: string;
  available: boolean;
  unavailableReason?: string;
}

export interface WorkspaceHomeWelcome {
  displayName: string;
  avatarUrl: string;
  language: string;
  civicStage: string | null;
  participationArea: {
    country?: string;
    region?: string;
    community?: string;
    verificationStatus: string;
  };
}

export interface WorkspaceHomeActiveWork {
  draftInitiatives: WorkspaceHomeLinkItem[];
  openDecisionSessions: WorkspaceHomeLinkItem[];
  openCollectiveDecisions: WorkspaceHomeLinkItem[];
  pendingParticipationTransition: {
    effectiveAt: string;
    labels: {
      country?: string;
      region?: string;
      community?: string;
    };
  } | null;
  publishedCommitments: WorkspaceHomeLinkItem[];
  activeTracking: WorkspaceHomeLinkItem[];
  pendingOfficialResponses: WorkspaceHomeLinkItem[];
  activeAccountability: WorkspaceHomeLinkItem[];
  archiveDrafts: WorkspaceHomeLinkItem[];
}

export interface WorkspaceHomeTimelineEntry {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
  href?: string;
}

export interface WorkspaceHomeResponsibility {
  id: string;
  label: string;
  items: string[];
}

export interface WorkspaceHomeParticipationSummary {
  country?: string;
  region?: string;
  community?: string;
  verificationStatus: string;
  pendingTransition: {
    effectiveAt: string;
    labels: {
      country?: string;
      region?: string;
      community?: string;
    };
  } | null;
  manageHref: string;
}

export interface WorkspaceHomeNotificationsSummary {
  unreadCount: number;
  href: string;
  message: string;
  registryEventCount: number;
}

export interface WorkspaceHomePublicContribution {
  id: string;
  kind: "initiative" | "tracking" | "public-impact" | "archive";
  title: string;
  href: string;
  publishedAt: string;
}

export interface WorkspaceHomeAllyEntry {
  participantId: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
  sharedInitiativeCount: number;
  /**
   * Communication UX Pack 03.2 Part 4/5 — derived from the exact same
   * durable Direct Messaging read state used by the Workspace Messages
   * conversation list's `unread` field (never a second/new definition).
   * Batch-computed once per Workspace Home load, never one query per Ally.
   */
  hasUnreadMessages: boolean;
}

/**
 * Profile UX Pack 01 Part 9/11 — Workspace Allies widget data + the
 * "Allies" / "Collaborations" counts prepared for Profile UX Pack 02. See
 * `workspace-allies.service.ts` for the exact aggregation definitions.
 */
export interface WorkspaceHomeAlliesSummary {
  items: WorkspaceHomeAllyEntry[];
  /** Unique active-Ally Participants across Initiatives this Participant stewards. */
  alliesCount: number;
  /** Initiatives where this Participant is themselves an active Ally. */
  collaborationsCount: number;
}

export interface WorkspaceHomeAssistantContext {
  participantName: string;
  participationAreaLabel: string | null;
  activeWorkCount: number;
  pendingResponsibilities: number;
  unreadNotificationCount: number;
  currentSection: string;
  nextCivicStage: string | null;
  contextSummary: string;
  workspaceReadinessStatus: "ready" | "missing";
  workspaceReadinessMissing: string[];
}

export interface WorkspaceHomeState {
  welcome: WorkspaceHomeWelcome;
  /** Profile UX Pack 02 Part 1/11 — Initiatives / Collective Decisions / Allies cards. */
  statistics: ParticipantStatistics;
  quickActions: WorkspaceHomeQuickAction[];
  activeWork: WorkspaceHomeActiveWork;
  recentActivity: WorkspaceHomeTimelineEntry[];
  responsibilities: WorkspaceHomeResponsibility[];
  participationSummary: WorkspaceHomeParticipationSummary;
  notifications: WorkspaceHomeNotificationsSummary;
  recentPublicContributions: WorkspaceHomePublicContribution[];
  allies: WorkspaceHomeAlliesSummary;
  /** Community Intelligence Pack 01 — bounded collaboration opportunities. */
  communityIntelligence: CommunityWorkspaceOpportunitiesResponse;
  assistantContext: WorkspaceHomeAssistantContext;
  workspaceReadiness: WorkspaceReadiness;
  loadedAt: string;
}
