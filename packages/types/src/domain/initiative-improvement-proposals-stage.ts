import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/**
 * Initiative Lifecycle — Part D, Section 6/7 (Proposal Editor / Proposal
 * Traceability).
 *
 * `"draft"` / `"ready"` are pre-publication working states the Author
 * cycles through while curating. `"published"` is set automatically, in
 * bulk, the instant the parent `InitiativeImprovementProposalsCollection`
 * is published — every proposal that was `"ready"` at that moment
 * becomes `"published"`; any proposal still `"draft"` at publish time is
 * left exactly as-is (carried into the next drafting round, never
 * silently discarded and never silently force-published).
 *
 * `"included_in_revision"` / `"keep_for_later"` / `"not_applicable"` are
 * Author-only curation decisions applied AFTER publication (Part 7's "the
 * last three are Author decisions") — they exist to prepare this stage's
 * canonical, stable-ID output for the future Revision stage (Part 12),
 * and never trigger a republish, a new notification, or a version bump.
 */
export type InitiativeStructuredProposalStatus =
  | "draft"
  | "ready"
  | "published"
  | "included_in_revision"
  | "keep_for_later"
  | "not_applicable";

/**
 * One concrete, structured improvement suggestion — Part 6's Proposal
 * Editor field set exactly. `proposalId` is assigned once, at creation,
 * and is NEVER reassigned or reused — this is Part 7's "stable Proposal
 * ID" traceability contract: any future Revision change may cite this id
 * forever, even after this proposal's `status` changes.
 */
export interface InitiativeStructuredProposal {
  readonly proposalId: string;
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
  /** Free-text citation of supporting evidence (Helpful counts, referenced sources). */
  supportingSources: string;
  /** Free-text list of Discussion comment references/links this proposal traces back to. */
  relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
  /** Every Discussion comment id this proposal was collected/derived from (Part 2). */
  readonly sourceCommentIds: readonly string[];
  /** The `InitiativeProposalGroup.groupId` this proposal was generated from, if any (`null` for an Author-originated proposal with no automatic source group). */
  readonly groupId: string | null;
  status: InitiativeStructuredProposalStatus;
  readonly createdAt: string;
  updatedAt: string;
}

export type InitiativeImprovementProposalsCollectionStatus = "draft" | "published" | "archived";

/**
 * The ONE canonical Improvement Proposals artifact this Lifecycle stage
 * publishes for a given Initiative + Author — mirrors
 * `InitiativeCollaborativeAnalysis`'s draft/published/archived shape
 * exactly, except its content is a set of `InitiativeStructuredProposal`
 * records instead of one flat body (Part 6: this stage produces MANY
 * structured proposals per publication, not one document).
 */
export interface InitiativeImprovementProposalsCollection {
  readonly collectionId: string;
  readonly initiativeId: InitiativeId;
  readonly authorId: MemberId;
  /** The published Collaborative Analysis this round of proposals was built from, if one existed at generation time (Part 1). */
  analysisId: string | null;
  status: InitiativeImprovementProposalsCollectionStatus;
  proposals: InitiativeStructuredProposal[];
  /** `InitiativeProposalIntelligenceSnapshot.generatedAt` at the time Generate was last run (Part 13 staleness signal, mirrors Analysis's `sourceSnapshotCreatedAt`). */
  sourceSnapshotCreatedAt: string | null;
  readonly createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
