import type {
  InitiativeCivicArchiveCompleteness,
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveParticipationStatistics,
  InitiativeCivicArchiveSection,
  InitiativeCivicArchiveSectionId,
  InitiativeCivicArchiveTimelineEntry,
  InitiativeLifecycleStageId,
} from "@hu/types";
import { INITIATIVE_CIVIC_ARCHIVE_SECTION_IDS } from "@hu/types";

/**
 * Initiative Lifecycle — Part M, Section 3 (Archive Builder). Deterministic
 * assembly of sections + timeline + suggested final fields from published
 * sources only. Never invents facts. Missing optional stages yield honest
 * empty/partial sections — never a crash. Author may edit only the four
 * final contribution fields after Generate.
 */
export interface GeneratedCivicArchiveDraftContent {
  readonly finalArchiveTitle: string;
  readonly finalSummary: string;
  readonly lessonsLearned: string;
  readonly knowledgeContribution: string;
  readonly publicImpactReportId: string | null;
  readonly sections: readonly InitiativeCivicArchiveSection[];
  readonly timeline: readonly InitiativeCivicArchiveTimelineEntry[];
  readonly completeness: InitiativeCivicArchiveCompleteness;
  readonly participationStatistics: InitiativeCivicArchiveParticipationStatistics;
}

const SECTION_TITLES: Record<InitiativeCivicArchiveSectionId, string> = {
  archive_overview: "Archive Overview",
  original_initiative: "Original Initiative",
  discussion_and_participation: "Discussion and Participation",
  collaborative_analysis: "Collaborative Analysis",
  improvement_proposals: "Improvement Proposals",
  revision_and_change_history: "Revision and Change History",
  petition_and_public_participation: "Petition and Public Participation",
  decision_session: "Decision Session",
  collective_decision: "Collective Decision",
  approved_actions: "Approved Actions",
  implementation_commitments: "Implementation Commitments",
  implementation_tracking: "Implementation Tracking",
  official_responses: "Official Responses",
  public_impact: "Public Impact",
  final_results: "Final Results",
  outstanding_work: "Outstanding Work",
  lessons_learned: "Lessons Learned",
  knowledge_contribution: "Knowledge Contribution",
  lifecycle_timeline: "Lifecycle Timeline",
  sources_and_traceability: "Sources and Traceability",
};

const STAGE_FOR_SECTION: Partial<Record<InitiativeCivicArchiveSectionId, InitiativeLifecycleStageId>> =
  {
    original_initiative: "initiative",
    collaborative_analysis: "analysis",
    improvement_proposals: "proposal",
    revision_and_change_history: "revision",
    petition_and_public_participation: "petition",
    decision_session: "decision_session",
    collective_decision: "collective_decision",
    approved_actions: "collective_decision",
    implementation_commitments: "commitment",
    implementation_tracking: "tracking",
    official_responses: "official_response",
    public_impact: "public_impact",
  };

function section(
  sectionId: InitiativeCivicArchiveSectionId,
  body: string,
  sourceRecordIds: readonly string[],
): InitiativeCivicArchiveSection {
  const trimmed = body.trim();

  return {
    sectionId,
    title: SECTION_TITLES[sectionId],
    body: trimmed,
    sourceRecordIds: trimmed ? [...sourceRecordIds] : [],
    sourceStageId: STAGE_FOR_SECTION[sectionId] ?? null,
  };
}

function missingStageBody(label: string): string {
  return `No published ${label} record was available when this Archive was assembled.`;
}

/**
 * Builds assembled Archive content. The builder accepts only an intelligence
 * snapshot of published sources — it never receives DM, channel, private
 * shared-document, draft, or AI-suggestion inputs.
 */
