import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import type { InitiativeLifecyclePresentationStatus } from "./initiative-lifecycle-presentation.js";

/**
 * Initiative Lifecycle — Part A Part 8: common draft/publication metadata
 * contract.
 *
 * Every stage-specific pack (Part B onward) supplies one of these to the
 * shared {@link InitiativeLifecycleStageWorkspace} shell instead of the
 * shell reading any domain's own status/version fields directly. This is
 * the seam that keeps the shell domain-agnostic (Part 6).
 */
export interface InitiativeLifecycleStageMetadata {
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly presentationStatus: InitiativeLifecyclePresentationStatus;
  /** Domain-specific version/count, when the stage has one (e.g. proposal round, revision version). Null when not applicable. */
  readonly version: number | null;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
  readonly publishedByParticipantId: string | null;
  /** When the source snapshot (Part 9) backing the current draft was captured, if any. */
  readonly sourceSnapshotCreatedAt: string | null;
  readonly hasUnpublishedChanges: boolean;
  /** Standard Author action availability (Part 7) — the shell renders actions; callers decide eligibility. */
  readonly canGenerate: boolean;
  readonly canEdit: boolean;
  readonly canPreview: boolean;
  readonly canPublish: boolean;
  readonly canViewPublicResult: boolean;
  /**
   * Initiative Lifecycle — Part B. The ID of this stage's canonical
   * published record (e.g. the published Analysis's `analysisId`), so a
   * stage-specific `publicResultSlot` component can fetch its own full
   * domain projection directly — without a list-then-select round trip,
   * and guaranteed to match the same canonical record this metadata
   * (`publishedAt`/`version`) describes. `null` when `canViewPublicResult`
   * is `false`, or for a stage with no such seam yet.
   */
  readonly publishedRecordId: string | null;
}
