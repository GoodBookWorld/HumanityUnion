import type {
  Initiative,
  InitiativeExperienceLifecycleStageState,
  InitiativeStatus,
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageContent,
  PublicInitiativeLifecycleStageNavItem,
  PublicInitiativeRelatedCivicRecord,
} from "@hu/types";
import {
  INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES as EXPERIENCE_STAGES,
} from "@hu/types";

import { listPublicCivicAccountabilitiesForInitiative } from "../civic-accountability/civic-accountability.projection.js";
import { listPublicCivicActionPackagesForInitiative } from "../civic-action-package/civic-action-package.projection.js";
import { listPublicDecisionSessionsForInitiative } from "../decision-session/public-decision-session.projection.js";
import { buildInitiativeDiscussionSummary } from "../initiative-comments/initiative-comment.service.js";
import {
  getInitiativeSupportStatistics,
  recordInitiativeView,
} from "../initiative-support/initiative-support.service.js";
import { listPublicInitiativeCollaborativeAnalyses } from "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js";
import { listPublicInitiativeCollectiveDecisionsForInitiative } from "../initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { listPublicInitiativeImplementationCommitmentsForInitiative } from "../initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js";
import { listPublicInitiativeImplementationTrackingsForInitiative } from "../initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js";
import { listPublicInitiativeImprovementProposals } from "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js";
import { listPublicInitiativePublicImpactsForInitiative } from "../initiative-public-impact/public-initiative-public-impact.projection.js";
import { getPublicInitiativeVersionHistory } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { createInitialInitiativeVersionRevision } from "../initiative-version-revision/initiative-version-revision.service.js";
import { listPublicOfficialResponsesForInitiative } from "../official-response/official-response.projection.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { toPublicPetitionProjection } from "../petition/public-petition.projection.js";
import { getLatestPublishedPublicCivicArchiveForInitiative } from "../public-civic-archive/public-civic-archive.projection.js";
import { resolvePublicGeography } from "../../shared/format-public-geography.js";
import { getKnownInitiativeCommunity } from "./initiative-communities.js";
import { isInitiativeEligibleForPublicProjection } from "./initiative-public-projection.access.js";
import { toWorldInitiativeCardProjection } from "./initiative-world-initiatives.projection.js";
import { listInitiatives } from "./initiative.store.js";
import { toPublicInitiativeProjection } from "./public-initiative.projection.js";

const STATE_LABELS: Record<InitiativeExperienceLifecycleStageState, string> = {
  completed: "Completed",
  current: "Current stage",
  upcoming: "Upcoming",
  not_applicable: "Not applicable",
  unavailable: "Unavailable",
};

const STATUS_TO_STAGE: Partial<Record<InitiativeStatus, string>> = {
  draft: "initiative",
  proposal: "initiative",
  discussion: "analysis",
  revision: "revision",
  ready_for_poll: "decision_session",
  poll: "collective_decision",
  petition: "petition",
  implementation: "commitment",
  completed: "public_impact",
  archived: "archive",
  revived: "initiative",
  superseded: "archive",
  merged: "archive",
};

