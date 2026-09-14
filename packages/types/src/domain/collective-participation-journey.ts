/**
 * Initiative Lifecycle Finalization Phase 05 —
 * Collective Participation Journey (participant-facing projection).
 *
 * Read model over canonical domains + Participant Action ledger.
 * Not a civic root, not a second ledger, not a lifecycle engine.
 *
 * Pack 02G Task 08G — semantic status/label/reason codes for Web localization.
 * English string fields remain for one rollout skew; prefer *Code fields.
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

/** Finite past-action status codes (API emits; Web localizes). */
export const COLLECTIVE_PARTICIPATION_STATUS_CODES = [
  "signed_petition",
  "commented",
  "commented_count",
  "supported",
  "opposed",
  "voted",
  "voted_updated",
] as const;

export type CollectiveParticipationStatusCode =
  (typeof COLLECTIVE_PARTICIPATION_STATUS_CODES)[number];

/** Finite available/next action label codes. */
export const COLLECTIVE_PARTICIPATION_LABEL_CODES = [
  "join_discussion",
  "continue_discussion",
  "sign_petition",
  "petition_signed",
  "cast_vote",
  "review_or_update_vote",
  "view_decision_result",
  "support_initiative",
] as const;

export type CollectiveParticipationLabelCode =
  (typeof COLLECTIVE_PARTICIPATION_LABEL_CODES)[number];

/** Finite reason codes for available/next actions. */
export const COLLECTIVE_PARTICIPATION_REASON_CODES = [
  "sign_in_to_comment",
  "sign_in_to_sign",
  "sign_in_to_vote",
  "sign_in_to_support",
  "sign_in_to_take_action",
  "support_unavailable",
  "petition_info_unavailable",
  "petition_not_open",
  "voting_closed",
  "decision_not_open",
  "voting_info_unavailable",
  "petition_open_unsigned",
  "vote_open_may_update",
  "vote_open",
  "join_discussion",
  "show_support",
  "commitment_needs_response",
  "still_contribute_discussion",
] as const;

export type CollectiveParticipationReasonCode =
  (typeof COLLECTIVE_PARTICIPATION_REASON_CODES)[number];

export type CollectiveParticipationMessageParams = Readonly<
  Record<string, string | number | boolean>
>;

export interface CollectiveParticipationPastAction {
  readonly actionType: CollectiveParticipationActionType;
  readonly stageId: InitiativeLifecycleStageId;
  readonly occurredAt: string;
  /**
   * @deprecated Keep for one rollout skew; prefer statusCode.
   * Short public status, e.g. "Signed", "Voted Approve", "Commented".
   */
  readonly statusLabel: string;
  /** Semantic status code for Web localization. */
  readonly statusCode?: string;
  /** ICU / template params for statusCode (e.g. `{ count }`, `{ choice }`). */
  readonly statusParams?: CollectiveParticipationMessageParams;
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
  /**
   * @deprecated Keep for one rollout skew; prefer labelCode.
   */
  readonly label: string;
  /** Semantic label code for Web localization. */
  readonly labelCode?: string;
  readonly eligibility: CollectiveParticipationEligibility;
  /**
   * @deprecated Keep for one rollout skew; prefer reasonCode.
   */
  readonly reason?: string;
  /** Semantic reason code for Web localization. */
  readonly reasonCode?: string;
  /** ICU / template params for reasonCode when needed. */
  readonly reasonParams?: CollectiveParticipationMessageParams;
  readonly deepLink: string;
}

export interface CollectiveParticipationNextAction {
  readonly actionType: CollectiveParticipationActionType;
  readonly stageId: InitiativeLifecycleStageId;
  /**
   * @deprecated Keep for one rollout skew; prefer labelCode.
   */
  readonly label: string;
  /** Semantic label code for Web localization. */
  readonly labelCode?: string;
  readonly deepLink: string;
  /**
   * @deprecated Keep for one rollout skew; prefer reasonCode.
   */
  readonly reason: string;
  /** Semantic reason code for Web localization. */
  readonly reasonCode?: string;
  /** ICU / template params for reasonCode when needed. */
  readonly reasonParams?: CollectiveParticipationMessageParams;
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
