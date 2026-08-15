import type {
  InitiativePublicImpactAnalysisReference,
  InitiativePublicImpactCommitmentPackageReference,
  InitiativePublicImpactConsistencyCheck,
  InitiativePublicImpactDecisionReference,
  InitiativePublicImpactDecisionSessionReference,
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactOfficialResponsePackageReference,
  InitiativePublicImpactOfficialResponseSummary,
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactPetitionReference,
  InitiativePublicImpactRevisionReference,
  InitiativePublicImpactTrackingPackageReference,
  InitiativePublicImpactTrackingRecordSummary,
} from "@hu/types";

import { getInitiativeAnalysisReactionSummary } from "../initiative-analysis-reactions/index.js";
import { listAnalysesByInitiativeAndAuthor } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listPublicDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getPackageByInitiativeId as getCommitmentPackageByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getPackageByInitiativeId as getTrackingPackageByInitiativeId } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";
import {
  getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId,
  listResponsesByPackageId,
} from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { getInitiativeSupportStatistics } from "../initiative-support/index.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listPublicSessionsByInitiative } from "../decision-session/decision-session.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";

const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

function buildAnalysisReference(
  initiativeId: string,
  stewardId: string,
): InitiativePublicImpactAnalysisReference | null {
  const authored = listAnalysesByInitiativeAndAuthor(initiativeId, stewardId);
  const published = authored
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const latest = published[0] ?? null;

  if (!latest) {
    return null;
  }

  return {
    analysisId: latest.analysisId,
    title: latest.title,
    summary: latest.summary,
    version: latest.initiativeVersion ?? null,
  };
}

function buildRevisionReference(initiativeId: string): InitiativePublicImpactRevisionReference | null {
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  if (currentVersion === 0) {
    return null;
  }

  const revision = getRevisionByInitiativeAndVersion(initiativeId, currentVersion);

  if (!revision) {
    return null;
  }

  return {
    revisionId: revision.revisionId,
    title: revision.title,
    summary: revision.revisionSummary,
    version: revision.version,
  };
}

async function buildPetitionReference(
  initiativeId: string,
): Promise<InitiativePublicImpactPetitionReference | null> {
  const petition = await getPetitionByInitiativeId(initiativeId);

  if (!petition || !PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status)) {
    return null;
  }

  return {
    petitionId: petition.petitionId,
    title: petition.subject.title,
    summary: petition.subject.summary,
    version: petition.traceability?.revisionVersion ?? null,
  };
}

function buildDecisionSessionReference(
  initiativeId: string,
): InitiativePublicImpactDecisionSessionReference | null {
  const sessions = listPublicSessionsByInitiative(initiativeId);
  const latest = sessions[0] ?? null;

  if (!latest) {
    return null;
  }

  return {
    sessionId: latest.sessionId,
    title: latest.title,
    summary: latest.decisionQuestion || latest.purpose || "",
    version: latest.initiativeVersion ?? null,
  };
}

function buildDecisionReference(initiativeId: string): InitiativePublicImpactDecisionReference | null {
  const decisions = listPublicDecisionsByInitiative(initiativeId);
  const latest = decisions[0] ?? null;

  if (!latest) {
    return null;
  }

  return {
    decisionId: latest.decisionId,
    title: latest.structuredContent?.title ?? latest.question,
    summary: latest.structuredContent?.decisionSummary ?? latest.question,
    question: latest.question,
  };
}

