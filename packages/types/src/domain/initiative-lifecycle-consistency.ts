/**
 * Pack 02G Task 08E.9b — shared structural pieces for lifecycle consistency /
 * conflict semantic transport.
 *
 * Stage-specific finite checkId unions live on each stage's ConsistencyCheck
 * type. This module holds only shared status / param / civic shapes reused
 * across stages. Presentation catalogs and next-intl keys stay Web-local.
 */

import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

export type InitiativeLifecycleConsistencyStatus = "ok" | "warning";

/**
 * Narrow civic values already visible on the relevant lifecycle surface.
 * Never carry PII, private evidence bodies, or unrestricted free-form text.
 */
export interface InitiativeLifecycleConsistencyCivic {
  readonly title?: string;
}

/**
 * Structural presentation params shared across stages.
 * Domain calculation stays upstream; Web only presents these values.
 * Stage-specific extras (e.g. outcomeKind) live on the stage check type.
 */
export interface InitiativeLifecycleConsistencyParams {
  readonly version?: number;
  readonly count?: number;
  readonly required?: boolean;
  readonly present?: boolean;
  readonly changeCount?: number;
  readonly outstandingCount?: number;
  readonly recordCount?: number;
  readonly allTraceable?: boolean;
  readonly unresolvedTrackingCount?: number;
  readonly missingEvidenceCount?: number;
  readonly stageIds?: readonly InitiativeLifecycleStageId[];
}

/** Finite Revision conflict warning code (08E.9b). */
export type InitiativeRevisionConflictWarningCode = "multiple_changes_same_section";
