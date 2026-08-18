import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseIntelligenceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part K, Section 3 (Response Candidate Builder).
 * Deterministic generation of one Response Candidate per Tracking Record
 * from the published Implementation Tracking Package (Part J). Never
 * invents an institution, organization, or any other institutional fact —
 * every candidate's `institution`/`organization` starts empty, requiring
 * the Author to fill it in before Publish (see the publish validator).
 */
export interface GeneratedOfficialResponseDraftContent {
  readonly title: string;
  readonly summary: string;
  readonly trackingPackageId: string | null;
  /** Generate never invents an official reply — scaffolds are Author-editable placeholders. */
  readonly outcomeKind: "responses_received";
  readonly candidates: readonly InitiativeOfficialResponseCandidate[];
}

export interface OfficialResponseDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativeOfficialResponseIntelligenceSnapshot,
  ): Promise<GeneratedOfficialResponseDraftContent>;
}

function receivedAtFromGeneratedAt(generatedAt: string): string {
  return generatedAt.slice(0, 10);
}

function buildCandidateFromTracking(
  tracking: InitiativeOfficialResponseIntelligenceSnapshot["trackingRecords"][number],
  initiativeTitle: string,
  trackingPackageId: string | null,
  receivedAt: string,
  index: number,
): InitiativeOfficialResponseCandidate {
  const approvedAction = tracking.approvedAction ?? null;

  return {
    candidateId: `official-response-candidate-${index}`,
    institution: "",
    organization: "",
    responseType: "other",
    subject: `Response regarding: ${approvedAction ?? initiativeTitle}`,
    receivedAt,
    summary: "Record the official response related to this implementation action.",
    referenceNumber: "",
    relatedActions: approvedAction ? [approvedAction] : [],
    relatedCommitmentIds: [tracking.commitmentId],
    relatedTrackingIds: [tracking.trackingId],
    documentIds: [],
    links: [],
    verificationStatus: "pending",
    notes: "",
    references: trackingPackageId
      ? [`Tracking ${tracking.trackingId}`, trackingPackageId]
      : [`Tracking ${tracking.trackingId}`],
  };
}

function buildGeneralCandidate(
  initiativeTitle: string,
  trackingPackageId: string | null,
  receivedAt: string,
): InitiativeOfficialResponseCandidate {
  return {
    candidateId: "official-response-candidate-0",
    institution: "",
    organization: "",
    responseType: "other",
    subject: `Response regarding: ${initiativeTitle}`,
    receivedAt,
    summary: "Record the official response related to this implementation action.",
    referenceNumber: "",
    relatedActions: [],
    relatedCommitmentIds: [],
    relatedTrackingIds: [],
    documentIds: [],
    links: [],
    verificationStatus: "pending",
    notes: "",
    references: trackingPackageId ? [trackingPackageId] : [],
  };
}

function generateDeterministicOfficialResponseDraftContent(
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot,
): GeneratedOfficialResponseDraftContent {
  const trackingPackageReference = snapshot.trackingPackageReference;

  const title = snapshot.initiativeTitle
    ? `Official Responses: ${snapshot.initiativeTitle}`
    : "Official Responses";

  const summary = trackingPackageReference?.summary ?? "";

  if (!trackingPackageReference) {
    return { title, summary, trackingPackageId: null, outcomeKind: "responses_received", candidates: [] };
  }

  const receivedAt = receivedAtFromGeneratedAt(snapshot.generatedAt);

  // Every Tracking Record with visible progress or an active/completed
  // status becomes its own Response Candidate scaffold (empty institution —
  // never an invented official statement). A brand-new Tracking Package with
  // every Record still at "Preparation"/0% falls back to one general
  // Candidate for the Initiative as a whole. Authors may clear candidates and
  // publish an explicit No Response outcome instead.
  const eligibleTrackings = snapshot.trackingRecords.filter(
    (tracking) => (tracking.progress ?? 0) > 0 || tracking.status === "completed" || tracking.status === "active",
  );

  if (eligibleTrackings.length === 0) {
    return {
      title,
      summary,
      trackingPackageId: trackingPackageReference.packageId,
      outcomeKind: "responses_received",
      candidates: [buildGeneralCandidate(snapshot.initiativeTitle, trackingPackageReference.packageId, receivedAt)],
    };
  }

  const candidates = eligibleTrackings.map((tracking, index) =>
    buildCandidateFromTracking(
      tracking,
      snapshot.initiativeTitle,
      trackingPackageReference.packageId,
      receivedAt,
      index,
    ),
  );

  return {
    title,
    summary,
    trackingPackageId: trackingPackageReference.packageId,
    outcomeKind: "responses_received",
    candidates,
  };
}

export const deterministicOfficialResponseDraftProvider: OfficialResponseDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicOfficialResponseDraftContent(snapshot)),
};

export function resolveOfficialResponseDraftProvider(): OfficialResponseDraftProvider {
  return deterministicOfficialResponseDraftProvider;
}

export async function generateOfficialResponseDraftContent(
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot,
): Promise<GeneratedOfficialResponseDraftContent> {
  const provider = resolveOfficialResponseDraftProvider();
  return provider.generateDraftContent(snapshot);
}
