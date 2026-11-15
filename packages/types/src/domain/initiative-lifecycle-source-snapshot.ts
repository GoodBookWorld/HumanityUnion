/**
 * Initiative Lifecycle — Part A Part 9: standard source-summary boundary.
 *
 * A "source" is whatever upstream material a stage's draft was produced
 * from (the Initiative record itself, an earlier stage's published result,
 * Collaborative Analysis contributions, etc.). This contract lets every
 * stage workspace render a consistent "what this draft is based on"
 * summary without the shell needing to understand any domain's real
 * source data model.
 */
export type InitiativeLifecycleSourceKind =
  | "initiative_record"
  | "prior_stage_result"
  | "member_contribution"
  | "external_reference"
  | "ai_generated_draft";

/**
 * Optional semantic presentation for lifecycle Sources Used items.
 * Platform chrome is localized in WEB via stable codes; authored fields
 * remain verbatim content (never WEB_UI / never inferred translation).
 * English `label` / `summary` stay for backward-compatible API consumers.
 */
export type InitiativeLifecycleSourceSnapshotPresentation =
  | {
      readonly code: "petition.revision_reference";
      readonly version: number | null;
      readonly authoredSummary: string | null;
    }
  | {
      readonly code: "petition.analysis_reference";
      readonly authoredTitle: string | null;
    }
  | {
      readonly code: "petition.proposal_references";
      readonly acceptedCount: number;
    }
  | {
      readonly code: "petition.consistency_checks";
      readonly warningCount: number;
      readonly totalCount: number;
    };

export interface InitiativeLifecycleSourceSnapshotItem {
  readonly sourceId: string;
  readonly kind: InitiativeLifecycleSourceKind;
  readonly label: string;
  readonly summary: string;
  readonly referenceUrl?: string;
  /** When set, WEB may localize platform labels/templates from `code`. */
  readonly presentation?: InitiativeLifecycleSourceSnapshotPresentation;
}

/**
 * A read-only, point-in-time summary of the sources behind a stage's
 * current draft/result. Never itself a source of truth — the owning
 * domain's own persisted data always is. Rebuilt by the owning domain
 * whenever it regenerates or edits a draft (Part 9's "boundary is a read
 * projection, never a second source of truth").
 */
export interface InitiativeLifecycleSourceSnapshotSummary {
  readonly stageId: string;
  readonly capturedAt: string;
  readonly items: readonly InitiativeLifecycleSourceSnapshotItem[];
  /** True when the owning domain has no source material yet (e.g. before any Collaboration Channel activity exists). */
  readonly isEmpty: boolean;
}