function summarizeText(text: string, maxLength = 220): string {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

function resolveGeography(initiative: Initiative) {
  const metadata = initiative.metadata;
  const community = getKnownInitiativeCommunity(metadata.communitySlug);
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea;

  const resolved = resolvePublicGeography({
    countryCode: metadata.countrySlug ?? community?.countrySlug,
    regionCode: metadata.regionSlug ?? community?.regionSlug,
    communitySlug: metadata.communitySlug,
    regionLabel: metadata.region,
    communityAssociation: metadata.communityAssociation,
  });

  return {
    country: resolved.country,
    region: resolved.region,
    city: resolved.city,
    activityArea,
    label: resolved.label,
  };
}

function resolveCurrentStageId(initiative: Initiative, stageCounts: Map<string, number>): string {
  const mapped = STATUS_TO_STAGE[initiative.status];

  if (mapped) {
    return mapped;
  }

  let currentIndex = 0;

  for (let index = 0; index < EXPERIENCE_STAGES.length; index += 1) {
    const stage = EXPERIENCE_STAGES[index]!;
    const count = stageCounts.get(stage.stageId) ?? 0;

    if (count > 0) {
      currentIndex = index;
    }
  }

  return EXPERIENCE_STAGES[currentIndex]?.stageId ?? "initiative";
}

function isPetitionStageApplicable(initiative: Initiative): boolean {
  return (
    initiative.status === "petition" || getPetitionByInitiativeId(initiative.initiativeId) !== null
  );
}

async function buildStageRecords(
  initiative: Initiative,
): Promise<Map<string, PublicInitiativeLifecycleRecordItem[]>> {
  const initiativeId = initiative.initiativeId;
  const records = new Map<string, PublicInitiativeLifecycleRecordItem[]>();
  const publicInitiative = await toPublicInitiativeProjection(initiative);

  records.set("initiative", [
    {
      recordId: initiativeId,
      title: initiative.title,
      summary: summarizeText(initiative.description, 320),
      status: initiative.status,
      updatedAt: initiative.updatedAt,
      authorDisplayName: publicInitiative.stewardDisplayName,
    },
  ]);

  records.set(
    "analysis",
    (await listPublicInitiativeCollaborativeAnalyses(initiativeId)).map((analysis) => ({
      recordId: analysis.analysisId,
      title: analysis.title,
      summary: analysis.summary,
      updatedAt: analysis.publishedAt,
      publicHref: `/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`,
      authorDisplayName: analysis.authorDisplayName,
      detail: `Version ${analysis.initiativeVersion}`,
    })),
  );

  records.set(
    "proposal",
    (await listPublicInitiativeImprovementProposals(initiativeId)).map((proposal) => ({
      recordId: proposal.proposalId,
      title: `${proposal.targetSection}: ${proposal.proposedChange}`,
      status: proposal.status.replaceAll("_", " "),
      updatedAt: proposal.decidedAt ?? proposal.updatedAt,
      publicHref: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
      authorDisplayName: proposal.authorDisplayName,
    })),
  );

  const versionHistory = await getPublicInitiativeVersionHistory(initiativeId);
  records.set(
    "revision",
    versionHistory.revisions.map((revision) => ({
      recordId: revision.revisionId,
      title: `Version ${revision.version}`,
      summary: revision.revisionSummary,
      status: revision.isCurrent ? "Current" : "Published",
      updatedAt: revision.publishedAt,
      publicHref: `/initiatives/public/${encodeURIComponent(initiativeId)}/revisions/${revision.version}`,
      authorDisplayName: revision.authorDisplayName,
    })),
  );

  const petition = getPetitionByInitiativeId(initiativeId);
  const petitionProjection = petition ? toPublicPetitionProjection(petition) : null;

  records.set(
    "petition",
    petitionProjection
      ? [
          {
            recordId: petitionProjection.petitionIdentity.petitionId,
            title: petitionProjection.petitionIdentity.title,
            summary: petitionProjection.petitionSummary.purpose,
            status: petitionProjection.petitionIdentity.lifecycleStatus,
            updatedAt:
              petitionProjection.petitionSummary.publishedAt ??
              petitionProjection.petitionSummary.opensAt ??
              initiative.updatedAt,
            publicHref: `/petitions/public/${encodeURIComponent(petitionProjection.petitionIdentity.petitionId)}`,
          },
        ]
      : [],
  );

  records.set(
    "decision_session",
    listPublicDecisionSessionsForInitiative(initiativeId).map((session) => ({
      recordId: session.sessionId,
      title: session.title,
      status: session.status,
      updatedAt: session.closesAt,
      publicHref: `/decision-sessions/public/${encodeURIComponent(session.sessionId)}`,
    })),
  );

  records.set(
    "collective_decision",
    listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId).map((decision) => ({
      recordId: decision.decisionId,
      title: decision.question,
      summary: decision.outcomeSummary,
      status: decision.status,
      updatedAt: decision.closedAt ?? decision.closesAt,
      publicHref: `/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`,
    })),
  );

  records.set(
    "commitment",
    (await listPublicInitiativeImplementationCommitmentsForInitiative(initiativeId)).map(
      (commitment) => ({
      recordId: commitment.commitmentId,
      title: commitment.title,
      summary: commitment.summary,
      status: commitment.status,
      updatedAt:
        commitment.publishedAt ??
        commitment.completedAt ??
        commitment.expectedStartDate ??
        initiative.updatedAt,
      publicHref: `/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`,
      authorDisplayName: commitment.authorDisplayName,
    })),
  );

  records.set(
    "tracking",
    (await listPublicInitiativeImplementationTrackingsForInitiative(initiativeId)).map(
      (tracking) => ({
      recordId: tracking.trackingId,
      title: tracking.summary,
      status: tracking.status,
      updatedAt: tracking.activatedAt ?? tracking.completedAt ?? initiative.updatedAt,
      publicHref: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      authorDisplayName: tracking.authorDisplayName,
      detail: tracking.currentStage,
    })),
  );

  records.set(
    "official_response",
    listPublicOfficialResponsesForInitiative(initiativeId).map((response) => ({
      recordId: response.responseId,
      title: response.subject,
      summary: response.summary,
      status: response.verificationState,
      updatedAt: response.publishedAt ?? response.receivedAt,
      publicHref: `/official-responses/public/${encodeURIComponent(response.responseId)}`,
    })),
  );

  records.set(
    "public_impact",
    (await listPublicInitiativePublicImpactsForInitiative(initiativeId)).map((impact) => ({
      recordId: impact.impactId,
      title: impact.title,
      summary: impact.observedImpact,
      status: impact.status,
      updatedAt: impact.publishedAt ?? impact.verifiedAt ?? initiative.updatedAt,
      publicHref: `/public-impact/${encodeURIComponent(impact.impactId)}`,
      authorDisplayName: impact.authorDisplayName,
    })),
  );

  const archive = await getLatestPublishedPublicCivicArchiveForInitiative(initiativeId);
  records.set(
    "archive",
    archive
      ? [
          {
            recordId: archive.archiveRecordId,
            title: archive.title,
            summary: archive.summary,
            status: archive.archivedStatus,
            updatedAt: archive.archivedAt,
            publicHref: `/civic-archive/${encodeURIComponent(initiativeId)}`,
          },
        ]
      : [],
  );

  return records;
}

