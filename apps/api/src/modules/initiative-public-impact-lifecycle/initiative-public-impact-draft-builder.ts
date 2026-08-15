import type {
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactReportSection,
  InitiativePublicImpactReportSectionId,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part L, Section 3 (Impact Builder). Deterministic
 * generation of the Public Impact Report title + sections from the
 * intelligence snapshot only. Never invents achievements — every non-empty
 * body cites real published source ids.
 */
export interface GeneratedPublicImpactDraftContent {
  readonly title: string;
  readonly officialResponsePackageId: string | null;
  readonly trackingPackageId: string | null;
  readonly commitmentPackageId: string | null;
  readonly decisionId: string | null;
  readonly sections: readonly InitiativePublicImpactReportSection[];
  readonly participationStatistics: InitiativePublicImpactParticipationStatistics;
}

export interface PublicImpactDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativePublicImpactIntelligenceSnapshot,
  ): Promise<GeneratedPublicImpactDraftContent>;
}

const SECTION_TITLES: Record<InitiativePublicImpactReportSectionId, string> = {
  executive_summary: "Executive Summary",
  objectives: "Objectives",
  implemented_actions: "Implemented Actions",
  completed_commitments: "Completed Commitments",
  implementation_progress: "Implementation Progress",
  official_responses: "Official Responses",
  community_participation: "Community Participation",
  outstanding_issues: "Outstanding Issues",
  lessons_learned: "Lessons Learned",
  evidence: "Evidence",
  impact_references: "Impact References",
};

function section(
  sectionId: InitiativePublicImpactReportSectionId,
  body: string,
  evidenceReferences: readonly string[],
): InitiativePublicImpactReportSection {
  const trimmed = body.trim();

  return {
    sectionId,
    title: SECTION_TITLES[sectionId],
    body: trimmed,
    evidenceReferences: trimmed ? [...evidenceReferences] : [],
  };
}

