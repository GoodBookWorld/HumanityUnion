import type {
  InitiativeCivicArchiveCompleteness,
  InitiativeCivicArchiveConsistencyCheck,
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveParticipationStatistics,
  InitiativeCivicArchiveSourceReference,
  InitiativeCivicArchiveTimelineEntry,
  InitiativeCivicArchiveTimelineStatus,
  InitiativeLifecycleProfile,
  InitiativeLifecycleStageId,
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
} from "@hu/types";
import {
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
  isLifecycleStageApplicableToProfile,
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import { getInitiativeAnalysisReactionSummary } from "../initiative-analysis-reactions/index.js";
import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listPublicDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listPublicProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getPackageByInitiativeId as getCommitmentPackageByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getPackageByInitiativeId as getTrackingPackageByInitiativeId } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";
import {
  getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId,
  listResponsesByPackageId,
} from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { getReportByInitiativeId as getPublicImpactReportByInitiativeId } from "../initiative-public-impact-lifecycle/initiative-public-impact-report.store.js";
import { getInitiativeSupportStatistics } from "../initiative-support/index.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listPublicSessionsByInitiative } from "../decision-session/decision-session.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { resolveCivicArchiveSourceEmptyState } from "./initiative-civic-archive-source-empty.js";

export { resolveCivicArchiveSourceEmptyState } from "./initiative-civic-archive-source-empty.js";

const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

const SECTION_ANCHOR_BY_STAGE: Partial<Record<InitiativeLifecycleStageId, string>> = {
  initiative: "original_initiative",
  analysis: "collaborative_analysis",
  proposal: "improvement_proposals",
  revision: "revision_and_change_history",
  petition: "petition_and_public_participation",
  decision_session: "decision_session",
  collective_decision: "collective_decision",
  commitment: "implementation_commitments",
  tracking: "implementation_tracking",
  official_response: "official_responses",
  public_impact: "public_impact",
  archive: "archive_overview",
};

function ref(
  recordId: string,
  label: string,
  summary: string,
  publishedAt: string | null,
  version: number | null,
  extras?: {
    outcomeKind?: InitiativeOfficialResponseOutcomeKind;
    noResponseDetail?: InitiativeOfficialResponseNoResponseDetail;
  },
): InitiativeCivicArchiveSourceReference {
  return {
    recordId,
    label,
    summary,
    publishedAt,
    version,
    ...(extras?.outcomeKind ? { outcomeKind: extras.outcomeKind } : {}),
    ...(extras?.noResponseDetail ? { noResponseDetail: extras.noResponseDetail } : {}),
  };
}

function buildAnalysisReference(
  initiativeId: string,
  stewardId: string,
): InitiativeCivicArchiveSourceReference | null {
  const authored = listAnalysesByInitiativeAndAuthor(initiativeId, stewardId);
  const published = authored
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0] ?? null;

  if (!latest) {
    return null;
  }

  return ref(
    latest.analysisId,
    latest.title,
    latest.summary,
    latest.publishedAt ?? null,
    latest.initiativeVersion ?? null,
  );
}

function buildProposalReferences(initiativeId: string): InitiativeCivicArchiveSourceReference[] {
  // Batch list once — never N+1 per proposal.
  return listPublicProposalsByInitiative(initiativeId).map((proposal) =>
    ref(
      proposal.proposalId,
      proposal.proposedChange.slice(0, 120) || proposal.proposalId,
      proposal.rationale || proposal.expectedImprovement || "",
      proposal.updatedAt ?? proposal.createdAt ?? null,
      null,
    ),
  );
}

function buildRevisionReference(initiativeId: string): InitiativeCivicArchiveSourceReference | null {
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  if (currentVersion === 0) {
    return null;
  }

  const revision = getRevisionByInitiativeAndVersion(initiativeId, currentVersion);

  if (!revision) {
    return null;
  }

  return ref(
    revision.revisionId,
    revision.title,
    revision.revisionSummary,
    revision.publishedAt ?? null,
    revision.version,
  );
}

async function buildPetitionReference(
  initiativeId: string,
): Promise<InitiativeCivicArchiveSourceReference | null> {
  // Unit tests isolate from Petition Mongo; production still loads when available.
  if (process.env.NODE_TEST_ENV === "true") {
    return null;
  }

  try {
    const petition = await getPetitionByInitiativeId(initiativeId);

    if (!petition || !PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status)) {
      return null;
    }

    return ref(
      petition.petitionId,
      petition.subject.title,
      petition.subject.summary,
      petition.updatedAt ?? petition.createdAt ?? null,
      petition.traceability?.revisionVersion ?? null,
    );
  } catch {
    // Petition store may be unavailable offline (Mongo down).
    return null;
  }
}

