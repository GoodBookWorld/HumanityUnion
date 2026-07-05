import type { DecisionSessionId, DecisionSessionStatus } from "./decision-session.js";
import type { InitiativeId } from "./initiative.js";
import type { PublicInitiativeCollaborativeAnalysisListItem } from "./public-initiative-collaborative-analysis.js";
import type { PublicInitiativeImprovementProposalListItem } from "./public-initiative-improvement-proposal.js";
import type { PublicInitiativeVersionRevisionListItem } from "./public-initiative-version-revision.js";

export interface PublicDecisionSessionPackage {
  initiativeVersion: number;
  revisions: PublicInitiativeVersionRevisionListItem[];
  analyses: PublicInitiativeCollaborativeAnalysisListItem[];
  proposals: PublicInitiativeImprovementProposalListItem[];
}

export interface PublicDecisionSessionProjection {
  sessionId: DecisionSessionId;
  initiativeId: InitiativeId;
  initiativeVersion: number;
  title: string;
  purpose: string;
  decisionQuestion: string;
  status: Exclude<DecisionSessionStatus, "draft" | "archived">;
  opensAt: string;
  closesAt: string;
  stewardDisplayName: string;
  publishedAt: string;
  closedAt?: string;
  decisionPackage: PublicDecisionSessionPackage;
}

export interface PublicDecisionSessionListItem {
  sessionId: DecisionSessionId;
  title: string;
  status: Exclude<DecisionSessionStatus, "draft" | "archived">;
  opensAt: string;
  closesAt: string;
  publishedAt: string;
}

export interface DecisionSessionMetrics {
  decisionSessionCount: number;
  averagePreparationTimeDays: number | null;
  averageRevisionCountBeforeDecision: number;
  averageAnalysisCountBeforeDecision: number;
  averageProposalCountBeforeDecision: number;
}
