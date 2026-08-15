import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeImplementationTrackingId,
  InitiativeImplementationTrackingStatus,
} from "./initiative-implementation-tracking.js";
import type { ImplementationTrackingTraceability } from "./initiative-implementation-tracking-lifecycle.js";

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
  /** Initiative Lifecycle — Part J. */
  packageId: string | null;
  progress: number | null;
  targetDate: string | null;
  startedDate: string | null;
  actualCompletedDate: string | null;
  dependencies: readonly string[];
  obstacles: readonly string[];
  evidenceReferences: readonly string[];
  notes: string | null;
  approvedAction: string | null;
  traceability: ImplementationTrackingTraceability | null;
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
  packageId: string | null;
  progress: number | null;
  approvedAction: string | null;
}

export interface InitiativeImplementationTrackingMetrics {
  trackingCount: number;
  activeTrackingCount: number;
  completedTrackingCount: number;
  averageUpdatesPerTracking: number;
  averageCompletionTimeMs: number | null;
}