export function generateCivicArchiveDraftContent(
  snapshot: InitiativeCivicArchiveIntelligenceSnapshot,
): GeneratedCivicArchiveDraftContent {
  const finalArchiveTitle = snapshot.initiativeTitle
    ? `Civic Archive: ${snapshot.initiativeTitle}`
    : "Civic Archive";

  const publicImpactReportId = snapshot.publicImpactReportReference?.recordId ?? null;

  const participation = snapshot.participationStatistics;
  const discussionBody = [
    `Active Allies: ${participation.activeAllyCount}`,
    `Initiative support likes: ${participation.supportCount}`,
    `Analysis reactions: ${participation.reactionCount}`,
    `Petition signatures: ${participation.signatureCount}`,
  ].join("\n");

  const analysisBody = snapshot.analysisReference
    ? [
        `Published Analysis "${snapshot.analysisReference.label}" (${snapshot.analysisReference.recordId}).`,
        snapshot.analysisReference.summary
          ? `Summary: ${snapshot.analysisReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Collaborative Analysis");

  const proposalsBody =
    snapshot.proposalReferences.length > 0
      ? `Published Improvement Proposals (${snapshot.proposalReferences.length}):\n${snapshot.proposalReferences
          .map((proposal) => `- ${proposal.recordId}: ${proposal.label}`)
          .join("\n")}`
      : missingStageBody("Improvement Proposal");

  const revisionBody = snapshot.revisionReference
    ? [
        `Published Revision "${snapshot.revisionReference.label}" (v${snapshot.revisionReference.version ?? "?"}).`,
        snapshot.revisionReference.summary
          ? `Summary: ${snapshot.revisionReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Revision");

  const petitionBody = snapshot.petitionReference
    ? [
        `Published Petition "${snapshot.petitionReference.label}" (${snapshot.petitionReference.recordId}).`,
        snapshot.petitionReference.summary
          ? `Summary: ${snapshot.petitionReference.summary}`
          : null,
        `Signatures recorded: ${participation.signatureCount}`,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Petition");

  const decisionSessionBody = snapshot.decisionSessionReference
    ? [
        `Published Decision Session "${snapshot.decisionSessionReference.label}" (${snapshot.decisionSessionReference.recordId}).`,
        snapshot.decisionSessionReference.summary
          ? `Focus: ${snapshot.decisionSessionReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Decision Session");

  const collectiveDecisionBody = snapshot.decisionReference
    ? [
        `Published Collective Decision "${snapshot.decisionReference.label}" (${snapshot.decisionReference.recordId}).`,
        snapshot.decisionReference.summary
          ? `Summary: ${snapshot.decisionReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Collective Decision");

  const approvedActionsBody = snapshot.decisionReference
    ? `Approved Actions are recorded against Collective Decision ${snapshot.decisionReference.recordId}. See Implementation Commitments and Tracking for how those actions were carried forward.`
    : missingStageBody("Approved Action set");

  const commitmentsBody = snapshot.commitmentPackageReference
    ? [
        `Published Commitment Package "${snapshot.commitmentPackageReference.label}" (${snapshot.commitmentPackageReference.recordId}).`,
        snapshot.commitmentPackageReference.summary
          ? `Summary: ${snapshot.commitmentPackageReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Implementation Commitment Package");

  const trackingBody = snapshot.trackingPackageReference
    ? [
        `Published Tracking Package "${snapshot.trackingPackageReference.label}" (${snapshot.trackingPackageReference.recordId}).`,
        snapshot.trackingPackageReference.summary
          ? `Summary: ${snapshot.trackingPackageReference.summary}`
          : null,
        snapshot.completeness.unresolvedTrackingCount > 0
          ? `${snapshot.completeness.unresolvedTrackingCount} Tracking Record(s) remain unresolved.`
          : "No unresolved Tracking Records were reported at assembly time.",
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Implementation Tracking Package");

  const officialResponsesBody = snapshot.officialResponsePackageReference
    ? [
        `Published Official Response Package "${snapshot.officialResponsePackageReference.label}" (${snapshot.officialResponsePackageReference.recordId}).`,
        snapshot.officialResponsePackageReference.summary
          ? `Summary: ${snapshot.officialResponsePackageReference.summary}`
          : null,
        `Official response count: ${snapshot.completeness.officialResponseCount}`,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Official Response Package");

  const publicImpactBody = snapshot.publicImpactReportReference
    ? [
        `Published Public Impact Report "${snapshot.publicImpactReportReference.label}" (${snapshot.publicImpactReportReference.recordId}).`,
        snapshot.publicImpactReportReference.summary
          ? `Summary excerpt: ${snapshot.publicImpactReportReference.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : missingStageBody("Public Impact Report");

  const outstandingBody = [
    snapshot.completeness.unresolvedTrackingCount > 0
      ? `${snapshot.completeness.unresolvedTrackingCount} Tracking Record(s) remain unresolved.`
      : "No unresolved Tracking Records.",
    snapshot.completeness.unfinishedCommitmentCount > 0
      ? `${snapshot.completeness.unfinishedCommitmentCount} Commitment(s) were not marked completed.`
      : "No unfinished Commitments recorded.",
    snapshot.completeness.missingEvidenceCount > 0
      ? `${snapshot.completeness.missingEvidenceCount} Tracking Record(s) lack evidence references.`
      : "No missing evidence counts from Tracking.",
  ].join("\n");

  const finalResultsBody = [
    snapshot.publicImpactReportReference
      ? `Public Impact Report ${snapshot.publicImpactReportReference.recordId} summarises published outcomes.`
      : null,
    snapshot.officialResponsePackageReference
      ? `Official Responses package ${snapshot.officialResponsePackageReference.recordId} is cited.`
      : null,
    outstandingBody.includes("remain unresolved") || outstandingBody.includes("not marked completed")
      ? "Outstanding work remains — see the Outstanding Work section."
      : "No outstanding Tracking or Commitment gaps were reported at assembly time.",
  ]
    .filter(Boolean)
    .join("\n");

  const suggestedLessons = [
    snapshot.analysisReference?.summary
      ? `Analysis summary cited: ${snapshot.analysisReference.summary}`
      : null,
    snapshot.revisionReference?.summary
      ? `Revision summary cited: ${snapshot.revisionReference.summary}`
      : null,
    snapshot.publicImpactReportReference?.summary
      ? `Public Impact summary cited: ${snapshot.publicImpactReportReference.summary}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const suggestedKnowledge = [
    snapshot.decisionReference
      ? `Collective Decision ${snapshot.decisionReference.recordId} records the decided question and outcome.`
      : null,
    snapshot.commitmentPackageReference
      ? `Commitment Package ${snapshot.commitmentPackageReference.recordId} records accepted implementation work.`
      : null,
    snapshot.trackingPackageReference
      ? `Tracking Package ${snapshot.trackingPackageReference.recordId} records progress and evidence.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const overviewBody = [
    snapshot.initiativeTitle
      ? `This Civic Archive records published Lifecycle activity for "${snapshot.initiativeTitle}".`
      : "This Civic Archive records published Lifecycle activity for this Initiative.",
    snapshot.completeness.summary,
  ].join(" ");

  const timelineBody =
    snapshot.timeline.length > 0
      ? snapshot.timeline
          .map(
            (entry) =>
              `- ${entry.label} (${entry.stageId}): ${entry.status}${entry.publishedAt ? ` @ ${entry.publishedAt}` : ""}${entry.version != null ? ` v${entry.version}` : ""}`,
          )
          .join("\n")
      : "No Lifecycle timeline entries were available.";

  const sourcesBody = [
    snapshot.analysisReference ? `Analysis: ${snapshot.analysisReference.recordId}` : null,
    ...snapshot.proposalReferences.map((proposal) => `Proposal: ${proposal.recordId}`),
    snapshot.revisionReference ? `Revision: ${snapshot.revisionReference.recordId}` : null,
    snapshot.petitionReference ? `Petition: ${snapshot.petitionReference.recordId}` : null,
    snapshot.decisionSessionReference
      ? `Decision Session: ${snapshot.decisionSessionReference.recordId}`
      : null,
    snapshot.decisionReference ? `Collective Decision: ${snapshot.decisionReference.recordId}` : null,
    snapshot.commitmentPackageReference
      ? `Commitment Package: ${snapshot.commitmentPackageReference.recordId}`
      : null,
    snapshot.trackingPackageReference
      ? `Tracking Package: ${snapshot.trackingPackageReference.recordId}`
      : null,
    snapshot.officialResponsePackageReference
      ? `Official Response Package: ${snapshot.officialResponsePackageReference.recordId}`
      : null,
    publicImpactReportId ? `Public Impact Report: ${publicImpactReportId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sourceIds = (ids: Array<string | null | undefined>): string[] =>
    ids.filter((value): value is string => Boolean(value));

  const sectionsById: Record<InitiativeCivicArchiveSectionId, InitiativeCivicArchiveSection> = {
    archive_overview: section(
      "archive_overview",
      overviewBody,
      sourceIds([publicImpactReportId, snapshot.decisionReference?.recordId]),
    ),
    original_initiative: section(
      "original_initiative",
      [
        snapshot.initiativeTitle ? `Title: ${snapshot.initiativeTitle}` : null,
        snapshot.initiativeDescription
          ? `Description: ${snapshot.initiativeDescription}`
          : "No Initiative description was available.",
      ]
        .filter(Boolean)
        .join("\n"),
      sourceIds([snapshot.initiativeId]),
    ),
    discussion_and_participation: section(
      "discussion_and_participation",
      discussionBody,
      sourceIds([snapshot.petitionReference?.recordId, snapshot.analysisReference?.recordId]),
    ),
    collaborative_analysis: section(
      "collaborative_analysis",
      analysisBody,
      sourceIds([snapshot.analysisReference?.recordId]),
    ),
    improvement_proposals: section(
      "improvement_proposals",
      proposalsBody,
      snapshot.proposalReferences.map((proposal) => proposal.recordId),
    ),
    revision_and_change_history: section(
      "revision_and_change_history",
      revisionBody,
      sourceIds([snapshot.revisionReference?.recordId]),
    ),
    petition_and_public_participation: section(
      "petition_and_public_participation",
      petitionBody,
      sourceIds([snapshot.petitionReference?.recordId]),
    ),
    decision_session: section(
      "decision_session",
      decisionSessionBody,
      sourceIds([snapshot.decisionSessionReference?.recordId]),
    ),
    collective_decision: section(
      "collective_decision",
      collectiveDecisionBody,
      sourceIds([snapshot.decisionReference?.recordId]),
    ),
    approved_actions: section(
      "approved_actions",
      approvedActionsBody,
      sourceIds([snapshot.decisionReference?.recordId]),
    ),
    implementation_commitments: section(
      "implementation_commitments",
      commitmentsBody,
      sourceIds([snapshot.commitmentPackageReference?.recordId]),
    ),
    implementation_tracking: section(
      "implementation_tracking",
      trackingBody,
      sourceIds([snapshot.trackingPackageReference?.recordId]),
    ),
    official_responses: section(
      "official_responses",
      officialResponsesBody,
      sourceIds([snapshot.officialResponsePackageReference?.recordId]),
    ),
    public_impact: section(
      "public_impact",
      publicImpactBody,
      sourceIds([publicImpactReportId]),
    ),
    final_results: section(
      "final_results",
      finalResultsBody,
      sourceIds([publicImpactReportId, snapshot.officialResponsePackageReference?.recordId]),
    ),
    outstanding_work: section(
      "outstanding_work",
      outstandingBody,
      sourceIds([snapshot.trackingPackageReference?.recordId]),
    ),
    lessons_learned: section(
      "lessons_learned",
      suggestedLessons,
      sourceIds([
        snapshot.analysisReference?.recordId,
        snapshot.revisionReference?.recordId,
        publicImpactReportId,
      ]),
    ),
    knowledge_contribution: section(
      "knowledge_contribution",
      suggestedKnowledge,
      sourceIds([
        snapshot.decisionReference?.recordId,
        snapshot.commitmentPackageReference?.recordId,
        snapshot.trackingPackageReference?.recordId,
      ]),
    ),
    lifecycle_timeline: section(
      "lifecycle_timeline",
      timelineBody,
      snapshot.timeline
        .map((entry) => entry.stageId)
        .filter((stageId) => stageId !== "archive"),
    ),
    sources_and_traceability: section(
      "sources_and_traceability",
      sourcesBody || "No published source record ids were available.",
      sourceIds([
        snapshot.analysisReference?.recordId,
        ...snapshot.proposalReferences.map((proposal) => proposal.recordId),
        snapshot.revisionReference?.recordId,
        snapshot.petitionReference?.recordId,
        snapshot.decisionSessionReference?.recordId,
        snapshot.decisionReference?.recordId,
        snapshot.commitmentPackageReference?.recordId,
        snapshot.trackingPackageReference?.recordId,
        snapshot.officialResponsePackageReference?.recordId,
        publicImpactReportId,
      ]),
    ),
  };

  const sections = INITIATIVE_CIVIC_ARCHIVE_SECTION_IDS.map((sectionId) => sectionsById[sectionId]);

  const finalSummary = [
    snapshot.initiativeTitle
      ? `Archive of published Lifecycle records for "${snapshot.initiativeTitle}".`
      : "Archive of published Lifecycle records for this Initiative.",
    `${snapshot.completeness.stagesPublished.length} stage(s) with published records; Public Impact ${
      snapshot.isPublicImpactReportAvailable ? "available" : "unavailable"
    }.`,
  ].join(" ");

  return {
    finalArchiveTitle,
    finalSummary,
    lessonsLearned: suggestedLessons,
    knowledgeContribution: suggestedKnowledge,
    publicImpactReportId,
    sections,
    timeline: snapshot.timeline.map((entry) => structuredClone(entry)),
    completeness: structuredClone(snapshot.completeness),
    participationStatistics: { ...snapshot.participationStatistics },
  };
}
