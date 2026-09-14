/**
 * Browser-visible Improvement Proposal Part D localization boundary.
 *
 * Derived from InitiativeImprovementProposalsPublicResult —
 * not from Cap02 currentIssue/proposedChange/rationale.
 *
 * Authoritative persisted mechanism: content_translations
 * (sourceKind "improvement_proposal") with this field bag.
 *
 * `category` is NOT a CT leaf: it is a controlled semantic key embedded inside
 * generated reason prose (CT-owned as part of that sentence). Standalone
 * "Category" chrome, if shown, is WEB_UI — never dual-owned.
 */
export const IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS = [
  "title",
  "summary",
  "description",
  "reason",
  "expectedImprovement",
  "supportingSources",
  "relatedDiscussionReferences",
] as const;

export type ImprovementProposalBrowserVisibleProseField =
  (typeof IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS)[number];
