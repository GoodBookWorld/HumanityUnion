import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
  InitiativeRevisionConflictWarningCode,
} from "./initiative-lifecycle-consistency.js";
import type {
  InitiativeRevisionChangeSection,
  InitiativeRevisionEligibleStructuredProposal,
} from "./initiative-version-revision.js";

/**
 * Initiative Lifecycle — Part E, Section 3 (Intelligent Revision Builder).
 *
 * A deterministic warning that two or more structured changes target the
 * same Initiative section at once — purely informational (Section 3: "no
 * AI publishing, no automatic text replacement"); the Author decides how
 * to resolve it.
 */
export interface InitiativeRevisionConflictWarning {
  /** Finite semantic code (08E.9b). */
  readonly code: InitiativeRevisionConflictWarningCode;
  readonly section: InitiativeRevisionChangeSection;
  /**
   * @deprecated 08E.9c — transport-only compatibility English.
   * Prefer Web localization of `section`. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly sectionLabel: string;
  readonly changeIds: readonly string[];
  readonly proposalIds: readonly string[];
  readonly params: {
    readonly changeCount: number;
  };
  /**
   * @deprecated 08E.9c — transport-only compatibility English.
   * Prefer semantic `code` + `params` + Web presentation. Remove after
   * coordinated staging acceptance + production rollout of semantic Web/API.
   */
  readonly message: string;
}

/** Finite Revision consistency check IDs (08E.9c). */
export type InitiativeRevisionConsistencyCheckId =
  | "accepted-proposals-traced"
  | "changes-have-origin";

/**
 * Initiative Lifecycle — Part E, Section 3. One deterministic pass/fail
 * check the Revision Builder can always answer truthfully from persisted
 * data alone — never an AI judgment call.
 */
export interface InitiativeRevisionConsistencyCheck {
  readonly checkId: InitiativeRevisionConsistencyCheckId;
  /**
   * @deprecated 08E.9c — transport-only compatibility English chrome.
   * Prefer Web localization of `checkId`. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /**
   * @deprecated 08E.9c — transport-only compatibility English body.
   * Prefer `params` + Web presentation. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly detail: string;
  /** Structural params (always present on new API — semantic mode signal). */
  readonly params: InitiativeLifecycleConsistencyParams;
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

export interface InitiativeRevisionAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
}

/**
 * Initiative Lifecycle — Part E, Section 2/3 (Revision Sources / Intelligent
 * Revision Builder). Everything the Revision Builder and Revision Assistant
 * derive from already-persisted data — the Current published Initiative,
 * the Author's published Collaborative Analysis, and Part D's published
 * Improvement Proposals — with zero invented content, mirroring
 * `InitiativeProposalIntelligenceSnapshot` (Part D) and
 * `InitiativeAnalysisSourceSnapshot` (Part B) exactly in spirit.
 */
export interface InitiativeRevisionIntelligenceSnapshot {
  readonly initiativeId: string;
  readonly generatedAt: string;
  readonly currentTitle: string;
  readonly currentDescription: string;
  readonly analysisReference: InitiativeRevisionAnalysisReference | null;
  /** Every Part D proposal eligible to back a change (`"published"` or `"included_in_revision"`). */
  readonly eligibleProposals: readonly InitiativeRevisionEligibleStructuredProposal[];
  /** Subset of `eligibleProposals` already referenced by a change in the Author's current draft. */
  readonly referencedProposalIds: readonly string[];
  /** Part 3 "Missing references" — curated `"included_in_revision"` proposals with no backing change yet. */
  readonly missingReferenceProposalIds: readonly string[];
  /** Part 4 "highlighting unresolved proposals" — still plain `"published"`, not yet curated by the Author either way. */
  readonly unresolvedProposalIds: readonly string[];
  readonly affectedSections: readonly string[];
  readonly conflictWarnings: readonly InitiativeRevisionConflictWarning[];
  readonly consistencyChecks: readonly InitiativeRevisionConsistencyCheck[];
  readonly discussionUrl: string;
  readonly isEmpty: boolean;
}
