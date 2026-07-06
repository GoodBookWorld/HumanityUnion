import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
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
  commitmentId: InitiativeImplementationCommitmentId;
  initiativeId: InitiativeId;
  participantId: MemberId;
  status: InitiativeImplementationTrackingStatus;
  currentStage: string;
  summary: string;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
