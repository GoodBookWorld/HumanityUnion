import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type {
  InitiativeDescription,
  InitiativeId,
  InitiativeMetadata,
  InitiativeTitle,
} from "./initiative.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";
import type { InitiativeRevisionIntelligenceSnapshot } from "./initiative-revision-intelligence-snapshot.js";
import type { MemberId } from "./member.js";

export type InitiativeVersionRevisionId = string;

/**
 * Initiative Lifecycle — Part E, Section 5 (Canonical Traceability).
 *
 * Origin of one structured `InitiativeRevisionChange`: either it descends
 * from one or more published Improvement Proposals (Part D's
 * `InitiativeStructuredProposal`), or the Author introduced it directly
 * with no Proposal backing at all ("Author-originated") — in which case a
 * `reason` is mandatory. Every `InitiativeRevisionChange` must be one or
 * the other; there is no third, untraceable origin.
 */
export type InitiativeRevisionChangeOrigin = "proposal" | "author_originated";

/**
 * Which field of the Initiative record a change targets. `"custom"` covers
 * any Author-originated improvement that does not map onto `title`/
 * `description` directly (e.g. a rationale note) — it is never applied
 * automatically to any Initiative field, only tracked for traceability.
 */
export type InitiativeRevisionChangeSection = "title" | "description" | "custom";

/**
 * Initiative Lifecycle — Part E, Section 5/7 (Canonical Traceability /
 * Before-After). One structured, fully-traceable Revision change: what the
 * text looked like before, what the Author (or the deterministic Revision
 * Builder, Section 3) suggests after, why, and where it came from. This
 * never itself mutates `InitiativeRevisionDraft.title`/`description` — the
 * Author decides whether/how to fold `after` into the draft's actual text
 * (Section 4: "The Assistant never edits automatically").
 */
export interface InitiativeRevisionChange {
  readonly changeId: string;
  section: InitiativeRevisionChangeSection;
  sectionLabel: string;
  before: string;
  after: string;
  origin: InitiativeRevisionChangeOrigin;
  /** Non-empty when `origin === "proposal"`; empty for `"author_originated"`. */
  proposalIds: InitiativeImprovementProposalId[];
  /** Mandatory (non-empty) when `origin === "author_originated"`; `null` for `"proposal"`. */
  authorOriginatedReason: string | null;
  explanation: string;
  readonly createdAt: string;
  updatedAt: string;
}

/** Published initiative version snapshot (Collective Intelligence revision cycle). */
export interface InitiativeVersionRevision {
  revisionId: InitiativeVersionRevisionId;
  initiativeId: InitiativeId;
  version: number;
  previousVersion: number | null;
  authorId: MemberId;
  createdAt: string;
  publishedAt: string;
  revisionSummary: string;
  title: InitiativeTitle;
  description: InitiativeDescription;
  metadata: InitiativeMetadata;
  acceptedProposalIds: InitiativeImprovementProposalId[];
  partiallyAcceptedProposalIds: InitiativeImprovementProposalId[];
  declinedProposalIds: InitiativeImprovementProposalId[];
  /** Initiative Lifecycle — Part E, Section 5/7. Every structured change carried into this published version, verbatim from the draft. */
  changes: InitiativeRevisionChange[];
}

/** Steward workspace draft before publishing a new initiative version. */
export interface InitiativeRevisionDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: InitiativeTitle;
  description: InitiativeDescription;
  metadata: InitiativeMetadata;
  revisionSummary: string;
  appliedProposalIds: InitiativeImprovementProposalId[];
  skippedProposalIds: InitiativeImprovementProposalId[];
  /** Initiative Lifecycle — Part E, Section 5/6/7. Defaults to `[]` for drafts created before Part E; never required to be non-empty (Section 5 validates only the entries that DO exist). */
  changes: InitiativeRevisionChange[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeRevisionDraftContext {
  draft: InitiativeRevisionDraft | null;
  currentVersion: number;
  eligibleProposals: InitiativeRevisionEligibleProposal[];
  /** Initiative Lifecycle — Part E, Section 2/3. The Part D structured, published (or since curated "included_in_revision") Improvement Proposals this Revision may trace changes back to — distinct from the legacy free-text `eligibleProposals` above. */
  eligibleStructuredProposals: InitiativeRevisionEligibleStructuredProposal[];
  /** Initiative Lifecycle — Part E, Section 3/4/6. The deterministic Revision Builder's output the Author Workspace renders as "AI Suggestions" / "Conflict Detection" / "Change Summary" — Suggested wording improvements, Conflict warnings, Missing references, and Consistency checks, all derived from the current draft's `changes`. */
  intelligenceSnapshot: InitiativeRevisionIntelligenceSnapshot;
  currentInitiative: {
    title: InitiativeTitle;
    description: InitiativeDescription;
    metadata: InitiativeMetadata;
  };
}

export interface InitiativeRevisionEligibleProposal {
  proposalId: InitiativeImprovementProposalId;
  analysisId: InitiativeCollaborativeAnalysisId;
  targetSection: string;
  proposedChange: string;
  status: "accepted" | "partially_accepted";
}

/**
 * Initiative Lifecycle — Part E, Section 2 (Revision Sources). A published
 * Improvement Proposal (Part D's `InitiativeStructuredProposal`) eligible
 * to back a Revision change: either already curated `"included_in_revision"`
 * by the Author, or still plain `"published"` (an open question the
 * Revision stage should surface as unresolved, Section 4).
 */
export interface InitiativeRevisionEligibleStructuredProposal {
  readonly proposalId: string;
  readonly collectionId: string;
  readonly title: string;
  readonly summary: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly status: "published" | "included_in_revision";
  readonly originalAuthorDisplayNames: readonly string[];
  readonly relatedDiscussionReferences: string;
}
