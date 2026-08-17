/**
 * Initiative Lifecycle Finalization Phase 05 —
 * Collective Participation Journey (participant-facing projection).
 *
 * Read model over canonical domains + Participant Action ledger.
 * Not a civic root, not a second ledger, not a lifecycle engine.
 */

import type { InitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";
import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/**
 * User-facing civic participation vocabulary (meaningful actions, not every click).
 * Views / navigation / preview are NOT members.
 */
export const COLLECTIVE_PARTICIPATION_ACTION_TYPES = [
  "support_initiative",
  "discussion_comment",
  "petition_signature",
  "decision_vote",
  "commitment_response",
] as const;

export type CollectiveParticipationActionType =
  (typeof COLLECTIVE_PARTICIPATION_ACTION_TYPES)[number];

export type CollectiveParticipationActionSource =
  | "participant_action_ledger"
  | "domain_derived"
  | "relationship";

export type CollectiveParticipationEligibility =
  | "eligible"
  | "already_completed"
  | "requires_sign_in"
  | "stage_not_open"
  | "stage_not_applicable"
  | "not_eligible"
  | "unavailable";

export interface CollectiveParticipationPastAction {
  readonly actionType: CollectiveParticipationActionType;
  readonly stageId: InitiativeLifecycleStageId;
  readonly occurredAt: string;
  /** Short public status, e.g. "Signed", "Voted Approve", "Commented". */
  readonly statusLabel: string;
  readonly deepLink: string;
  readonly source: CollectiveParticipationActionSource;
  /**
   * When true, this past action represents an updateable participation
   * (e.g. vote may still be changed) — not a second independent act.
   */
  readonly updateable?: boolean;
}

export interface CollectiveParticipationAvailableAction {
  readonly actionType: CollectiveParticipationActionType;
  readonly stageId: InitiativeLifecycleStageId;
  readonly label: string;
  readonly eligibility: CollectiveParticipationEligibility;
  readonly reason?: string;
  readonly deepLink: string;
}

export interface CollectiveParticipationNextAction {
  readonly actionType: CollectiveParticipationActionType;
  readonly stageId: InitiativeLifecycleStageId;
  readonly label: string;
  readonly deepLink: string;
  readonly reason: string;
}

export interface CollectiveParticipationJourney {
  readonly initiativeId: string;
  readonly participantId: string | null;
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: InitiativeLifecycleStageId;
  readonly currentStageLabel: string;
  readonly pastActions: readonly CollectiveParticipationPastAction[];
  readonly availableActions: readonly CollectiveParticipationAvailableAction[];
  readonly nextAction: CollectiveParticipationNextAction | null;
  /**
   * Active Ally is a collaboration relationship, not fabricated pastAction history.
   * Exposed for eligibility / next-action context only.
   */
  readonly activeAlly: boolean;
  readonly viewerIsSteward: boolean;
  readonly generatedAt: string;
}

/** Compact list row for future Workspace (same projection family). */
export interface CollectiveParticipationJourneySummary {
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: InitiativeLifecycleStageId;
  readonly nextAction: CollectiveParticipationNextAction | null;
  readonly pastActionCount: number;
}
