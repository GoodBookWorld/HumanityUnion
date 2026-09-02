/**
 * Pack 02G Task 08E.8a — Web-local Working Sidebar advisory descriptors.
 * Language-neutral codes + civic payloads. Presentation owns localized prose.
 * Not part of @hu/types (Web presentation architecture).
 */

export type SidebarAdvisorySeverity = "info" | "warning" | "critical";

/** Civic/data payload for Analysis 08E.8a — only fields this slice uses. */
export type InitiativeSidebarAdvisoryCivic = {
  readonly subject?: string;
};

export type InitiativeSidebarAdvisory<Code extends string = string> = {
  readonly code: Code;
  readonly severity?: SidebarAdvisorySeverity;
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  readonly civic?: InitiativeSidebarAdvisoryCivic;
};

/** Exact Analysis-stage advisory codes (08E.8a). No open `| string`. */
export type AnalysisSidebarAdvisoryCode =
  | "analysis.sources.summary"
  | "analysis.sources.empty"
  | "analysis.missing_helpful_sources"
  | "analysis.missing_not_helpful_sources"
  | "analysis.missing_proposal_candidates"
  | "analysis.missing_open_questions"
  | "analysis.text_overlap_contradiction";

export type AnalysisSidebarAdvisory = InitiativeSidebarAdvisory<AnalysisSidebarAdvisoryCode>;

/** Catalog leaf under author.sidebar.advisories.analysis.* */
export const ANALYSIS_ADVISORY_MESSAGE_KEY: Record<AnalysisSidebarAdvisoryCode, string> = {
  "analysis.sources.summary": "sourcesSummary",
  "analysis.sources.empty": "sourcesEmpty",
  "analysis.missing_helpful_sources": "missingHelpfulSources",
  "analysis.missing_not_helpful_sources": "missingNotHelpfulSources",
  "analysis.missing_proposal_candidates": "missingProposalCandidates",
  "analysis.missing_open_questions": "missingOpenQuestions",
  "analysis.text_overlap_contradiction": "textOverlapContradiction",
};

export function isAnalysisSidebarAdvisoryCode(
  code: string,
): code is AnalysisSidebarAdvisoryCode {
  return Object.prototype.hasOwnProperty.call(ANALYSIS_ADVISORY_MESSAGE_KEY, code);
}