function buildLifecycleNavigation(
  initiative: Initiative,
  stageRecords: Map<string, PublicInitiativeLifecycleRecordItem[]>,
): {
  stages: PublicInitiativeLifecycleStageNavItem[];
  currentStageId: string;
} {
  const stageCounts = new Map<string, number>();

  for (const [stageId, items] of stageRecords.entries()) {
    stageCounts.set(stageId, items.length);
  }

  const currentStageId = resolveCurrentStageId(initiative, stageCounts);
  const currentIndex = EXPERIENCE_STAGES.findIndex((stage) => stage.stageId === currentStageId);

  const stages: PublicInitiativeLifecycleStageNavItem[] = EXPERIENCE_STAGES.map((stage, index) => {
    const recordCount = stageCounts.get(stage.stageId) ?? 0;
    let state: InitiativeExperienceLifecycleStageState;

    if (stage.stageId === "petition" && !isPetitionStageApplicable(initiative)) {
      state = "not_applicable";
    } else if (stage.stageId === "initiative") {
      state = index === currentIndex ? "current" : "completed";
    } else if (index < currentIndex) {
      state = recordCount > 0 ? "completed" : "not_applicable";
    } else if (index === currentIndex) {
      state = "current";
    } else {
      state = "upcoming";
    }

    return {
      stageId: stage.stageId,
      label: stage.label,
      hash: stage.hash,
      state,
      stateLabel: STATE_LABELS[state],
      recordCount,
    };
  });

  return { stages, currentStageId };
}

function buildStageContent(
  stageRecords: Map<string, PublicInitiativeLifecycleRecordItem[]>,
): PublicInitiativeLifecycleStageContent[] {
  const emptyMessages: Record<string, string> = {
    initiative: "Initiative content is available in Overview.",
    analysis: "No Collaborative Analysis has been published yet.",
    proposal: "No improvement proposals have been published yet.",
    revision: "No revisions have been published.",
    petition: "No petition is linked to this initiative.",
    decision_session: "No decision sessions have been published yet.",
    collective_decision: "No collective decisions have been published yet.",
    commitment: "No implementation commitments have been published yet.",
    tracking: "No implementation tracking records have been published yet.",
    official_response: "No official responses have been published yet.",
    public_impact: "No public impact records have been published yet.",
    archive: "This initiative has not been archived yet.",
  };

  return EXPERIENCE_STAGES.map((stage) => ({
    stageId: stage.stageId,
    records: stageRecords.get(stage.stageId) ?? [],
    emptyStateMessage: emptyMessages[stage.stageId] ?? "No records are available for this stage.",
  }));
}

