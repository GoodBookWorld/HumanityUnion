import type {
  DecisionSessionId,
  DecisionSessionStatus,
  DecisionSessionStructuredContent,
} from "./decision-session.js";
import type { DecisionSessionTraceability } from "./initiative-decision-session-lifecycle.js";
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

/**
 * Initiative Lifecycle — Part F, Section 11 (Decision Session
 * Integration). "Decision Session automatically receives: Published
 * Petition, Signature statistics, Revision metadata, Proposal references.
 * No duplicated editing." Purely additive, informational context — `null`
 * whenever the Initiative has no Published Petition yet.
 */
export interface PublicDecisionSessionPetitionContext {
  readonly petitionId: string;
  readonly title: string;
  readonly publishedAt: string | null;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
  readonly revisionVersion: number | null;
  readonly proposalIds: readonly string[];
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
  relatedPetitionContext: PublicDecisionSessionPetitionContext | null;
  /** Initiative Lifecycle — Part G, Section 6/8. Null for pre-Part-G sessions. */
  structuredContent: DecisionSessionStructuredContent | null;
  /** Initiative Lifecycle — Part G, Section 9. Null for pre-Part-G sessions. */
  traceability: DecisionSessionTraceability | null;
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
