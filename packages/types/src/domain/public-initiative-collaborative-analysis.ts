import type { InitiativeId } from "./initiative.js";
import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";

export interface PublicInitiativeCollaborativeAnalysisProjection {
  analysisId: InitiativeCollaborativeAnalysisId;
  initiativeId: InitiativeId;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  suggestedImprovements: string;
  references: string;
  authorDisplayName: string;
  publishedAt: string;
  initiativeVersion: number;
}

export interface PublicInitiativeCollaborativeAnalysisListItem {
  analysisId: InitiativeCollaborativeAnalysisId;
  title: string;
  summary: string;
  authorDisplayName: string;
  publishedAt: string;
  initiativeVersion: number;
}
