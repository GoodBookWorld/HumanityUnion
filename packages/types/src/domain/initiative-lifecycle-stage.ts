/**
 * Initiative Lifecycle — Part A: Lifecycle Stage Workspace Foundation.
 *
 * Canonical registry of the public Initiative lifecycle stages, shared by
 * every stage-specific pack (Discussion civic surface, Collaborative Analysis,
 * Improvement Proposals, Revision, Petition, Decision Session, Collective
 * Decision, Implementation Commitments, Implementation Tracking, Official
 * Responses, Public Impact, Civic Archive) plus the root "Initiative" stage.
 *
 * Discussion reuses the Initiative Center-tab Discussion contract — it is not
 * a second Discussion implementation.
 *
 * This module is pure configuration data — it contains no persistence, HTTP,
 * or mutable Initiative state. `stageId`/`label`/`hash` intentionally reuse
 * the exact values already established in
 * {@link PUBLIC_INITIATIVE_EXPERIENCE_STAGES} (`./public-initiative-experience`)
 * rather than renaming them: those IDs are already load-bearing (URL hashes,
 * API stage filters, notification deep-links), and this registry exists to
 * add lifecycle-workspace metadata on top of them, not to replace them.
 */

export type InitiativeLifecycleStageId =
  | "initiative"
  | "discussion"
  | "analysis"
  | "proposal"
  | "revision"
  | "petition"
  | "decision_session"
  | "collective_decision"
  | "commitment"
  | "tracking"
  | "official_response"
  | "public_impact"
  | "archive";

/**
 * A stage "supports a draft/publication workflow" when an Author produces
 * unpublished working content before a public result exists (Part 8/9).
 * `"initiative"` itself does not — the Initiative record is either a Draft
 * Initiative (Initiative UX Pack 01.1) or already published; it is not a
 * lifecycle *stage* artifact with its own draft/publish cycle layered on
 * top of the Initiative.
 */
export interface InitiativeLifecycleStageDefinition {
  /** Canonical stage identifier — matches `PublicInitiativeExperienceStageDefinition.stageId`. */
  readonly stageId: InitiativeLifecycleStageId;
  /** Canonical public label — matches `PublicInitiativeExperienceStageDefinition.label`. */
  readonly label: string;
  /** Canonical URL hash — matches `PublicInitiativeExperienceStageDefinition.hash`. */
  readonly hash: string;
  /** 0-based position in the canonical lifecycle ordering. */
  readonly order: number;
  /**
   * Whether Author Mode (Part 4) can ever apply while viewing this stage.
   * `"initiative"` is deliberately excluded — Author Mode begins at
   * Collaborative Analysis per the Primary Product Decision.
   */
  readonly authorModeApplies: boolean;
  /** Whether this stage has its own unpublished-draft concept (Part 8/9). */
  readonly supportsDraft: boolean;
  /** Whether this stage produces a formal publication/fix event (Part 13). */
  readonly supportsPublication: boolean;
  /**
   * Whether ordinary Members/Participants (not just the Author) take a
   * direct public participation action on this stage's own record (sign a
   * Petition, cast a Collective Decision vote, etc.). Informational only —
   * this registry never gates that action itself.
   */
  readonly hasPublicParticipationAction: boolean;
  /** Whether AI-assisted drafting is a meaningful extension point for this stage (Part 10). */
  readonly aiAssistCapable: boolean;
}

/**
 * Ordered canonical registry for the Initiative lifecycle stage workspace
 * foundation. Order matches {@link PUBLIC_INITIATIVE_EXPERIENCE_STAGES}
 * exactly.
 */
