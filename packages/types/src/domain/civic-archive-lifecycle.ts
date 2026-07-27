import type { CivicEntityType } from "./capability02-integration.js";

/** Honest documented outcome for an archived initiative lifecycle. */
export type CivicArchiveOutcomeStatus =
  | "completed"
  | "partially_implemented"
  | "concluded_without_implementation"
  | "cancelled"
  | "superseded";

export const CIVIC_ARCHIVE_OUTCOME_STATUS_LABELS: Record<CivicArchiveOutcomeStatus, string> = {
  completed: "Completed",
  partially_implemented: "Partially implemented",
  concluded_without_implementation: "Concluded without implementation",
  cancelled: "Cancelled",
  superseded: "Superseded",
};

export interface CivicArchiveEvidenceLink {
  title: string;
  url: string;
}

export interface CivicArchiveLifecycleChildRecord {
  entityType: CivicEntityType | "petition";
  entityId: string;
  title: string;
  summary: string;
  publicUrl: string;
  status: string;
  updatedAt: string;
}

export interface CivicArchiveLifecycleStage {
  stageId: string;
  label: string;
  records: CivicArchiveLifecycleChildRecord[];
}

/** One archived initiative and its documented public lifecycle outcome. */
export interface CivicArchiveLifecycleRecord {
  initiativeId: string;
  archiveRecordId: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  startedAt: string;
  completedAt?: string;
  archivedAt: string;
  outcomeStatus: CivicArchiveOutcomeStatus;
  outcomeStatusLabel: string;
  finalOutcomeSummary: string;
  decisionSummary: string;
  implementationSummary: string;
  publicImpactSummary: string;
  officialResponseSummaries: string[];
  stageCounts: Record<string, number>;
  lifecycleStageSummary: string;
  evidenceLinks: CivicArchiveEvidenceLink[];
  imageUrl?: string;
  stages: CivicArchiveLifecycleStage[];
}

export interface CivicArchiveLifecycleIndexResponse {
  records: CivicArchiveLifecycleRecord[];
  total: number;
  metrics: CivicArchiveLifecycleMetrics;
}

export interface CivicArchiveLifecycleMetrics {
  archivedInitiativeCount: number;
  archiveRecordCount: number;
  countriesRepresented: number;
  regionsRepresented: number;
  communitiesRepresented: number;
  activityAreasRepresented: number;
  verifiedImpactCount: number;
}
