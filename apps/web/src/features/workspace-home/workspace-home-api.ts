import { apiRequest } from "../../lib/api-client";

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
  quickActions: WorkspaceHomeQuickAction[];
  activeWork: WorkspaceHomeActiveWork;
  recentActivity: WorkspaceHomeTimelineEntry[];
  responsibilities: WorkspaceHomeResponsibility[];
  participationSummary: WorkspaceHomeParticipationSummary;
  notifications: WorkspaceHomeNotificationsSummary;
  recentPublicContributions: WorkspaceHomePublicContribution[];
  assistantContext: WorkspaceHomeAssistantContext;
  workspaceReadiness: {
    status: "ready" | "missing";
    missing: string[];
  };
  loadedAt: string;
}

export async function getWorkspaceHome(): Promise<WorkspaceHomeState> {
  return apiRequest<WorkspaceHomeState>("/api/v1/workspace/home");
}
