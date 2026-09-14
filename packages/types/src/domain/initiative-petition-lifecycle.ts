import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";
import type { MemberId } from "./member.js";

/**
 * Initiative Lifecycle — Part F, Section 3/9 (Petition Sources /
 * Traceability).
 *
 * Mirrors Part E's `InitiativeRevisionAnalysisReference` pattern: a
 * read-only reference into the Published Revision that produced this
 * Petition, never a copy the Author can edit directly.
 */
export interface InitiativePetitionRevisionReference {
  readonly revisionId: string;
  readonly version: number;
  readonly revisionSummary: string;
  readonly publishedAt: string;
  readonly title: InitiativeTitle;
  readonly description: InitiativeDescription;
}

/** Read-only reference into the Author's Published Collaborative Analysis. */
export interface InitiativePetitionAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
  readonly summary: string;
  readonly initiativeVersion: number;
}

/** Read-only reference into one Published Improvement Proposal the Revision accepted (fully or partially). */
export interface InitiativePetitionProposalReference {
  readonly proposalId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "accepted" | "partially_accepted";
}

/** Finite Petition consistency check IDs (08E.9b). */
export type InitiativePetitionConsistencyCheckId =
  | "revision-available"
  | "analysis-available"
  | "proposal-references-resolved";

/**
 * Initiative Lifecycle — Part F, Section 4 (Petition Assistant).
 * Deterministic, read-only advisory check — never an automatic edit.
 */
export interface InitiativePetitionConsistencyCheck {
  readonly checkId: InitiativePetitionConsistencyCheckId;
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

/**
 * Initiative Lifecycle — Part F, Section 2/3 (Petition Sources / Petition
 * Draft Builder). All read-only aggregation of upstream Lifecycle stages —
 * never itself an editable record. Deterministically rebuilt on every
 * "Generate" action, exactly like `InitiativeRevisionIntelligenceSnapshot`.
 */
export interface InitiativePetitionIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly revisionReference: InitiativePetitionRevisionReference | null;
  readonly analysisReference: InitiativePetitionAnalysisReference | null;
  readonly proposalReferences: readonly InitiativePetitionProposalReference[];
  readonly consistencyChecks: readonly InitiativePetitionConsistencyCheck[];
  /** `false` until the Initiative has a Published Revision — the Petition's one mandatory source. */
  readonly isRevisionAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder). The
 * Author Workspace's working draft, deterministically generated then
 * freely edited before Publish — never itself a public record.
 */
export interface InitiativePetitionDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  publicSummary: string;
  requestStatement: string;
  expectedOutcome: string;
  supportingContext: string;
  keyArguments: string[];
  revisionId: string | null;
  revisionVersion: number | null;
  analysisId: string | null;
  analysisVersion: number | null;
  proposalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativePetitionDraftContext {
  draft: InitiativePetitionDraft | null;
  intelligenceSnapshot: InitiativePetitionIntelligenceSnapshot;
  /** Non-null once a Petition has been published for this Initiative (Draft becomes unavailable afterward). */
  publishedPetitionId: string | null;
}

/**
 * Initiative Lifecycle — Part F, Section 9 (Traceability). Permanently
 * attached to the published `Petition` record — the platform's durable
 * answer to "which Revision produced this Petition, and which Proposals
 * influenced it".
 */
export interface PetitionTraceability {
  readonly revisionId: string;
  readonly revisionVersion: number;
  readonly proposalIds: readonly string[];
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
}
