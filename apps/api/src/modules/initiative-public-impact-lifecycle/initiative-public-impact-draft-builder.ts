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
 * body cites real published source ids. Explicit Official Response
 * `no_official_response_received` is a factual outcome, not a missing source.
 * Zero measurable impact remains a publishable conclusion.
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

/** Author-facing titles mapped onto existing canonical section ids. */
const SECTION_TITLES: Record<InitiativePublicImpactReportSectionId, string> = {
  executive_summary: "Author conclusion",
  objectives: "Decision / intended outcome",
  implemented_actions: "What was implemented",
  completed_commitments: "Confirmed impact",
  implementation_progress: "Timeline / milestone result",
  official_responses: "Official response result",
  community_participation: "Community participation (contextual)",
  outstanding_issues: "What remains incomplete / risks",
  lessons_learned: "Unconfirmed / uncertain impact",
  evidence: "Evidence",
  impact_references: "Impact references",
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

function isNoOfficialResponse(
  snapshot: InitiativePublicImpactIntelligenceSnapshot,
): boolean {
  const pkg = snapshot.officialResponsePackageReference;
  if (!pkg) {
    return false;
  }

  return (
    pkg.outcomeKind === "no_official_response_received" ||
    (pkg.responseIds.length === 0 && snapshot.officialResponseSummaries.length === 0)
  );
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

  const noOfficialResponse = isNoOfficialResponse(snapshot);
  const hasMeasurableCompletion = completedTrackings.length > 0 || snapshot.completedCommitmentCount > 0;
  const evidenceSparse = snapshot.evidenceItems.length === 0;

  const executiveSummaryParts = [
    snapshot.initiativeTitle
      ? `This Public Impact Report summarises published Lifecycle outcomes for "${snapshot.initiativeTitle}".`
      : "This Public Impact Report summarises published Lifecycle outcomes for this Initiative.",
    snapshot.officialResponsePackageReference
      ? noOfficialResponse
        ? `Official Responses published outcome: No official response received (package "${snapshot.officialResponsePackageReference.title}").`
        : `It is based on Official Responses package "${snapshot.officialResponsePackageReference.title}".`
      : null,
    snapshot.trackingPackageReference
      ? `Implementation Tracking package "${snapshot.trackingPackageReference.title}" is cited.`
      : null,
    noOfficialResponse
      ? "Zero received official responses is a documented stage result, not a missing source."
      : `${snapshot.completedCommitmentCount} completed commitment/tracking record(s) and ${snapshot.officialResponseSummaries.length} official response(s) are included.`,
    !hasMeasurableCompletion
      ? "Author conclusion (factual): no measurable impact yet / implementation incomplete relative to published Tracking sources. This is a valid publishable result."
      : null,
    evidenceSparse
      ? "Evidence is sparse or unavailable from published sources — treat impact claims as unconfirmed until cited."
      : null,
  ].filter(Boolean);

  const objectivesBody = [
    snapshot.decisionReference?.question
      ? `Collective Decision question: ${snapshot.decisionReference.question}`
      : null,
    snapshot.decisionReference?.summary
      ? `Decision summary: ${snapshot.decisionReference.summary}`
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
        ? `No Approved Action text is attached to Tracking Records in package ${trackingPackageId}. Implementation scope remains Unassigned / To be determined where no action text exists.`
        : "No Implementation Tracking Package is available to list implemented actions.";

  const completedCommitmentsBody =
    completedTrackings.length > 0
      ? `Confirmed from completed Tracking Records (${completedTrackings.length}):\n${completedTrackings
          .map(
            (tracking) =>
              `- ${tracking.trackingId}${tracking.approvedAction ? ` — ${tracking.approvedAction}` : ""} (${tracking.status})`,
          )
          .join("\n")}`
      : `No Tracking Records are marked completed. Confirmed measurable impact from published sources: none yet. Completed commitment/tracking count from sources: ${snapshot.completedCommitmentCount}.`;

  const progressBody =
    snapshot.trackingRecords.length > 0
      ? `Tracking progress snapshot:\n${snapshot.trackingRecords
          .map(
            (tracking) =>
              `- ${tracking.trackingId}: status=${tracking.status}, progress=${tracking.progress ?? "n/a"}`,
          )
          .join("\n")}`
      : trackingPackageId
        ? `Tracking Package ${trackingPackageId} is published but no Tracking Records were loaded — timeline/milestone result cannot be confirmed beyond the package citation.`
        : "No Tracking Records are available for a timeline / milestone result.";

  const noResponseDetail = snapshot.officialResponsePackageReference.noResponseDetail;
  const officialResponsesBody = noOfficialResponse
    ? [
        "Official response result: No official response received.",
        noResponseDetail?.note?.trim() ? `Author note: ${noResponseDetail.note.trim()}` : null,
        noResponseDetail?.contactedOrganizations?.length
          ? `Organizations / recipients contacted: ${noResponseDetail.contactedOrganizations.join(", ")}`
          : null,
        noResponseDetail?.contactedDates?.length
          ? `Contact / follow-up dates: ${noResponseDetail.contactedDates.join(", ")}`
          : null,
        `Cited Official Response Package: ${officialResponsePackageId}.`,
      ]
        .filter(Boolean)
        .join("\n")
    : snapshot.officialResponseSummaries.length > 0
      ? `Received official responses (${snapshot.officialResponseSummaries.length}):\n${snapshot.officialResponseSummaries
          .map((response) => {
            const institution = response.institution || response.organization || "Institution not named";
            return `- ${response.responseId}: ${response.subject} (${institution}; verification=${response.verificationStatus})`;
          })
          .join("\n")}`
      : `Official Response Package ${officialResponsePackageId} is published. No individual response records are attached.`;

  const participation = snapshot.participationStatistics;
  const communityParticipationBody = [
    "Community participation is contextual display only — it is not a Lifecycle progression gate.",
    `Petition signatures: ${participation.signatureCount}`,
    `Initiative support likes: ${participation.supportCount}`,
    `Analysis reactions: ${participation.reactionCount}`,
    `Active Allies: ${participation.activeAllyCount}`,
  ].join("\n");

  const outstandingBody =
    outstandingTrackings.length > 0
      ? `What remains incomplete (${outstandingTrackings.length} Tracking Record(s)):\n${outstandingTrackings
          .map(
            (tracking) =>
              `- ${tracking.trackingId}: status=${tracking.status}, progress=${tracking.progress ?? "n/a"}`,
          )
          .join("\n")}`
      : snapshot.trackingRecords.length > 0
        ? "No outstanding Tracking Records — every loaded Tracking Record is marked completed."
        : "No Tracking Records are available to assess outstanding implementation. Outcome may be: implementation incomplete or not achieved relative to published sources.";

  const lessonsBody = [
    !hasMeasurableCompletion
      ? "Unconfirmed / uncertain: no completed Tracking Records support a confirmed impact claim. Prefer: no measurable impact yet."
      : null,
    evidenceSparse
      ? "Unconfirmed / uncertain: evidence references are insufficient to convert assumptions into facts."
      : null,
    noOfficialResponse
      ? "Institutional reply status is confirmed as No official response received — do not treat that as unavailable."
      : null,
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
      : [
          "Evidence insufficient from published Tracking / Official Response sources.",
          "Do not invent documents or results. Record uncertainty explicitly.",
          packageRefs.length > 0
            ? `Cited lifecycle packages (factual anchors only): ${packageRefs.join(", ")}.`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

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
    noOfficialResponse ? "Official Response outcome: no_official_response_received" : null,
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
      (() => {
        const refs = [
          snapshot.decisionReference?.decisionId,
          snapshot.decisionSessionReference?.sessionId,
          snapshot.petitionReference?.petitionId,
        ].filter((value): value is string => Boolean(value));
        return refs.length > 0 ? refs : packageRefs;
      })(),
    ),
    section(
      "implemented_actions",
      implementedActionsBody,
      trackingPackageId ? [trackingPackageId, ...approvedActions.slice(0, 5)] : packageRefs,
    ),
    section(
      "completed_commitments",
      completedCommitmentsBody,
      commitmentPackageId
        ? [commitmentPackageId, ...completedTrackings.map((tracking) => tracking.trackingId)]
        : completedTrackings.length > 0
          ? completedTrackings.map((tracking) => tracking.trackingId)
          : packageRefs,
    ),
    section(
      "implementation_progress",
      progressBody,
      trackingPackageId
        ? [trackingPackageId, ...snapshot.trackingRecords.map((tracking) => tracking.trackingId)]
        : packageRefs,
    ),
    section(
      "official_responses",
      officialResponsesBody,
      [
        officialResponsePackageId!,
        ...snapshot.officialResponseSummaries.map((response) => response.responseId),
        ...(noOfficialResponse ? ["outcome:no_official_response_received"] : []),
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
        : packageRefs,
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
