/**
 * Initiative Lifecycle Finalization Phase 04 — Author Workflow Contract.
 *
 * Behavioral contract for every author-editable lifecycle stage. Not a demand
 * for identical visual controls. Stages omit steps that do not apply
 * (e.g. no Generate inventing for Discussion completion).
 *
 * Authority remains: Initiative-root + LifecycleProfile + durable published
 * artifacts. URL hash / UI selection never mutate progression.
 */

import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/**
 * Conceptual Author workflow steps (Phase 04).
 * Order is normative; presence is stage-specific.
 */
export const INITIATIVE_AUTHOR_WORKFLOW_STEPS = [
  "open_initialize",
  "load_canonical_context",
  "prepare_generate",
  "edit",
  "save_draft",
  "preview",
  "publish",
  "verify_publication_postcondition",
  "advance_unlock_next",
] as const;

export type InitiativeAuthorWorkflowStep = (typeof INITIATIVE_AUTHOR_WORKFLOW_STEPS)[number];

export type InitiativeAuthorWorkflowStageClassification =
  | "CANONICAL"
  | "COMPATIBILITY"
  | "OUTLIER"
  | "BROKEN";

/**
 * Stage participation in Author workflow (documentation + UI guidance).
 * Discussion is lifecycle-completeable but reuses the Center-tab surface
 * (no parallel Discussion aggregate / Author workspace page).
 */
export interface InitiativeAuthorWorkflowStageContract {
  readonly stageId: InitiativeLifecycleStageId;
  readonly authorEditable: boolean;
  readonly requiresPersistedDraft: boolean;
  readonly supportsGenerate: boolean;
  readonly supportsPreview: boolean;
  readonly supportsPublishOrComplete: boolean;
  /** After publication, Author may inspect; mutation policy may be read-only. */
  readonly postPublishEditPolicy: "read_only" | "explicit_edit" | "not_applicable";
  readonly classification: InitiativeAuthorWorkflowStageClassification;
}

export const INITIATIVE_AUTHOR_WORKFLOW_MATRIX: readonly InitiativeAuthorWorkflowStageContract[] = [
  {
    stageId: "initiative",
    authorEditable: true,
    requiresPersistedDraft: false,
    supportsGenerate: false,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "explicit_edit",
    classification: "CANONICAL",
  },
  {
    stageId: "discussion",
    authorEditable: false,
    requiresPersistedDraft: false,
    supportsGenerate: false,
    supportsPreview: false,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "analysis",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "proposal",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "revision",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    /** Version history remains; Revision is not a user-visible Lifecycle stage. */
    classification: "COMPATIBILITY",
  },
  {
    stageId: "petition",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "decision_session",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "collective_decision",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "commitment",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "tracking",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
  {
    stageId: "official_response",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "COMPATIBILITY",
  },
  {
    stageId: "public_impact",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "COMPATIBILITY",
  },
  {
    stageId: "archive",
    authorEditable: true,
    requiresPersistedDraft: true,
    supportsGenerate: true,
    supportsPreview: true,
    supportsPublishOrComplete: true,
    postPublishEditPolicy: "read_only",
    classification: "CANONICAL",
  },
] as const;

export function getInitiativeAuthorWorkflowStageContract(
  stageId: string,
): InitiativeAuthorWorkflowStageContract | null {
  return (
    INITIATIVE_AUTHOR_WORKFLOW_MATRIX.find((entry) => entry.stageId === stageId) ?? null
  );
}
