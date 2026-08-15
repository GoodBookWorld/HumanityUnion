import type { DecisionId } from "./collective-decision/index.js";
import type { InitiativeId } from "./initiative.js";
import type { PetitionTraceability } from "./initiative-petition-lifecycle.js";
import type { PetitionId, PetitionOutcomeType, PetitionState } from "./petition/index.js";

export interface PublicPetitionIdentity {
  petitionId: PetitionId;
  title: string;
  supportStatus: string;
  lifecycleStatus: PetitionState;
}

export interface PublicPetitionSummary {
  purpose: string;
  followsApprovedDecisionStatement: string;
  publishedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
}

export interface PublicPetitionSubject {
  subjectType: "Initiative";
  initiativeId: InitiativeId;
  title: string;
  summary: string;
  /** Initiative Lifecycle — Part F, Section 3/5. `undefined` for Petitions created before Part F / outside the Initiative Lifecycle. */
  requestStatement?: string;
  expectedOutcome?: string;
  supportingContext?: string;
  keyArguments?: readonly string[];
}

export interface PublicApprovedDecisionContext {
  collectiveDecisionId: DecisionId;
  decisionSummary: string | null;
  approvedOutcomeSummary: string | null;
  approvedResultSummary: string | null;
  initiativeContextSummary: string | null;
  analysisContextSummary: string | null;
  contextAvailable: boolean;
}

export type PublicSupportState = "pending" | "active" | "final";

export interface PublicSupportStatistics {
  supportCount: number;
  supportState: PublicSupportState;
  thresholdDefined: boolean;
  thresholdReached: boolean;
  thresholdProgress: string | null;
  recentActivitySummary: string | null;
}

export interface PublicPetitionOutcomeProjection {
  outcomeType: PetitionOutcomeType;
  explanation: string;
  finalSupportCount: number | null;
}

export interface PublicShareReference {
  url: string | null;
  available: boolean;
  sharingNote: string;
}

export interface PublicParticipationEntryGuidance {
  registrationRequired: boolean;
  signingAvailable: boolean;
  observationAvailable: boolean;
  entryIntent: string;
  registrationGatewayMessage: string;
  viewingNote: string;
  sharingNote: string;
  workspacePath: string;
}

/**
 * Initiative Lifecycle — Part E, Section 11 (Petition Integration).
 *
 * "Petition automatically receives Published Revision, Change Summary, and
 * Revision metadata. No duplicated editing. Petition becomes the public
 * representation of the approved Revision."
 *
 * This is purely additive, informational context surfaced alongside the
 * Petition's own (unrelated, pre-existing) Collective Decision subject —
 * it does NOT replace `approvedDecisionContext` above, does NOT gate
 * Petition creation, and is `null` whenever the Initiative has not yet
 * published a Revision (Part E is additive to the pre-existing Petition
 * domain, which predates the 12-stage Lifecycle and is keyed off a
 * `CollectiveDecision`, not a Revision).
 */
export interface PublicPetitionRevisionContext {
  readonly revisionId: string;
  readonly version: number;
  readonly revisionSummary: string;
  readonly publishedAt: string;
  readonly authorDisplayName: string;
  readonly changeCount: number;
  readonly proposalIds: readonly string[];
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 *
 * Three independent counters — Participants (everyone who signed, the
 * Humanity Union platform's baseline participation identity),
 * Members (the subset of signers who additionally hold active Member
 * status), and Visitors (unregistered civic-interest signals, see
 * {@link PetitionVisitorSignalRecord} — never a `Signature`, never merged
 * into the other two). None of these is ever described as legally
 * binding — see {@link PETITION_PARTICIPATION_TRANSPARENCY_NOTE}.
 */
export interface PublicPetitionSupportBreakdown {
  readonly participantSignatures: number;
  readonly memberSignatures: number;
  readonly visitorSignals: number;
}

export const PETITION_PARTICIPATION_TRANSPARENCY_NOTE =
  "Signing this Petition is a form of civic participation on Humanity Union. It is not a legally binding petition and does not, by itself, create any legal or governmental obligation.";

export interface PublicPetitionProjection {
  petitionIdentity: PublicPetitionIdentity;
  petitionSummary: PublicPetitionSummary;
  petitionSubject: PublicPetitionSubject;
  approvedDecisionContext: PublicApprovedDecisionContext;
  relatedRevisionContext: PublicPetitionRevisionContext | null;
  publicSupportStatistics: PublicSupportStatistics;
  /** Initiative Lifecycle — Part F, Section 7/8. `null` until the underlying Petition has resolved Participant/Member/Visitor counts (always populated once publicly visible). */
  supportBreakdown: PublicPetitionSupportBreakdown;
  /** Initiative Lifecycle — Part F, Section 9 (Traceability). `null` only for Petitions created before Part F / outside the Initiative Lifecycle. */
  traceability: PetitionTraceability | null;
  /**
   * Initiative Lifecycle — Part F, Section 7/8. `true` only when the
   * requesting viewer is a signed-in Participant with an `Active`
   * Signature on this Petition — resolved server-side from the request's
   * own identity, exactly like `InitiativeRevisionReactionSummary.
   * currentUserReaction`, so the client never needs to know or send its
   * own participant id. Always `false` for anonymous/unauthenticated
   * viewers (never inferred from a body-supplied id).
   */
  viewerHasSigned: boolean;
  participationTransparencyNote: string;
  petitionOutcome: PublicPetitionOutcomeProjection | null;
  shareReference: PublicShareReference;
  participationEntryGuidance: PublicParticipationEntryGuidance;
}
