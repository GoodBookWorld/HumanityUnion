import type {
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
  /** Compatibility English label — prefer Web localization of `section`. */
  readonly sectionLabel: string;
  readonly changeIds: readonly string[];
  readonly proposalIds: readonly string[];
  readonly params: {
    readonly changeCount: number;
  };
  /** Compatibility English message — prefer semantic presentation. */
  readonly message: string;
}

/**
 * Initiative Lifecycle — Part E, Section 3. One deterministic pass/fail
 * check the Revision Builder can always answer truthfully from persisted
 * data alone — never an AI judgment call.
 *
 * NOTE (08E.9b): checkId remains `string` — Revision consistencyChecks are
 * intentionally unmounted in the Working Sidebar and out of scope for this
 * semantic migration slice.
 */
export interface InitiativeRevisionConsistencyCheck {
  readonly checkId: string;
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  readonly detail: string;
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
