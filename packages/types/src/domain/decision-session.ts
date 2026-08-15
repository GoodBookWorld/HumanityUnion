import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type { DecisionSessionTraceability } from "./initiative-decision-session-lifecycle.js";
import type { InitiativeId } from "./initiative.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";
import type { InitiativeVersionRevisionId } from "./initiative-version-revision.js";
import type { MemberId } from "./member.js";
import type { PetitionId } from "./petition/index.js";

export type DecisionSessionId = string;

/** Structured decision preparation lifecycle (Collective Intelligence). */
export type DecisionSessionStatus = "draft" | "published" | "closed" | "archived";

/** Reference-only decision package captured at publish time. */
export interface DecisionSessionPackageReferences {
  revisionIds: InitiativeVersionRevisionId[];
  analysisIds: InitiativeCollaborativeAnalysisId[];
  proposalIds: InitiativeImprovementProposalId[];
  /**
   * Initiative Lifecycle — Part F, Section 11 (Decision Session
   * Integration). The Published Petition this session's decision is built
   * on top of — `null` for any Decision Session published before Part F,
   * or for an Initiative whose Petition was never part of the 12-stage
   * Lifecycle.
   */
  petitionId?: PetitionId | null;
}

/**
 * Initiative Lifecycle — Part G, Section 6 (Structured Decision Model).
 * Independently editable sections prepared in the Author Workspace and
 * frozen onto the published Decision Session. Optional for sessions
 * published before Part G.
 */
export interface DecisionSessionStructuredContent {
  decisionContext: string;
  objectives: readonly string[];
  options: readonly string[];
  supportingArguments: readonly string[];
  risks: readonly string[];
  dependencies: readonly string[];
  requiredResources: readonly string[];
  suggestedTimeline: string;
  suggestedParticipants: readonly string[];
  suggestedResponsibleRoles: readonly string[];
  unresolvedQuestions: readonly string[];
}

export interface DecisionSession {
  sessionId: DecisionSessionId;
  initiativeId: InitiativeId;
  initiativeVersion: number;
  stewardId: MemberId;
  title: string;
  purpose: string;
  decisionQuestion: string;
  status: DecisionSessionStatus;
  opensAt: string;
  closesAt: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  closedAt?: string;
  packageReferences?: DecisionSessionPackageReferences;
  /** Initiative Lifecycle — Part G, Section 6. */
  structuredContent?: DecisionSessionStructuredContent | null;
  /** Initiative Lifecycle — Part G, Section 9. */
  traceability?: DecisionSessionTraceability | null;
}

export interface DecisionSessionEligibility {
  eligible: boolean;
  reasons: string[];
  initiativeVersion: number;
  publishedAnalysisCount: number;
  stewardReviewedProposalCount: number;
  /** Initiative Lifecycle — Part F, Section 11. `true` once a publicly visible Petition (Published/Open/Closed/Archived) exists for the Initiative. */
  hasPublishedPetition: boolean;
}