function buildDecisionSessionReference(
  initiativeId: string,
): InitiativeCivicArchiveSourceReference | null {
  const sessions = listPublicSessionsByInitiative(initiativeId);
  const latest = sessions[0] ?? null;

  if (!latest) {
    return null;
  }

  return ref(
    latest.sessionId,
    latest.title,
    latest.decisionQuestion || latest.purpose || "",
    latest.publishedAt ?? null,
    latest.initiativeVersion ?? null,
  );
}

function buildDecisionReference(initiativeId: string): InitiativeCivicArchiveSourceReference | null {
  const decisions = listPublicDecisionsByInitiative(initiativeId);
  const latest = decisions[0] ?? null;

  if (!latest) {
    return null;
  }

  return ref(
    latest.decisionId,
    latest.structuredContent?.title ?? latest.question,
    latest.structuredContent?.decisionSummary ?? latest.question,
    latest.closedAt ?? latest.createdAt ?? null,
    null,
  );
}

async function buildParticipationStatistics(input: {
  initiativeId: string;
  analysisId: string | null;
}): Promise<InitiativeCivicArchiveParticipationStatistics> {
  if (process.env.NODE_TEST_ENV === "true") {
    return {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    };
  }

  // Independent lookups run in parallel — never sequential N+1.
  const [signatureCount, supportCount, reactionCount, activeAllyCount] = await Promise.all([
    (async () => {
      try {
        const petition = await getPetitionByInitiativeId(input.initiativeId);
        if (petition && PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status)) {
          return petition.signatures.filter((signature) => signature.status === "Active").length;
        }
      } catch {
        // best-effort
      }
      return 0;
    })(),
    (async () => {
      try {
        const support = await getInitiativeSupportStatistics({ initiativeId: input.initiativeId });
        return support.likes.total;
      } catch {
        return 0;
      }
    })(),
    (async () => {
      if (!input.analysisId) {
        return 0;
      }
      try {
        const reactions = await getInitiativeAnalysisReactionSummary({
          analysisId: input.analysisId,
        });
        return reactions.support + reactions.doNotSupport;
      } catch {
        return 0;
      }
    })(),
    (async () => {
      try {
        return (await listActiveAlliesByInitiative(input.initiativeId)).length;
      } catch {
        return 0;
      }
    })(),
  ]);

  return { signatureCount, supportCount, reactionCount, activeAllyCount };
}

