/**
 * Initiative Lifecycle — Part B, Sections 2/3/6 (Automatic Source
 * Collection, Source Snapshot Panel, AI Assistant Sidebar).
 *
 * Every field here is derived deterministically from EXISTING persisted
 * data — no invented categorization, no NLP/AI classification, no
 * generation. Documented derivation per field (see
 * `initiative-analysis-source-snapshot.service.ts` for the exact
 * algorithm):
 *
 *  - `discussionStatistics` — real comment/reaction counts.
 *  - `mostDiscussedTopics` — deterministic keyword-frequency across
 *    comment bodies (stopword-filtered), NOT semantic topic modeling.
 *  - `openQuestions` — comments whose body ends in "?" (a structural,
 *    not semantic, signal).
 *  - `repeatedArguments` — comments with the most "Helpful" reactions
 *    (a real persisted signal of traction), excluding open questions.
 *  - `repeatedConcerns` — comments with the most "Not Helpful" reactions.
 *    Labelled honestly: this is "least favorably received", the closest
 *    real signal available, not a concern classifier.
 *  - `proposalCandidates` — existing `InitiativeDiscussionProposalCandidate`
 *    records, verbatim.
 *  - `activeAlliesCount` / `readyToCollaborateCount` — existing Ally
 *    store counts.
 *
 * Every item links back to Discussion via `discussionUrl` (the existing
 * `#discussion` hash — there is no per-comment deep-link in this
 * codebase, so linking is at the Discussion-panel granularity).
 */
export interface InitiativeAnalysisSourceCommentRef {
  readonly commentId: string;
  readonly excerpt: string;
  readonly authorDisplayName: string;
  readonly discussionUrl: string;
}

export interface InitiativeAnalysisSourceTopic {
  readonly topic: string;
  readonly mentionCount: number;
}

export interface InitiativeAnalysisSourceArgument extends InitiativeAnalysisSourceCommentRef {
  readonly helpfulCount: number;
}

export interface InitiativeAnalysisSourceConcern extends InitiativeAnalysisSourceCommentRef {
  readonly notHelpfulCount: number;
}

export interface InitiativeAnalysisSourceProposalCandidate extends InitiativeAnalysisSourceCommentRef {
  readonly candidateId: string;
}

export interface InitiativeAnalysisDiscussionStatistics {
  readonly commentCount: number;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
}

export interface InitiativeAnalysisSourceSnapshot {
  readonly initiativeId: string;
  readonly generatedAt: string;
  readonly discussionStatistics: InitiativeAnalysisDiscussionStatistics;
  readonly mostDiscussedTopics: readonly InitiativeAnalysisSourceTopic[];
  readonly openQuestions: readonly InitiativeAnalysisSourceCommentRef[];
  readonly repeatedArguments: readonly InitiativeAnalysisSourceArgument[];
  readonly repeatedConcerns: readonly InitiativeAnalysisSourceConcern[];
  readonly proposalCandidates: readonly InitiativeAnalysisSourceProposalCandidate[];
  readonly activeAlliesCount: number;
  readonly readyToCollaborateCount: number;
  readonly discussionUrl: string;
  /** True when no discussion activity exists yet — the shell must render an honest empty state, never a fabricated snapshot. */
  readonly isEmpty: boolean;
}
