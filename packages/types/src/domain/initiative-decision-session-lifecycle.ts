import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type {
  InitiativeLifecycleConsistencyCivic,
  InitiativeLifecycleConsistencyParams,
  InitiativeLifecycleConsistencyStatus,
} from "./initiative-lifecycle-consistency.js";
import type { MemberId } from "./member.js";

/**
 * Initiative Lifecycle — Part G, Section 2/9 (Decision Sources /
 * Traceability). Read-only reference into the Published Petition that
 * produced this Decision Session — the stage's one mandatory source.
 */
export interface InitiativeDecisionSessionPetitionReference {
  readonly petitionId: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string | null;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
}

/** Read-only reference into the Published Revision frozen into the Petition. */
export interface InitiativeDecisionSessionRevisionReference {
  readonly revisionId: string;
  readonly version: number;
  readonly revisionSummary: string;
  readonly publishedAt: string;
  readonly title: InitiativeTitle;
  readonly description: InitiativeDescription;
}

/** Read-only reference into the Author's Published Collaborative Analysis. */
export interface InitiativeDecisionSessionAnalysisReference {
  readonly analysisId: string;
  readonly title: string;
  readonly summary: string;
  readonly initiativeVersion: number;
}

/** Read-only reference into one Published Improvement Proposal. */
export interface InitiativeDecisionSessionProposalReference {
  readonly proposalId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "accepted" | "partially_accepted";
}

/** Open collaboration comment summarised for Decision Sources (read-only). */
export interface InitiativeDecisionSessionOpenCommentReference {
  readonly commentId: string;
  readonly excerpt: string;
  readonly authorDisplayName: string;
  readonly createdAt: string;
}

/**
 * Initiative Lifecycle — Part G, Section 7 (Active Allies). Advisory
 * recommendation submitted by an Active Ally — never itself the published
 * Decision Session content. Only the Author edits the published Decision.
 */
export type InitiativeDecisionSessionRecommendationKind =
  | "option"
  | "risk"
  | "timeline"
  | "role"
  | "implementation_concern"
  | "general";

export interface InitiativeDecisionSessionRecommendation {
  recommendationId: string;
  initiativeId: InitiativeId;
  authorParticipantId: MemberId;
  kind: InitiativeDecisionSessionRecommendationKind;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Finite Decision Session consistency check IDs (08E.9b). */
export type InitiativeDecisionSessionConsistencyCheckId =
  | "petition-available"
  | "revision-available"
  | "analysis-available"
  | "proposal-references"
  | "ally-recommendations";

/**
 * Initiative Lifecycle — Part G, Section 4 (Decision Assistant).
 * Deterministic, read-only advisory check — never an automatic edit.
 */
export interface InitiativeDecisionSessionConsistencyCheck {
  readonly checkId: InitiativeDecisionSessionConsistencyCheckId;
  /**
   * @deprecated 08E.9c — transport-only compatibility English chrome.
   * Prefer Web localization of `checkId`. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly label: string;
  readonly status: InitiativeLifecycleConsistencyStatus;
  /**
   * @deprecated 08E.9c — transport-only compatibility English body.
   * Prefer `params` + Web presentation. Remove after coordinated
   * staging acceptance + production rollout of semantic Web/API.
   */
  readonly detail: string;
  readonly params: InitiativeLifecycleConsistencyParams;
  readonly civic?: InitiativeLifecycleConsistencyCivic;
}

/**
 * Initiative Lifecycle — Part G, Section 2/3 (Decision Sources / Decision
 * Intelligence Builder). All read-only aggregation of upstream Lifecycle
 * stages — never itself an editable record. Deterministically rebuilt on
 * every "Generate" action.
 */
export interface InitiativeDecisionSessionIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly petitionReference: InitiativeDecisionSessionPetitionReference | null;
  readonly revisionReference: InitiativeDecisionSessionRevisionReference | null;
  readonly analysisReference: InitiativeDecisionSessionAnalysisReference | null;
  readonly proposalReferences: readonly InitiativeDecisionSessionProposalReference[];
  readonly openComments: readonly InitiativeDecisionSessionOpenCommentReference[];
  readonly allyRecommendations: readonly InitiativeDecisionSessionRecommendation[];
  readonly activeAllyCount: number;
  readonly consistencyChecks: readonly InitiativeDecisionSessionConsistencyCheck[];
  /** `false` until the Initiative has a Published Petition — the Decision Session's one mandatory source. */
  readonly isPetitionAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part G, Section 3/6 (Decision Builder / Structured
 * Decision Model). The Author Workspace's working draft — freely edited
 * before Publish, never itself a public record.
 */
export interface InitiativeDecisionSessionDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  decisionQuestion: string;
  decisionContext: string;
  objectives: string[];
  options: string[];
  supportingArguments: string[];
  risks: string[];
  dependencies: string[];
  requiredResources: string[];
  suggestedTimeline: string;
  suggestedParticipants: string[];
  suggestedResponsibleRoles: string[];
  unresolvedQuestions: string[];
  /** Mapped into `DecisionSession.purpose` on publish. */
  purpose: string;
  opensAt: string;
  closesAt: string;
  petitionId: string | null;
  revisionId: string | null;
  revisionVersion: number | null;
  analysisId: string | null;
  analysisVersion: number | null;
  proposalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeDecisionSessionDraftContext {
  draft: InitiativeDecisionSessionDraft | null;
  intelligenceSnapshot: InitiativeDecisionSessionIntelligenceSnapshot;
  recommendations: readonly InitiativeDecisionSessionRecommendation[];
  /** Non-null once a Decision Session has been published for this Initiative. */
  publishedSessionId: string | null;
}

/**
 * Initiative Lifecycle — Part G, Section 9 (Traceability). Permanently
 * attached to the published `DecisionSession` — the platform's durable
 * answer to "which Petition produced this Decision Session?".
 */
export interface DecisionSessionTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string;
  readonly revisionVersion: number;
  readonly petitionId: string;
  readonly petitionVersion: number;
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
}