function buildTimeline(input: {
  lifecycleProfile: InitiativeLifecycleProfile;
  initiativePublishedAt: string | null;
  analysisReference: InitiativeCivicArchiveSourceReference | null;
  proposalReferences: readonly InitiativeCivicArchiveSourceReference[];
  petitionReference: InitiativeCivicArchiveSourceReference | null;
  decisionSessionReference: InitiativeCivicArchiveSourceReference | null;
  decisionReference: InitiativeCivicArchiveSourceReference | null;
  commitmentPackageReference: InitiativeCivicArchiveSourceReference | null;
  trackingPackageReference: InitiativeCivicArchiveSourceReference | null;
  officialResponsePackageReference: InitiativeCivicArchiveSourceReference | null;
  publicImpactReportReference: InitiativeCivicArchiveSourceReference | null;
  unresolvedTrackingCount: number;
  unfinishedCommitmentCount: number;
}): InitiativeCivicArchiveTimelineEntry[] {
  const publishedLookup: Partial<
    Record<
      InitiativeLifecycleStageId,
      { publishedAt: string | null; version: number | null; status: InitiativeCivicArchiveTimelineStatus }
    >
  > = {
    initiative: {
      publishedAt: input.initiativePublishedAt,
      version: null,
      status: input.initiativePublishedAt ? "published" : "missing",
    },
    analysis: input.analysisReference
      ? {
          publishedAt: input.analysisReference.publishedAt,
          version: input.analysisReference.version,
          status: "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    proposal:
      input.proposalReferences.length > 0
        ? {
            publishedAt: input.proposalReferences[0]?.publishedAt ?? null,
            version: null,
            status: "published",
          }
        : { publishedAt: null, version: null, status: "missing" },
    // Revision is version/history content only — never emitted as a timeline stage.
    petition: input.petitionReference
      ? {
          publishedAt: input.petitionReference.publishedAt,
          version: input.petitionReference.version,
          status: "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    decision_session: input.decisionSessionReference
      ? {
          publishedAt: input.decisionSessionReference.publishedAt,
          version: input.decisionSessionReference.version,
          status: "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    collective_decision: input.decisionReference
      ? {
          publishedAt: input.decisionReference.publishedAt,
          version: null,
          status: "finalized",
        }
      : { publishedAt: null, version: null, status: "missing" },
    commitment: input.commitmentPackageReference
      ? {
          publishedAt: input.commitmentPackageReference.publishedAt,
          version: null,
          status:
            input.unfinishedCommitmentCount > 0 ? "partial" : "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    tracking: input.trackingPackageReference
      ? {
          publishedAt: input.trackingPackageReference.publishedAt,
          version: null,
          status: input.unresolvedTrackingCount > 0 ? "partial" : "completed",
        }
      : { publishedAt: null, version: null, status: "missing" },
    official_response: input.officialResponsePackageReference
      ? {
          publishedAt: input.officialResponsePackageReference.publishedAt,
          version: null,
          status: "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    public_impact: input.publicImpactReportReference
      ? {
          publishedAt: input.publicImpactReportReference.publishedAt,
          version: input.publicImpactReportReference.version,
          status: "published",
        }
      : { publishedAt: null, version: null, status: "missing" },
    archive: { publishedAt: null, version: null, status: "missing" },
  };

  // Timeline is derived from profile route / published packs —
  // never from Initiative.status or lifecyclePhase. Revision never appears.
  return INITIATIVE_LIFECYCLE_STAGE_REGISTRY.filter(
    (stage) =>
      stage.stageId !== "revision" &&
      isLifecycleStageApplicableToProfile(stage.stageId, input.lifecycleProfile),
  ).map((stage) => {
    const meta = publishedLookup[stage.stageId] ?? {
      publishedAt: null,
      version: null,
      status: "missing" as const,
    };

    return {
      stageId: stage.stageId,
      label: stage.label,
      status: meta.status,
      publishedAt: meta.publishedAt,
      version: meta.version,
      sectionAnchor: SECTION_ANCHOR_BY_STAGE[stage.stageId] ?? stage.hash,
    };
  });
}

function buildCompleteness(input: {
  timeline: readonly InitiativeCivicArchiveTimelineEntry[];
  unresolvedTrackingCount: number;
  unfinishedCommitmentCount: number;
  missingEvidenceCount: number;
  officialResponseCount: number;
  publicImpactAvailable: boolean;
  hasTraceabilityAnchors: boolean;
  requirePublicImpact: boolean;
}): InitiativeCivicArchiveCompleteness {
  const stagesFound = input.timeline
    .filter((entry) => entry.status !== "missing")
    .map((entry) => entry.stageId);
  const stagesPublished = input.timeline
    .filter((entry) =>
      entry.status === "published" ||
      entry.status === "finalized" ||
      entry.status === "completed" ||
      entry.status === "partial" ||
      entry.status === "archived",
    )
    .map((entry) => entry.stageId);
  const optionalStageIds: InitiativeLifecycleStageId[] = input.requirePublicImpact
    ? ["proposal", "petition", "decision_session"]
    : ["proposal", "petition"];
  const missingOptionalStages = optionalStageIds.filter(
    (stageId) => !stagesFound.includes(stageId),
  );

  const summaryParts = [
    `${stagesPublished.length} Lifecycle stage(s) have published records.`,
    input.requirePublicImpact
      ? input.publicImpactAvailable
        ? "A published Public Impact Report is available."
        : "No published Public Impact Report yet."
      : input.publicImpactAvailable
        ? "A published Public Impact Report is available (optional on Public Choice)."
        : "Public Impact is not required on Public Choice — Collective Decision completion is sufficient.",
    input.unresolvedTrackingCount > 0
      ? `${input.unresolvedTrackingCount} Tracking Record(s) remain unresolved.`
      : "No unresolved Tracking Records.",
    input.unfinishedCommitmentCount > 0
      ? `${input.unfinishedCommitmentCount} Commitment(s) are unfinished.`
      : "No unfinished Commitments recorded.",
  ];

  return {
    stagesFound,
    stagesPublished,
    missingOptionalStages,
    unresolvedTrackingCount: input.unresolvedTrackingCount,
    unfinishedCommitmentCount: input.unfinishedCommitmentCount,
    missingEvidenceCount: input.missingEvidenceCount,
    officialResponseCount: input.officialResponseCount,
    publicImpactAvailable: input.publicImpactAvailable,
    traceabilityComplete: input.requirePublicImpact
      ? input.hasTraceabilityAnchors && input.publicImpactAvailable
      : input.hasTraceabilityAnchors,
    summary: summaryParts.join(" "),
  };
}

function buildConsistencyChecks(input: {
  publicImpactAvailable: boolean;
  unresolvedTrackingCount: number;
  missingEvidenceCount: number;
  missingOptionalStages: readonly string[];
  requirePublicImpact: boolean;
}): readonly InitiativeCivicArchiveConsistencyCheck[] {
  const checks: InitiativeCivicArchiveConsistencyCheck[] = [];

  if (input.requirePublicImpact) {
    checks.push(
      input.publicImpactAvailable
        ? {
            checkId: "public-impact-available",
            label: "Published Public Impact Report",
            status: "ok",
            detail: "A published Public Impact Report is available as the Archive source.",
          }
        : {
            checkId: "public-impact-available",
            label: "Published Public Impact Report",
            status: "warning",
            detail: "A published Public Impact Report is required before Archive can be generated.",
          },
    );
  } else if (input.publicImpactAvailable) {
    checks.push({
      checkId: "public-impact-available",
      label: "Published Public Impact Report",
      status: "ok",
      detail: "A published Public Impact Report is available (optional on Public Choice).",
    });
  }

  checks.push(
    input.unresolvedTrackingCount === 0
      ? {
          checkId: "tracking-resolved",
          label: "Implementation Tracking Completeness",
          status: "ok",
          detail: "No unresolved Tracking Records are visible.",
        }
      : {
          checkId: "tracking-resolved",
          label: "Implementation Tracking Completeness",
          status: "warning",
          detail: `${input.unresolvedTrackingCount} Tracking Record(s) remain unresolved — Archive will record outstanding work honestly.`,
        },
  );

  checks.push(
    input.missingEvidenceCount === 0
      ? {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "ok",
          detail: "Tracking evidence references are present where Tracking Records exist.",
        }
      : {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "warning",
          detail: `${input.missingEvidenceCount} Tracking Record(s) lack evidence references.`,
        },
  );

  if (input.missingOptionalStages.length > 0) {
    checks.push({
      checkId: "optional-stages-missing",
      label: "Optional Stages",
      status: "warning",
      detail: `Optional stage(s) without published records: ${input.missingOptionalStages.join(", ")}.`,
    });
  }

  return checks;
}

/**
 * Initiative Lifecycle — Part M, Section 2. Bounded parallel aggregation of
 * published Lifecycle sources only. Never includes DM / channel / private
 * shared documents / drafts / AI suggestions. Performance: independent store
 * lookups run via Promise.all; proposal/commitment/tracking lists are batched
 * (one list call each) — no N+1 per record.
 */
export async function buildInitiativeCivicArchiveIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeCivicArchiveIntelligenceSnapshot> {
  const initiative = getInitiativeById(initiativeId);

  // Synchronous package/report lookups batched first (no awaits), then
  // independent async sources in a single Promise.all.
  const commitmentPackage = getCommitmentPackageByInitiativeId(initiativeId);
  const trackingPackage = getTrackingPackageByInitiativeId(initiativeId);
  const officialResponsePackage = getOfficialResponsePackageByInitiativeId(initiativeId);
  const publicImpactReport = getPublicImpactReportByInitiativeId(initiativeId);
  const trackings = listTrackingsByInitiative(initiativeId);
  const commitments = listCommitmentsByInitiative(initiativeId);

  const analysisReference = initiative
    ? buildAnalysisReference(initiativeId, initiative.stewardId)
    : null;
  const proposalReferences = buildProposalReferences(initiativeId);
  const revisionReference = buildRevisionReference(initiativeId);
  const decisionSessionReference = buildDecisionSessionReference(initiativeId);
  const decisionReference = buildDecisionReference(initiativeId);

  const [petitionReference, participationStatistics] = await Promise.all([
    buildPetitionReference(initiativeId),
    buildParticipationStatistics({
      initiativeId,
      analysisId: analysisReference?.recordId ?? null,
    }),
  ]);

  const commitmentPackageReference = commitmentPackage
    ? ref(
        commitmentPackage.packageId,
        commitmentPackage.title,
        commitmentPackage.summary,
        commitmentPackage.publishedAt,
        null,
      )
    : null;
  const trackingPackageReference = trackingPackage
    ? ref(
        trackingPackage.packageId,
        trackingPackage.title,
        trackingPackage.summary,
        trackingPackage.publishedAt,
        null,
      )
    : null;
  const officialResponsePackageReference = officialResponsePackage
    ? ref(
        officialResponsePackage.packageId,
        officialResponsePackage.title,
        officialResponsePackage.summary,
        officialResponsePackage.publishedAt,
        null,
        {
          outcomeKind:
            officialResponsePackage.outcomeKind === "no_official_response_received" ||
            officialResponsePackage.outcomeKind === "responses_received"
              ? officialResponsePackage.outcomeKind
              : undefined,
          noResponseDetail: officialResponsePackage.noResponseDetail
            ? {
                contactedOrganizations: [
                  ...officialResponsePackage.noResponseDetail.contactedOrganizations,
                ],
                contactedDates: [...officialResponsePackage.noResponseDetail.contactedDates],
                note: officialResponsePackage.noResponseDetail.note,
              }
            : undefined,
        },
      )
    : null;
  const publicImpactReportReference = publicImpactReport
    ? ref(
        publicImpactReport.reportId,
        publicImpactReport.title,
        publicImpactReport.sections.find((section) => section.sectionId === "executive_summary")
          ?.body ?? publicImpactReport.title,
        publicImpactReport.publishedAt,
        1,
      )
    : null;

  const unresolvedTrackingCount = trackings.filter(
    (tracking) => tracking.status !== "completed",
  ).length;
  const unfinishedCommitmentCount = commitments.filter(
    (commitment) => commitment.status !== "completed",
  ).length;
  const effectiveUnfinishedCommitments = unfinishedCommitmentCount;
  const missingEvidenceCount = trackings.filter(
    (tracking) => !tracking.evidenceReferences || tracking.evidenceReferences.length === 0,
  ).length;
  const officialResponseCount = officialResponsePackage
    ? listResponsesByPackageId(officialResponsePackage.packageId).length
    : 0;

  const { requirePublicImpact, isEmpty } = resolveCivicArchiveSourceEmptyState({
    hasInitiative: Boolean(initiative),
    publicImpactAvailable: publicImpactReport !== null,
    lifecycleProfile: initiative?.lifecycleProfile,
  });
  const lifecycleProfile = resolveInitiativeLifecycleProfile(initiative?.lifecycleProfile);

  const timeline = buildTimeline({
    lifecycleProfile,
    initiativePublishedAt: initiative?.createdAt ?? null,
    analysisReference,
    proposalReferences,
    petitionReference,
    decisionSessionReference,
    decisionReference,
    commitmentPackageReference,
    trackingPackageReference,
    officialResponsePackageReference,
    publicImpactReportReference,
    unresolvedTrackingCount,
    unfinishedCommitmentCount: effectiveUnfinishedCommitments,
  });

  const completeness = buildCompleteness({
    timeline,
    unresolvedTrackingCount,
    unfinishedCommitmentCount: effectiveUnfinishedCommitments,
    missingEvidenceCount,
    officialResponseCount,
    publicImpactAvailable: publicImpactReport !== null,
    hasTraceabilityAnchors: Boolean(
      publicImpactReport ||
        analysisReference ||
        decisionReference ||
        commitmentPackage ||
        trackingPackage ||
        officialResponsePackage,
    ),
    requirePublicImpact,
  });

  const consistencyChecks = buildConsistencyChecks({
    publicImpactAvailable: publicImpactReport !== null,
    unresolvedTrackingCount,
    missingEvidenceCount,
    missingOptionalStages: completeness.missingOptionalStages,
    requirePublicImpact,
  });

  const isPublicImpactReportAvailable = publicImpactReport !== null;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    analysisReference,
    proposalReferences,
    revisionReference,
    petitionReference,
    decisionSessionReference,
    decisionReference,
    commitmentPackageReference,
    trackingPackageReference,
    officialResponsePackageReference,
    publicImpactReportReference,
    participationStatistics,
    completeness,
    timeline,
    consistencyChecks,
    isPublicImpactReportAvailable,
    isEmpty,
  };
}