export const INITIATIVE_LIFECYCLE_STAGE_REGISTRY: readonly InitiativeLifecycleStageDefinition[] = [
  {
    stageId: "initiative",
    label: "Initiative",
    hash: "initiative",
    order: 0,
    authorModeApplies: false,
    supportsDraft: false,
    supportsPublication: false,
    hasPublicParticipationAction: false,
    aiAssistCapable: false,
  },
  {
    stageId: "discussion",
    label: "Discussion",
    hash: "discussion",
    order: 1,
    authorModeApplies: false,
    supportsDraft: false,
    /**
     * Discussion completion is a durable progress marker for the profile route
     * (Center-tab civic surface). It does not invent a parallel Discussion domain.
     */
    supportsPublication: true,
    hasPublicParticipationAction: true,
    aiAssistCapable: false,
  },
  {
    stageId: "analysis",
    label: "Collaborative Analysis",
    hash: "collaborative-analysis",
    order: 2,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "proposal",
    label: "Improvement Proposals",
    hash: "improvement-proposals",
    order: 3,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: false,
    hasPublicParticipationAction: true,
    aiAssistCapable: true,
  },
  {
    stageId: "revision",
    label: "Revision",
    hash: "revision",
    order: 4,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "petition",
    label: "Petition",
    hash: "petition",
    order: 5,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: true,
    aiAssistCapable: true,
  },
  {
    stageId: "decision_session",
    label: "Decision Session",
    hash: "decision-session",
    order: 6,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "collective_decision",
    label: "Collective Decision",
    hash: "collective-decision",
    order: 7,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: true,
    aiAssistCapable: true,
  },
  {
    stageId: "commitment",
    label: "Implementation Commitments",
    hash: "implementation-commitments",
    order: 8,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "tracking",
    label: "Implementation Tracking",
    hash: "implementation-tracking",
    order: 9,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "official_response",
    label: "Official Responses",
    hash: "official-responses",
    order: 10,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "public_impact",
    label: "Public Impact",
    hash: "public-impact",
    order: 11,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    aiAssistCapable: true,
  },
  {
    stageId: "archive",
    label: "Civic Archive",
    hash: "civic-archive",
    order: 12,
    authorModeApplies: true,
    supportsDraft: true,
    supportsPublication: true,
    hasPublicParticipationAction: false,
    /** Initiative Lifecycle — Part M: Civic Archive Assistant (advisory only). */
    aiAssistCapable: true,
  },
] as const;

const STAGE_BY_ID = new Map<InitiativeLifecycleStageId, InitiativeLifecycleStageDefinition>(
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => [stage.stageId, stage]),
);

const ANALYSIS_STAGE_ORDER = STAGE_BY_ID.get("analysis")?.order ?? 1;

export function getInitiativeLifecycleStageDefinition(
  stageId: string,
): InitiativeLifecycleStageDefinition | null {
  return STAGE_BY_ID.get(stageId as InitiativeLifecycleStageId) ?? null;
}

export function isInitiativeLifecycleStageId(
  value: unknown,
): value is InitiativeLifecycleStageId {
  return typeof value === "string" && STAGE_BY_ID.has(value as InitiativeLifecycleStageId);
}

export function getNextInitiativeLifecycleStageId(
  stageId: InitiativeLifecycleStageId,
): InitiativeLifecycleStageId | null {
  const current = STAGE_BY_ID.get(stageId);

  if (!current) {
    return null;
  }

  const next = INITIATIVE_LIFECYCLE_STAGE_REGISTRY.find((stage) => stage.order === current.order + 1);
  return next?.stageId ?? null;
}

export function getPreviousInitiativeLifecycleStageId(
  stageId: InitiativeLifecycleStageId,
): InitiativeLifecycleStageId | null {
  const current = STAGE_BY_ID.get(stageId);

  if (!current) {
    return null;
  }

  const previous = INITIATIVE_LIFECYCLE_STAGE_REGISTRY.find(
    (stage) => stage.order === current.order - 1,
  );
  return previous?.stageId ?? null;
}

/**
 * Part 4/5 — "Author Mode begins at Collaborative Analysis": true for
 * Collaborative Analysis and every stage after it, false for `"initiative"`
 * itself. Pure ordering logic only; it never decides *who* is the Author —
 * see the server-authoritative `resolveInitiativeLifecyclePresentationMode`
 * in `apps/api/src/shared/initiative-lifecycle-stage` for that.
 */
export function isInitiativeLifecycleAuthorWorkspaceStage(stageId: string): boolean {
  const stage = getInitiativeLifecycleStageDefinition(stageId);
  return Boolean(stage && stage.authorModeApplies && stage.order >= ANALYSIS_STAGE_ORDER);
}
