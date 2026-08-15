/**
 * Initiative Lifecycle — Part D, Section 2/3 (Automatic Proposal
 * Collection / Proposal Intelligence).
 *
 * Mirrors `InitiativeAnalysisSourceSnapshot` (Part B) exactly in spirit:
 * every field here is a DETERMINISTIC aggregation of already-persisted
 * Discussion data — Proposal-marked comments (`InitiativeDiscussionProposalCandidate`),
 * their Helpful/Not Helpful reaction counts, and the author's own
 * published Collaborative Analysis, if any. No AI, no invented category,
 * no fabricated grouping — grouping is plain keyword-overlap clustering
 * (see `initiative-proposal-intelligence.service.ts`), never semantic
 * reasoning.
 *
 * This single snapshot type intentionally folds together what Part D's
 * spec calls "Automatic Proposal Collection" (Part 2 — the raw
 * `candidates` list) and "Proposal Intelligence" (Part 3 — `groups`,
 * `duplicateGroupCount`, categories, evidence, frequency, authors,
 * references, open questions) rather than introducing two parallel
 * snapshot types: both are read by the same Author Workspace panel and
 * the same AI Assistant sidebar in one request (Part 14 — no duplicated
 * queries), exactly like Collaborative Analysis's one
 * `InitiativeAnalysisSourceSnapshot` already does for its own stage.
 */
export interface InitiativeProposalCandidateRef {
  readonly candidateId: string;
  readonly commentId: string;
  readonly excerpt: string;
  readonly authorDisplayName: string;
  readonly discussionUrl: string;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
  readonly createdAt: string;
}

/**
 * A cluster of Proposal-marked comments the deterministic grouping pass
 * judged similar enough (keyword-overlap threshold) to represent "the
 * same underlying improvement idea" — Part 3's "Grouped Improvements" +
 * "Duplicate Detection" folded into one record: `memberCount > 1` IS the
 * duplicate signal, so no separate duplicate list is needed.
 */
export interface InitiativeProposalGroup {
  readonly groupId: string;
  readonly representativeExcerpt: string;
  /**
   * A deterministic keyword-bucket label (e.g. "Funding", "Timeline",
   * "Accessibility", "Communication", "General") — Part 3's "Proposal
   * Categories". Never an AI-inferred category.
   */
  readonly category: string;
  readonly memberCandidateIds: readonly string[];
  readonly memberCount: number;
  /** Part 3 "Proposal Authors" — distinct authors contributing to this group. */
  readonly authorDisplayNames: readonly string[];
  /** Part 3 "Proposal Evidence" — total Helpful reactions across every member comment. */
  readonly totalHelpfulCount: number;
  /** Part 3 "Proposal Relationships"/"Proposal Frequency" — duplicates when more than one member. */
  readonly isDuplicateGroup: boolean;
  readonly discussionUrl: string;
}

export interface InitiativeProposalAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
}

export interface InitiativeProposalIntelligenceSnapshot {
  readonly initiativeId: string;
  readonly generatedAt: string;
  readonly candidates: readonly InitiativeProposalCandidateRef[];
  readonly groups: readonly InitiativeProposalGroup[];
  readonly duplicateGroupCount: number;
  /** Part 3 "Open Proposal Questions" — proposal-marked comments phrased as a question. */
  readonly openProposalQuestions: readonly InitiativeProposalCandidateRef[];
  readonly totalCandidateCount: number;
  /** The Author's own published Collaborative Analysis this stage builds on, if any (Part 1/7). */
  readonly analysisReference: InitiativeProposalAnalysisReference | null;
  readonly discussionUrl: string;
  readonly isEmpty: boolean;
}
