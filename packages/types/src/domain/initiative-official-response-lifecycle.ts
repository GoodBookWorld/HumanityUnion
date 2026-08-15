import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeDescription, InitiativeId, InitiativeTitle } from "./initiative.js";
import type { MemberId } from "./member.js";
import type { OfficialResponseType, OfficialResponseVerificationState } from "./official-response.js";

/**
 * Initiative Lifecycle — Part K, Section 2. Read-only reference into the
 * published Implementation Tracking Package — Official Responses' upstream
 * execution context.
 */
export interface InitiativeOfficialResponseTrackingPackageReference {
  readonly packageId: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly trackingIds: readonly string[];
  readonly commitmentPackageId: string | null;
  readonly decisionId: InitiativeCollectiveDecisionId | null;
}

/**
 * Initiative Lifecycle — Part K, Section 2. One Tracking Record summarised
 * for Response Sources (Approved Action / progress / evidence).
 */
export interface InitiativeOfficialResponseTrackingRecordReference {
  readonly trackingId: string;
  readonly commitmentId: string;
  readonly approvedAction: string | null;
  readonly participantId: string;
  readonly status: string;
  readonly progress: number | null;
  readonly evidenceReferences: readonly string[];
  readonly summary: string;
}

/**
 * Initiative Lifecycle — Part K, Section 4. Deterministic advisory check —
 * never creates or verifies responses automatically.
 */
export interface InitiativeOfficialResponseConsistencyCheck {
  readonly checkId: string;
  readonly label: string;
  readonly status: "ok" | "warning";
  readonly detail: string;
}

/**
 * Initiative Lifecycle — Part K, Section 2/3. Read-only aggregation of
 * Tracking + Decision provenance for the Response Builder.
 */
export interface InitiativeOfficialResponseIntelligenceSnapshot {
  readonly initiativeId: InitiativeId;
  readonly generatedAt: string;
  readonly initiativeTitle: InitiativeTitle;
  readonly initiativeDescription: InitiativeDescription;
  readonly trackingPackageReference: InitiativeOfficialResponseTrackingPackageReference | null;
  readonly trackingRecords: readonly InitiativeOfficialResponseTrackingRecordReference[];
  readonly completedCommitmentCount: number;
  readonly activeAllyCount: number;
  readonly decisionId: InitiativeCollectiveDecisionId | null;
  readonly consistencyChecks: readonly InitiativeOfficialResponseConsistencyCheck[];
  /** `false` until a published Tracking Package exists. */
  readonly isTrackingPackageAvailable: boolean;
  readonly isEmpty: boolean;
}

/**
 * Initiative Lifecycle — Part K, Section 3/6. One Response Candidate —
 * generated deterministically, edited by the Author, never itself a public
 * record until Package Publish.
 */
export interface InitiativeOfficialResponseCandidate {
  candidateId: string;
  institution: string;
  organization: string;
  responseType: OfficialResponseType;
  subject: string;
  receivedAt: string;
  summary: string;
  referenceNumber: string;
  relatedActions: string[];
  relatedCommitmentIds: string[];
  relatedTrackingIds: string[];
  /** Shared Document IDs from Secure Attachments (Part K §7). */
  documentIds: string[];
  links: string[];
  verificationStatus: OfficialResponseVerificationState;
  notes: string;
  references: string[];
}

/**
 * Initiative Lifecycle — Part K, Section 5. Author Workspace working draft.
 */
export interface InitiativeOfficialResponseLifecycleDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  summary: string;
  trackingPackageId: string | null;
  candidates: InitiativeOfficialResponseCandidate[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeOfficialResponseLifecycleDraftContext {
  draft: InitiativeOfficialResponseLifecycleDraft | null;
  intelligenceSnapshot: InitiativeOfficialResponseIntelligenceSnapshot;
  /** Non-null once an Official Response Package has been published. */
  publishedPackageId: string | null;
}

/**
 * Initiative Lifecycle — Part K, Section 9. Permanent answer to
 * "which implementation action produced this official response?".
 */
export interface OfficialResponseTraceability {
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly petitionId: string | null;
  readonly petitionVersion: number | null;
  readonly decisionSessionId: string | null;
  readonly decisionSessionVersion: number | null;
  readonly decisionId: string | null;
  readonly trackingPackageId: string | null;
  readonly relatedTrackingIds: readonly string[];
  readonly relatedCommitmentIds: readonly string[];
  readonly relatedActions: readonly string[];
}

/**
 * One published Official Response entry inside the Lifecycle Package
 * (Part K §6/8). Distinct from CAP/delivery TASK-041 `OfficialResponse`
 * records — this is the Lifecycle Stage Workspace artifact.
 */
export interface InitiativeOfficialResponseRecord {
  responseId: string;
  packageId: string;
  initiativeId: InitiativeId;
  institution: string;
  organization: string;
  responseType: OfficialResponseType;
  subject: string;
  receivedAt: string;
  publishedAt: string;
  summary: string;
  referenceNumber: string;
  relatedActions: string[];
  relatedCommitmentIds: string[];
  relatedTrackingIds: string[];
  documentIds: string[];
  links: string[];
  verificationStatus: OfficialResponseVerificationState;
  notes: string;
  references: string[];
  traceability: OfficialResponseTraceability;
  createdAt: string;
  updatedAt: string;
}

/**
 * Initiative Lifecycle — Part K. Published package grouping Official
 * Response records prepared from Implementation Tracking.
 */
export interface InitiativeOfficialResponsePackage {
  packageId: string;
  initiativeId: InitiativeId;
  trackingPackageId: string | null;
  decisionId: InitiativeCollectiveDecisionId | null;
  stewardId: MemberId;
  title: string;
  summary: string;
  responseIds: string[];
  status: "published";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}
