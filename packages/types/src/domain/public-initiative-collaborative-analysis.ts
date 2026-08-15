import type { InitiativeId } from "./initiative.js";
import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type { InitiativeAnalysisReactionSummary } from "./initiative-analysis-reaction.js";

export interface PublicInitiativeCollaborativeAnalysisProjection {
  analysisId: InitiativeCollaborativeAnalysisId;
  initiativeId: InitiativeId;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  /** Initiative Lifecycle — Part B. Defaults to "" for analyses published before this field existed. */
  openQuestions: string;
  suggestedImprovements: string;
  references: string;
  authorDisplayName: string;
  publishedAt: string;
  initiativeVersion: number;
  /** Initiative Lifecycle — Part B: Support / Do Not Support (representative statistics only, not a vote). */
  reactionSummary: InitiativeAnalysisReactionSummary;
}

export interface PublicInitiativeCollaborativeAnalysisListItem {
  analysisId: InitiativeCollaborativeAnalysisId;
  title: string;
  summary: string;
  authorDisplayName: string;
  publishedAt: string;
  initiativeVersion: number;
}
