import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeImplementationTrackingId,
  InitiativeImplementationTrackingStatus,
} from "./initiative-implementation-tracking.js";

export interface PublicImplementationTrackingUpdate {
  updateId: string;
  title: string;
  summary: string;
  evidence: string;
  references: string[];
  createdAt: string;
  authorDisplayName: string;
}

export interface PublicInitiativeImplementationTrackingProjection {
  trackingId: InitiativeImplementationTrackingId;
  commitmentId: InitiativeImplementationCommitmentId;
  initiativeId: InitiativeId;
  status: Exclude<InitiativeImplementationTrackingStatus, "draft">;
  currentStage: string;
  summary: string;
  authorDisplayName: string;
  executionHistory: PublicImplementationTrackingUpdate[];
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicInitiativeImplementationTrackingListItem {
  trackingId: InitiativeImplementationTrackingId;
  commitmentId: InitiativeImplementationCommitmentId;
  status: Exclude<InitiativeImplementationTrackingStatus, "draft">;
  currentStage: string;
  summary: string;
  authorDisplayName: string;
  updateCount: number;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface InitiativeImplementationTrackingMetrics {
  trackingCount: number;
  activeTrackingCount: number;
  completedTrackingCount: number;
  averageUpdatesPerTracking: number;
  averageCompletionTimeMs: number | null;
}