function buildConsistencyChecks(input: {
  officialResponsePackageReference: InitiativePublicImpactOfficialResponsePackageReference | null;
  trackingPackageReference: InitiativePublicImpactTrackingPackageReference | null;
  trackingRecords: readonly InitiativePublicImpactTrackingRecordSummary[];
  evidenceItems: readonly string[];
}): readonly InitiativePublicImpactConsistencyCheck[] {
  const checks: InitiativePublicImpactConsistencyCheck[] = [];

  checks.push(
    input.officialResponsePackageReference
      ? {
          checkId: "official-response-package-available",
          label: "Published Official Response Package",
          status: "ok",
          detail: `Official Responses "${input.officialResponsePackageReference.title}" are available as the Public Impact source.`,
        }
      : {
          checkId: "official-response-package-available",
          label: "Published Official Response Package",
          status: "warning",
          detail: "A published Official Response Package is required before Public Impact can be generated.",
        },
  );

  checks.push(
    input.trackingPackageReference
      ? {
          checkId: "tracking-package-available",
          label: "Published Implementation Tracking Package",
          status: "ok",
          detail: `Implementation Tracking "${input.trackingPackageReference.title}" is cited.`,
        }
      : {
          checkId: "tracking-package-available",
          label: "Published Implementation Tracking Package",
          status: "warning",
          detail: "No published Implementation Tracking Package is available yet.",
        },
  );

  const outstanding = input.trackingRecords.filter((tracking) => tracking.status !== "completed");
  checks.push(
    outstanding.length === 0 && input.trackingRecords.length > 0
      ? {
          checkId: "implementation-complete",
          label: "Implementation Completeness",
          status: "ok",
          detail: "Every Tracking Record is marked completed.",
        }
      : {
          checkId: "implementation-complete",
          label: "Implementation Completeness",
          status: "warning",
          detail:
            outstanding.length > 0
              ? `${outstanding.length} Tracking Record(s) are not yet completed.`
              : "No Tracking Records are available to assess completeness.",
        },
  );

  checks.push(
    input.evidenceItems.length > 0
      ? {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "ok",
          detail: `${input.evidenceItems.length} evidence reference(s) are visible from Tracking and Official Responses.`,
        }
      : {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "warning",
          detail: "No evidence references are visible yet from Tracking or Official Responses.",
        },
  );

  return checks;
}

async function buildParticipationStatistics(input: {
  initiativeId: string;
  analysisId: string | null;
}): Promise<InitiativePublicImpactParticipationStatistics> {
  let signatureCount = 0;
  let supportCount = 0;
  let reactionCount = 0;
  let activeAllyCount = 0;

  try {
    const petition = await getPetitionByInitiativeId(input.initiativeId);
    if (petition && PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status)) {
      signatureCount = petition.signatures.filter((signature) => signature.status === "Active").length;
    }
  } catch {
    signatureCount = 0;
  }

  try {
    const support = await getInitiativeSupportStatistics({ initiativeId: input.initiativeId });
    supportCount = support.likes.total;
  } catch {
    supportCount = 0;
  }

  if (input.analysisId) {
    try {
      const reactions = await getInitiativeAnalysisReactionSummary({ analysisId: input.analysisId });
      reactionCount = reactions.support + reactions.doNotSupport;
    } catch {
      reactionCount = 0;
    }
  }

  try {
    activeAllyCount = (await listActiveAlliesByInitiative(input.initiativeId)).length;
  } catch {
    activeAllyCount = 0;
  }

  return {
    signatureCount,
    supportCount,
    reactionCount,
    activeAllyCount,
  };
}

/**
 * Initiative Lifecycle — Part L, Section 2. Read-only aggregation of every
 * published upstream Lifecycle artifact needed by the Impact Builder.
 * Never invents facts and never mutates a source domain.
 */
export async function buildInitiativePublicImpactIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativePublicImpactIntelligenceSnapshot> {
  const initiative = getInitiativeById(initiativeId);
  const officialResponsePackage = getOfficialResponsePackageByInitiativeId(initiativeId);
  const trackingPackage = getTrackingPackageByInitiativeId(initiativeId);
  const commitmentPackage = getCommitmentPackageByInitiativeId(initiativeId);
  const trackings = listTrackingsByInitiative(initiativeId);

  const analysisReference = initiative
    ? buildAnalysisReference(initiativeId, initiative.stewardId)
    : null;
  const revisionReference = buildRevisionReference(initiativeId);
  const petitionReference = await buildPetitionReference(initiativeId);
  const decisionSessionReference = buildDecisionSessionReference(initiativeId);
  const decisionReference = buildDecisionReference(initiativeId);

  const trackingRecords: InitiativePublicImpactTrackingRecordSummary[] = trackings.map((tracking) => ({
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    approvedAction: tracking.approvedAction ?? null,
    participantId: tracking.participantId,
    status: tracking.status,
    progress: tracking.progress ?? null,
    evidenceReferences: [...(tracking.evidenceReferences ?? [])],
    summary: tracking.summary,
  }));

  const officialResponseSummaries: InitiativePublicImpactOfficialResponseSummary[] =
    officialResponsePackage
      ? listResponsesByPackageId(officialResponsePackage.packageId).map((response) => ({
          responseId: response.responseId,
          institution: response.institution,
          organization: response.organization,
          subject: response.subject,
          verificationStatus: response.verificationStatus,
          summary: response.summary,
        }))
      : [];

  const evidenceItems = [
    ...new Set([
      ...trackingRecords.flatMap((tracking) => tracking.evidenceReferences),
      ...officialResponseSummaries.flatMap((response) =>
        [
          response.responseId,
          response.institution.trim() || response.organization.trim() || null,
        ].filter((value): value is string => Boolean(value)),
      ),
      ...(officialResponsePackage ? [officialResponsePackage.packageId] : []),
      ...(trackingPackage ? [trackingPackage.packageId] : []),
      ...(commitmentPackage ? [commitmentPackage.packageId] : []),
    ]),
  ];

  const completedTrackingCount = trackings.filter((tracking) => tracking.status === "completed").length;
  const acceptedCommitmentCount = listCommitmentsByInitiative(initiativeId).filter(
    (commitment) => commitment.proposalStatus === "accepted",
  ).length;
  const completedCommitmentCount =
    completedTrackingCount > 0 ? completedTrackingCount : acceptedCommitmentCount;

  const commitmentPackageReference: InitiativePublicImpactCommitmentPackageReference | null =
    commitmentPackage
      ? {
          packageId: commitmentPackage.packageId,
          title: commitmentPackage.title,
          summary: commitmentPackage.summary,
          commitmentIds: [...commitmentPackage.commitmentIds],
          decisionId: commitmentPackage.decisionId,
          publishedAt: commitmentPackage.publishedAt,
        }
      : null;

  const trackingPackageReference: InitiativePublicImpactTrackingPackageReference | null = trackingPackage
    ? {
        packageId: trackingPackage.packageId,
        title: trackingPackage.title,
        summary: trackingPackage.summary,
        trackingIds: [...trackingPackage.trackingIds],
        commitmentPackageId: trackingPackage.commitmentPackageId,
        decisionId: trackingPackage.decisionId,
        publishedAt: trackingPackage.publishedAt,
      }
    : null;

  const officialResponsePackageReference: InitiativePublicImpactOfficialResponsePackageReference | null =
    officialResponsePackage
      ? {
          packageId: officialResponsePackage.packageId,
          title: officialResponsePackage.title,
          summary: officialResponsePackage.summary,
          responseIds: [...officialResponsePackage.responseIds],
          trackingPackageId: officialResponsePackage.trackingPackageId,
          decisionId: officialResponsePackage.decisionId,
          publishedAt: officialResponsePackage.publishedAt,
        }
      : null;

  const participationStatistics = await buildParticipationStatistics({
    initiativeId,
    analysisId: analysisReference?.analysisId ?? null,
  });

  const consistencyChecks = buildConsistencyChecks({
    officialResponsePackageReference,
    trackingPackageReference,
    trackingRecords,
    evidenceItems,
  });

  const isOfficialResponsePackageAvailable = officialResponsePackage !== null;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    analysisReference,
    revisionReference,
    petitionReference,
    decisionSessionReference,
    decisionReference,
    commitmentPackageReference,
    trackingPackageReference,
    officialResponsePackageReference,
    trackingRecords,
    completedCommitmentCount,
    officialResponseSummaries,
    participationStatistics,
    evidenceItems,
    consistencyChecks,
    isOfficialResponsePackageAvailable,
    isEmpty: !initiative || !isOfficialResponsePackageAvailable,
  };
}