function generateDeterministicPublicImpactDraftContent(
  snapshot: InitiativePublicImpactIntelligenceSnapshot,
): GeneratedPublicImpactDraftContent {
  const title = snapshot.initiativeTitle
    ? `Public Impact Report: ${snapshot.initiativeTitle}`
    : "Public Impact Report";

  const officialResponsePackageId = snapshot.officialResponsePackageReference?.packageId ?? null;
  const trackingPackageId = snapshot.trackingPackageReference?.packageId ?? null;
  const commitmentPackageId = snapshot.commitmentPackageReference?.packageId ?? null;
  const decisionId = snapshot.decisionReference?.decisionId ?? null;

  if (!snapshot.officialResponsePackageReference) {
    return {
      title,
      officialResponsePackageId: null,
      trackingPackageId,
      commitmentPackageId,
      decisionId,
      sections: (Object.keys(SECTION_TITLES) as InitiativePublicImpactReportSectionId[]).map((sectionId) =>
        section(sectionId, "", []),
      ),
      participationStatistics: { ...snapshot.participationStatistics },
    };
  }

  const packageRefs = [
    officialResponsePackageId,
    trackingPackageId,
    commitmentPackageId,
    decisionId,
  ].filter((value): value is string => Boolean(value));

  const completedTrackings = snapshot.trackingRecords.filter((tracking) => tracking.status === "completed");
  const outstandingTrackings = snapshot.trackingRecords.filter(
    (tracking) => tracking.status !== "completed",
  );
  const approvedActions = [
    ...new Set(
      snapshot.trackingRecords
        .map((tracking) => tracking.approvedAction)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const executiveSummaryParts = [
    snapshot.initiativeTitle
      ? `This Public Impact Report summarises published Lifecycle outcomes for "${snapshot.initiativeTitle}".`
      : "This Public Impact Report summarises published Lifecycle outcomes for this Initiative.",
    snapshot.officialResponsePackageReference
      ? `It is based on Official Responses package "${snapshot.officialResponsePackageReference.title}".`
      : null,
    snapshot.trackingPackageReference
      ? `Implementation Tracking package "${snapshot.trackingPackageReference.title}" is cited.`
      : null,
    `${snapshot.completedCommitmentCount} completed commitment/tracking record(s) and ${snapshot.officialResponseSummaries.length} official response(s) are included.` ,
  ].filter(Boolean);

  const objectivesBody = [
    snapshot.decisionReference?.question
      ? `Collective Decision question: ${snapshot.decisionReference.question}`
      : null,
    snapshot.decisionSessionReference?.summary
      ? `Decision Session focus: ${snapshot.decisionSessionReference.summary}`
      : null,
    snapshot.petitionReference?.summary
      ? `Petition summary: ${snapshot.petitionReference.summary}`
      : null,
    snapshot.initiativeDescription ? `Initiative description: ${snapshot.initiativeDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const implementedActionsBody =
    approvedActions.length > 0
      ? `Published Approved Actions referenced by Tracking Records:\n${approvedActions.map((action) => `- ${action}`).join("\n")}`
      : trackingPackageId
        ? `No Approved Action text is attached to Tracking Records in package ${trackingPackageId}.`
        : "";

  const completedCommitmentsBody =
    completedTrackings.length > 0
      ? `Completed Tracking Records (${completedTrackings.length}):\n${completedTrackings
          .map(
            (tracking) =>
              `- ${tracking.trackingId}${tracking.approvedAction ? ` — ${tracking.approvedAction}` : ""} (${tracking.status})`,
          )
          .join("\n")}`
      : `No Tracking Records are marked completed. Completed commitment/tracking count from sources: ${snapshot.completedCommitmentCount}.`;

  const progressBody =
    snapshot.trackingRecords.length > 0
      ? `Tracking progress snapshot:\n${snapshot.trackingRecords
          .map(
            (tracking) =>
              `- ${tracking.trackingId}: status=${tracking.status}, progress=${tracking.progress ?? "n/a"}`,
          )
          .join("\n")}`
      : trackingPackageId
        ? `Tracking Package ${trackingPackageId} is published but no Tracking Records were loaded.`
        : "";

  const officialResponsesBody =
    snapshot.officialResponseSummaries.length > 0
      ? `Published Official Responses (${snapshot.officialResponseSummaries.length}):\n${snapshot.officialResponseSummaries
          .map((response) => {
            const institution = response.institution || response.organization || "Institution not named";
            return `- ${response.responseId}: ${response.subject} (${institution}; verification=${response.verificationStatus})`;
          })
          .join("\n")}`
      : `Official Response Package ${officialResponsePackageId} is published with no response summaries loaded.`;

  const participation = snapshot.participationStatistics;
  const communityParticipationBody = [
    `Petition signatures: ${participation.signatureCount}`,
    `Initiative support likes: ${participation.supportCount}`,
    `Analysis reactions: ${participation.reactionCount}`,
    `Active Allies: ${participation.activeAllyCount}`,
  ].join("\n");

  const outstandingBody =
    outstandingTrackings.length > 0
      ? `Outstanding Tracking Records (${outstandingTrackings.length}):\n${outstandingTrackings
          .map(
            (tracking) =>
              `- ${tracking.trackingId}: status=${tracking.status}, progress=${tracking.progress ?? "n/a"}`,
          )
          .join("\n")}`
      : snapshot.trackingRecords.length > 0
        ? "No outstanding Tracking Records — every loaded Tracking Record is marked completed."
        : "No Tracking Records are available to assess outstanding implementation.";

  const lessonsBody = [
    snapshot.analysisReference?.summary
      ? `Analysis summary cited: ${snapshot.analysisReference.summary}`
      : null,
    snapshot.revisionReference?.summary
      ? `Revision summary cited: ${snapshot.revisionReference.summary}`
      : null,
    snapshot.trackingPackageReference?.summary
      ? `Tracking Package summary cited: ${snapshot.trackingPackageReference.summary}`
      : null,
    snapshot.officialResponsePackageReference.summary
      ? `Official Responses summary cited: ${snapshot.officialResponsePackageReference.summary}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const evidenceBody =
    snapshot.evidenceItems.length > 0
      ? `Evidence references drawn from published Tracking and Official Response sources:\n${snapshot.evidenceItems
          .map((item) => `- ${item}`)
          .join("\n")}`
      : "No evidence references were available from published Tracking or Official Response sources.";

  const impactReferencesBody = [
    snapshot.analysisReference ? `Analysis: ${snapshot.analysisReference.analysisId}` : null,
    snapshot.revisionReference ? `Revision: ${snapshot.revisionReference.revisionId}` : null,
    snapshot.petitionReference ? `Petition: ${snapshot.petitionReference.petitionId}` : null,
    snapshot.decisionSessionReference
      ? `Decision Session: ${snapshot.decisionSessionReference.sessionId}`
      : null,
    decisionId ? `Collective Decision: ${decisionId}` : null,
    commitmentPackageId ? `Commitment Package: ${commitmentPackageId}` : null,
    trackingPackageId ? `Tracking Package: ${trackingPackageId}` : null,
    officialResponsePackageId ? `Official Response Package: ${officialResponsePackageId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const trackingEvidenceRefs = [
    ...packageRefs,
    ...completedTrackings.map((tracking) => tracking.trackingId),
  ];

  const sections: InitiativePublicImpactReportSection[] = [
    section("executive_summary", executiveSummaryParts.join(" "), packageRefs),
    section(
      "objectives",
      objectivesBody,
      [
        snapshot.decisionReference?.decisionId,
        snapshot.decisionSessionReference?.sessionId,
        snapshot.petitionReference?.petitionId,
      ].filter((value): value is string => Boolean(value)),
    ),
    section(
      "implemented_actions",
      implementedActionsBody,
      trackingPackageId ? [trackingPackageId, ...approvedActions.slice(0, 5)] : [],
    ),
    section(
      "completed_commitments",
      completedCommitmentsBody,
      commitmentPackageId
        ? [commitmentPackageId, ...completedTrackings.map((tracking) => tracking.trackingId)]
        : completedTrackings.map((tracking) => tracking.trackingId),
    ),
    section(
      "implementation_progress",
      progressBody,
      trackingPackageId
        ? [trackingPackageId, ...snapshot.trackingRecords.map((tracking) => tracking.trackingId)]
        : [],
    ),
    section(
      "official_responses",
      officialResponsesBody,
      [
        officialResponsePackageId!,
        ...snapshot.officialResponseSummaries.map((response) => response.responseId),
      ],
    ),
    section(
      "community_participation",
      communityParticipationBody,
      [
        snapshot.petitionReference?.petitionId,
        snapshot.analysisReference?.analysisId,
        officialResponsePackageId,
      ].filter((value): value is string => Boolean(value)),
    ),
    section(
      "outstanding_issues",
      outstandingBody,
      trackingPackageId
        ? [trackingPackageId, ...outstandingTrackings.map((tracking) => tracking.trackingId)]
        : [],
    ),
    section(
      "lessons_learned",
      lessonsBody,
      [
        snapshot.analysisReference?.analysisId,
        snapshot.revisionReference?.revisionId,
        trackingPackageId,
        officialResponsePackageId,
      ].filter((value): value is string => Boolean(value)),
    ),
    section(
      "evidence",
      evidenceBody,
      snapshot.evidenceItems.length > 0 ? [...snapshot.evidenceItems] : packageRefs,
    ),
    section("impact_references", impactReferencesBody, packageRefs.length > 0 ? packageRefs : trackingEvidenceRefs),
  ];

  return {
    title,
    officialResponsePackageId,
    trackingPackageId,
    commitmentPackageId,
    decisionId,
    sections,
    participationStatistics: { ...snapshot.participationStatistics },
  };
}

export const deterministicPublicImpactDraftProvider: PublicImpactDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicPublicImpactDraftContent(snapshot)),
};

export function resolvePublicImpactDraftProvider(): PublicImpactDraftProvider {
  return deterministicPublicImpactDraftProvider;
}

export async function generatePublicImpactDraftContent(
  snapshot: InitiativePublicImpactIntelligenceSnapshot,
): Promise<GeneratedPublicImpactDraftContent> {
  const provider = resolvePublicImpactDraftProvider();
  return provider.generateDraftContent(snapshot);
}