function buildRelatedCivicRecords(initiativeId: string): PublicInitiativeRelatedCivicRecord[] {
  const related: PublicInitiativeRelatedCivicRecord[] = [];

  for (const capPackage of listPublicCivicActionPackagesForInitiative(initiativeId)) {
    related.push({
      recordType: "Civic Action Package",
      recordId: capPackage.capId,
      title: capPackage.title,
      status: capPackage.status,
      updatedAt: capPackage.issuedAt,
      publicHref: `/civic-action-packages/public/${encodeURIComponent(capPackage.capId)}`,
    });
  }

  for (const accountability of listPublicCivicAccountabilitiesForInitiative(initiativeId)) {
    related.push({
      recordType: "Civic Accountability",
      recordId: accountability.accountabilityId,
      title: accountability.latestEventTitle ?? `Accountability ${accountability.accountabilityId}`,
      status: accountability.status,
      updatedAt: accountability.updatedAt,
      publicHref: `/civic-accountability/public/${encodeURIComponent(accountability.accountabilityId)}`,
    });
  }

  return related.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function selectLatestInitiatives(current: Initiative) {
  const geography = resolveGeography(current);
  const eligible = listInitiatives()
    .filter(
      (initiative) =>
        isInitiativeEligibleForPublicProjection(initiative) &&
        initiative.initiativeId !== current.initiativeId,
    )
    .map((initiative) => {
      let score = 0;
      const itemGeography = resolveGeography(initiative);

      if (itemGeography.activityArea === geography.activityArea) {
        score += 100;
      }

      if (geography.country && itemGeography.country === geography.country) {
        score += 10;
      }

      if (geography.region && itemGeography.region === geography.region) {
        score += 5;
      }

      return { initiative, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.initiative.updatedAt).getTime() -
        new Date(left.initiative.updatedAt).getTime()
      );
    })
    .slice(0, 5)
    .map(({ initiative }) => toWorldInitiativeCardProjection(initiative));

  return eligible;
}

export async function buildPublicInitiativeExperienceProjection(input: {
  initiative: Initiative;
  userId?: string | null;
  viewerKey?: string | null;
}): Promise<PublicInitiativeExperienceProjection> {
  const { initiative } = input;
  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);

  if (input.viewerKey) {
    recordInitiativeView({
      initiativeId: initiative.initiativeId,
      viewerKey: input.viewerKey,
    });
  }

  const publicInitiative = await toPublicInitiativeProjection(initiative);
  const geography = resolveGeography(initiative);
  const stageRecords = await buildStageRecords(initiative);
  const { stages, currentStageId } = buildLifecycleNavigation(initiative, stageRecords);
  const currentStage = stages.find((stage) => stage.stageId === currentStageId);
  const support = await getInitiativeSupportStatistics({
    initiativeId: initiative.initiativeId,
    userId: input.userId ?? null,
    visitorKeyValue: input.userId ? null : (input.viewerKey ?? null),
  });
  const discussion = await buildInitiativeDiscussionSummary({
    initiativeId: initiative.initiativeId,
    userId: input.userId ?? null,
  });

  const firstPublishedAt =
    initiative.timeline.find((event) => event.eventType === "initiative_published")?.timestamp ??
    initiative.createdAt;

  return {
    initiativeId: initiative.initiativeId,
    hero: {
      title: initiative.title,
      summary: summarizeText(initiative.description),
      activityArea: geography.activityArea,
      geography,
      status: initiative.status,
      currentStageLabel: currentStage?.label ?? "Initiative",
      firstPublishedAt,
      lastUpdatedAt: initiative.updatedAt,
      imageUrl: initiative.metadata.imageUrl,
      imageAltText: initiative.metadata.imageAltText,
      stewardDisplayName: publicInitiative.stewardDisplayName,
    },
    initiative: publicInitiative,
    currentStageId,
    lifecycleStages: stages,
    stageContent: buildStageContent(stageRecords),
    supportStatistics: {
      ...support,
      transparencyNote: INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
    },
    revisionHistory: await getPublicInitiativeVersionHistory(initiative.initiativeId),
    relatedCivicRecords: buildRelatedCivicRecords(initiative.initiativeId),
    latestInitiatives: selectLatestInitiatives(initiative),
    discussion,
    generatedAt: new Date().toISOString(),
  };
}

export function resolveExperienceStageFromHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const stage = EXPERIENCE_STAGES.find((item) => item.hash === normalized);
  return stage?.stageId ?? null;
}
