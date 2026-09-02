import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { ImplementationTrackingTraceability } from "./initiative-implementation-tracking-lifecycle.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-032 Implementation Tracking identifier (Capability 02 pipeline). */
export type InitiativeImplementationTrackingId = string;

/** Public execution journal lifecycle after a published implementation commitment. */
export type InitiativeImplementationTrackingStatus = "draft" | "active" | "completed" | "archived";

export const SUGGESTED_IMPLEMENTATION_TRACKING_STAGES = [
  "Preparation",
  "Started",
  "In Progress",
  "Verification",
  "Completed",
] as const;

export type SuggestedImplementationTrackingStage =
  (typeof SUGGESTED_IMPLEMENTATION_TRACKING_STAGES)[number];

/**
 * Domain-invariant candidate stage tokens (English storage values).
 * Prefer predicates over inline string comparisons at call sites.
 */
export const IMPLEMENTATION_TRACKING_CANDIDATE_STAGE = {
  PREPARATION: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[0],
  STARTED: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[1],
  IN_PROGRESS: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[2],
  VERIFICATION: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[3],
  COMPLETED: SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[4],
} as const;

export function isImplementationTrackingCandidatePreparation(status: string): boolean {
  return status === IMPLEMENTATION_TRACKING_CANDIDATE_STAGE.PREPARATION;
}

export function isImplementationTrackingCandidateCompleted(status: string): boolean {
  return status === IMPLEMENTATION_TRACKING_CANDIDATE_STAGE.COMPLETED;
}

export const INITIATIVE_IMPLEMENTATION_TRACKING_TRANSITIONS: Record<
  InitiativeImplementationTrackingStatus,
  readonly InitiativeImplementationTrackingStatus[]
> = {
  draft: ["active", "archived"],
  active: ["completed", "archived"],
  completed: [],
  archived: [],
};

export function canTransitionInitiativeImplementationTracking(
  from: InitiativeImplementationTrackingStatus,
  to: InitiativeImplementationTrackingStatus,
): boolean {
  return INITIATIVE_IMPLEMENTATION_TRACKING_TRANSITIONS[from].includes(to);
}

export function isInitiativeImplementationTrackingTerminal(
  status: InitiativeImplementationTrackingStatus,
): boolean {
  return status === "completed" || status === "archived";
}

/** TASK-032 immutable execution journal entry. */
export type ImplementationTrackingUpdateId = string;

export interface ImplementationTrackingUpdate {
  updateId: ImplementationTrackingUpdateId;
  trackingId: InitiativeImplementationTrackingId;
  title: string;
  summary: string;
  evidence: string;
  references: string[];
  authorId: MemberId;
  createdAt: string;
}

/** TASK-032 Implementation Tracking aggregate root. */
export interface InitiativeImplementationTracking {
  trackingId: InitiativeImplementationTrackingId;
  /** Empty string when Tracking was published without an Accepted Commitment. */
  commitmentId: InitiativeImplementationCommitmentId | "";
  initiativeId: InitiativeId;
  participantId: MemberId;
  status: InitiativeImplementationTrackingStatus;
  currentStage: string;
  summary: string;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  /**
   * Initiative Lifecycle — Part J. Package grouping Tracking Records
   * published together from the Author Workspace.
   */
  packageId?: string | null;
  /** Progress percentage 0–100 (Part J continuous tracking). */
  progress?: number | null;
  targetDate?: string | null;
  startedDate?: string | null;
  actualCompletedDate?: string | null;
  dependencies?: string[] | null;
  obstacles?: string[] | null;
  evidenceReferences?: string[] | null;
  notes?: string | null;
  approvedAction?: string | null;
  /** Permanent provenance for "which Commitment produced this Tracking Record?". */
  traceability?: ImplementationTrackingTraceability | null;
  createdAt: string;
  updatedAt: string;
}
