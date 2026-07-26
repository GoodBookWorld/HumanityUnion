import {
  CIVIC_ARCHIVE_OUTCOME_STATUS_LABELS,
  type CivicArchiveLifecycleChildRecord,
  type CivicArchiveLifecycleMetrics,
  type CivicArchiveLifecycleRecord,
  type CivicArchiveLifecycleStage,
  type CivicArchiveOutcomeStatus,
  type CivicEntityType,
  type PublicCivicArchiveRecord,
} from "@hu/types";

import { publicUrlForEntity } from "../capability02-integration/capability02-integration.service.js";
import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listPublicTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listPublicImpactsByInitiative } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listResponsesByInitiative } from "../official-response/official-response.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";
import { getArchiveRecordById, listPublishedArchiveRecords } from "./public-civic-archive.store.js";
import type { CivicArchiveLifecycleIndexQuery } from "./civic-archive-index-query.js";
import { matchesQuery } from "./public-civic-archive-lifecycle.filters.js";
import { isPublicVerificationFixtureRecord } from "./public-civic-archive-fixture-guard.js";

export type { CivicArchiveLifecycleIndexQuery } from "./civic-archive-index-query.js";

interface ArchiveStageDefinition {
  stageId: string;
  label: string;
  entityTypes: readonly CivicEntityType[];
}

const ARCHIVE_LIFECYCLE_STAGES: readonly ArchiveStageDefinition[] = [
  { stageId: "initiative", label: "Initiative", entityTypes: ["initiative"] },
  {
    stageId: "analysis",
    label: "Collaborative Analysis",
    entityTypes: ["analysis"],
  },
  {
    stageId: "proposal",
    label: "Improvement Proposals",
    entityTypes: ["improvement_proposal"],
  },
  { stageId: "revision", label: "Revisions", entityTypes: ["initiative_revision"] },
  {
    stageId: "collective_decision",
    label: "Collective Decisions",
    entityTypes: ["collective_decision"],
  },
  { stageId: "petition", label: "Petitions", entityTypes: ["initiative"] },
  {
    stageId: "commitment",
    label: "Implementation Commitments",
    entityTypes: ["implementation_commitment"],
  },
  {
    stageId: "tracking",
    label: "Implementation Tracking",
    entityTypes: ["implementation_tracking"],
  },
  {
    stageId: "official_response",
    label: "Official Responses",
    entityTypes: ["official_response"],
  },
  { stageId: "public_impact", label: "Public Impact", entityTypes: ["public_impact"] },
  { stageId: "archive", label: "Civic Archive", entityTypes: ["civic_archive"] },
] as const;

function childRecord(
  entityType: CivicEntityType | "petition",
  entityId: string,
  title: string,
  summary: string,
  status: string,
  updatedAt: string,
  extra?: { initiativeId?: string; version?: number },
): CivicArchiveLifecycleChildRecord {
  const publicUrl =
    entityType === "petition"
      ? `/petitions/public/${encodeURIComponent(entityId)}`
      : publicUrlForEntity(entityType, entityId, extra);

  return {
    entityType,
    entityId,
    title,
    summary,
    publicUrl,
    status,
    updatedAt,
  };
}

function selectCanonicalArchiveRecord(
  records: PublicCivicArchiveRecord[],
): PublicCivicArchiveRecord | null {
  const published = records.filter((record) => record.status === "published");

  if (published.length === 0) {
    return null;
  }

  return published.sort(
    (left, right) =>
      right.archivedVersion - left.archivedVersion ||
      (right.archivedAt ?? right.updatedAt).localeCompare(left.archivedAt ?? left.updatedAt),
  )[0]!;
}

function deriveOutcomeStatus(input: {
  archiveRecord: PublicCivicArchiveRecord;
  initiativeLifecyclePhase: string | undefined;
  trackingStatus: string | undefined;
  impactStatus: string | undefined;
  superseded: boolean;
}): CivicArchiveOutcomeStatus {
  if (input.superseded) {
    return "superseded";
  }

  if (input.initiativeLifecyclePhase === "archived" && input.trackingStatus !== "completed") {
    return "concluded_without_implementation";
  }

  if (input.trackingStatus === "completed" && input.impactStatus === "verified") {
    return "completed";
  }

  if (input.trackingStatus === "completed" || input.trackingStatus === "active") {
    return "partially_implemented";
  }

  return "concluded_without_implementation";
}

function buildLifecycleStages(
  initiativeId: string,
  archiveRecord: PublicCivicArchiveRecord,
): CivicArchiveLifecycleStage[] {
  const initiative = getInitiativeById(initiativeId);
  const stageBuckets = new Map<string, CivicArchiveLifecycleChildRecord[]>();

  function pushRecord(stageId: string, record: CivicArchiveLifecycleChildRecord): void {
    const bucket = stageBuckets.get(stageId) ?? [];
    bucket.push(record);
    stageBuckets.set(stageId, bucket);
  }

  if (initiative) {
    pushRecord(
      "initiative",
      childRecord(
        "initiative",
        initiative.initiativeId,
        initiative.title,
        initiative.description,
        initiative.lifecyclePhase,
        initiative.updatedAt,
      ),
    );
  }

  for (const analysis of listPublishedAnalysesByInitiative(initiativeId)) {
    pushRecord(
      "analysis",
      childRecord(
        "analysis",
        analysis.analysisId,
        analysis.title,
        analysis.summary,
        analysis.status,
        analysis.updatedAt,
      ),
    );
  }

  for (const proposal of listProposalsByInitiative(initiativeId).filter(
    (entry) => entry.status !== "draft",
  )) {
    pushRecord(
      "proposal",
      childRecord(
        "improvement_proposal",
        proposal.proposalId,
        proposal.targetSection,
        proposal.proposedChange,
        proposal.status,
        proposal.updatedAt,
      ),
    );
  }

  for (const revision of listRevisionsByInitiative(initiativeId)) {
    pushRecord(
      "revision",
      childRecord(
        "initiative_revision",
        `${initiativeId}::${revision.version}`,
        `Version ${revision.version}`,
        revision.revisionSummary,
        "published",
        revision.publishedAt ?? revision.createdAt,
        { initiativeId, version: revision.version },
      ),
    );
  }

  for (const decision of listDecisionsByInitiative(initiativeId).filter(
    (entry) => entry.status !== "draft",
  )) {
    pushRecord(
      "collective_decision",
      childRecord(
        "collective_decision",
        decision.decisionId,
        decision.question,
        decision.question,
        decision.status,
        decision.updatedAt,
      ),
    );
  }

  const petition = getPetitionByInitiativeId(initiativeId);

  if (petition) {
    pushRecord(
      "petition",
      childRecord(
        "petition",
        petition.petitionId,
        petition.subject.title,
        petition.subject.summary,
        petition.status,
        petition.updatedAt,
      ),
    );
  }

  for (const commitment of listCommitmentsByInitiative(initiativeId).filter(
    (entry) => entry.status !== "draft",
  )) {
    pushRecord(
      "commitment",
      childRecord(
        "implementation_commitment",
        commitment.commitmentId,
        commitment.commitmentTitle,
        commitment.commitmentSummary,
        commitment.status,
        commitment.updatedAt,
      ),
    );
  }

  for (const tracking of listPublicTrackingsByInitiative(initiativeId)) {
    pushRecord(
      "tracking",
      childRecord(
        "implementation_tracking",
        tracking.trackingId,
        tracking.summary,
        tracking.currentStage,
        tracking.status,
        tracking.updatedAt,
      ),
    );
  }

  for (const response of listResponsesByInitiative(initiativeId).filter(
    (entry) => entry.publicationStatus !== "draft",
  )) {
    pushRecord(
      "official_response",
      childRecord(
        "official_response",
        response.responseId,
        `${response.responseNumber} — ${response.organizationName}`,
        response.summary,
        response.publicationStatus,
        response.updatedAt,
      ),
    );
  }

  for (const impact of listPublicImpactsByInitiative(initiativeId)) {
    pushRecord(
      "public_impact",
      childRecord(
        "public_impact",
        impact.impactId,
        impact.title,
        impact.observedImpact,
        impact.status,
        impact.updatedAt,
      ),
    );
  }

  pushRecord(
    "archive",
    childRecord(
      "civic_archive",
      archiveRecord.archiveRecordId,
      archiveRecord.title,
      archiveRecord.summary,
      "published",
      archiveRecord.archivedAt ?? archiveRecord.updatedAt,
      { initiativeId },
    ),
  );

  return ARCHIVE_LIFECYCLE_STAGES.map((stage) => ({
    stageId: stage.stageId,
    label: stage.label,
    records: (stageBuckets.get(stage.stageId) ?? []).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  })).filter((stage) => stage.records.length > 0);
}

function buildLifecycleStageSummary(stages: CivicArchiveLifecycleStage[]): string {
  return stages.map((stage) => stage.label).join(" · ");
}

function buildStageCounts(stages: CivicArchiveLifecycleStage[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const stage of stages) {
    counts[stage.stageId] = stage.records.length;
  }

  return counts;
}

function resolvePublicArchiveImageUrl(imageUrl?: string | null): string | undefined {
  const value = imageUrl?.trim();

  if (!value) {
    return undefined;
  }

  if (/test-account|fixture|placeholder/i.test(value)) {
    return undefined;
  }

  const mediaPathMatch = value.match(/\/api\/v1\/media\/files\/(.+)$/);

  if (mediaPathMatch) {
    return `/api/v1/media/files/${mediaPathMatch[1]}`;
  }

  if (value.startsWith("/")) {
    return value;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return undefined;
}

export function toCivicArchiveLifecycleRecord(
  archiveRecord: PublicCivicArchiveRecord,
): CivicArchiveLifecycleRecord | null {
  const initiative = getInitiativeById(archiveRecord.initiativeId);

  if (!initiative || initiative.lifecyclePhase === "draft") {
    return null;
  }

  const commitment = getCommitmentById(archiveRecord.references.commitmentId);
  const tracking = getTrackingById(archiveRecord.references.trackingId);
  const impact = getImpactById(archiveRecord.references.impactId);
  const decision = listDecisionsByInitiative(archiveRecord.initiativeId).find(
    (entry) => entry.decisionId === archiveRecord.references.decisionId,
  );
  const officialResponses = listResponsesByInitiative(archiveRecord.initiativeId).filter(
    (entry) => entry.publicationStatus !== "draft",
  );
  const stages = buildLifecycleStages(archiveRecord.initiativeId, archiveRecord);
  const outcomeStatus = deriveOutcomeStatus({
    archiveRecord,
    initiativeLifecyclePhase: initiative.lifecyclePhase,
    trackingStatus: tracking?.status,
    impactStatus: impact?.status,
    superseded: false,
  });

  const evidenceLinks = impact
    ? [
        {
          title: impact.title,
          url: publicUrlForEntity("public_impact", impact.impactId),
        },
      ]
    : [];

  return {
    initiativeId: archiveRecord.initiativeId,
    archiveRecordId: archiveRecord.archiveRecordId,
    title: archiveRecord.title,
    summary: archiveRecord.summary,
    country: archiveRecord.country,
    region: archiveRecord.region,
    community: archiveRecord.community,
    activityArea: archiveRecord.activityArea,
    startedAt: initiative.createdAt,
    completedAt: tracking?.completedAt,
    archivedAt: archiveRecord.archivedAt ?? archiveRecord.updatedAt,
    outcomeStatus,
    outcomeStatusLabel: CIVIC_ARCHIVE_OUTCOME_STATUS_LABELS[outcomeStatus],
    finalOutcomeSummary: archiveRecord.summary,
    decisionSummary: decision?.question ?? "",
    implementationSummary: [
      commitment?.commitmentSummary,
      tracking?.summary,
      archiveRecord.implementationPeriod,
    ]
      .filter(Boolean)
      .join(" "),
    publicImpactSummary: impact?.observedImpact ?? "",
    officialResponseSummaries: officialResponses.map(
      (response) => `${response.responseNumber}: ${response.summary}`,
    ),
    stageCounts: buildStageCounts(stages),
    lifecycleStageSummary: buildLifecycleStageSummary(stages),
    evidenceLinks,
    imageUrl: resolvePublicArchiveImageUrl(initiative.metadata.imageUrl),
    stages,
  };
}

function groupPublishedRecordsByInitiative(
  query: Pick<
    CivicArchiveLifecycleIndexQuery,
    "includeVerificationFixtures" | "verificationRunId"
  > = {},
): Map<string, PublicCivicArchiveRecord[]> {
  const grouped = new Map<string, PublicCivicArchiveRecord[]>();

  for (const record of listPublishedArchiveRecords({
    includeVerificationFixtures: query.includeVerificationFixtures,
    verificationRunId: query.verificationRunId,
  })) {
    const bucket = grouped.get(record.initiativeId) ?? [];
    bucket.push(record);
    grouped.set(record.initiativeId, bucket);
  }

  return grouped;
}

function matchesLifecycleQuery(
  record: CivicArchiveLifecycleRecord,
  query: CivicArchiveLifecycleIndexQuery,
): boolean {
  if (query.outcomeStatus && record.outcomeStatus !== query.outcomeStatus) {
    return false;
  }

  return true;
}

export function listCivicArchiveLifecycleRecords(
  query: CivicArchiveLifecycleIndexQuery = {},
): CivicArchiveLifecycleRecord[] {
  const grouped = groupPublishedRecordsByInitiative(query);
  const records: CivicArchiveLifecycleRecord[] = [];

  for (const initiativeRecords of grouped.values()) {
    const canonical = selectCanonicalArchiveRecord(initiativeRecords);

    if (!canonical || !matchesQuery(canonical, query)) {
      continue;
    }

    const lifecycleRecord = toCivicArchiveLifecycleRecord(canonical);

    if (!lifecycleRecord || !matchesLifecycleQuery(lifecycleRecord, query)) {
      continue;
    }

    records.push(lifecycleRecord);
  }

  return records.sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
}

export function computeCivicArchiveLifecycleMetricsForRecords(
  lifecycleRecords: CivicArchiveLifecycleRecord[],
): CivicArchiveLifecycleMetrics {
  const unique = <T>(values: T[]): number => new Set(values.filter(Boolean)).size;

  return {
    archivedInitiativeCount: lifecycleRecords.length,
    archiveRecordCount: lifecycleRecords.length,
    countriesRepresented: unique(lifecycleRecords.map((record) => record.country)),
    regionsRepresented: unique(lifecycleRecords.map((record) => record.region)),
    communitiesRepresented: unique(lifecycleRecords.map((record) => record.community)),
    activityAreasRepresented: unique(lifecycleRecords.map((record) => record.activityArea)),
    verifiedImpactCount: unique(lifecycleRecords.map((record) => record.archiveRecordId)),
  };
}

export function getCivicArchiveLifecycleRecord(
  initiativeId: string,
): CivicArchiveLifecycleRecord | null {
  const grouped = groupPublishedRecordsByInitiative();
  const initiativeRecords = grouped.get(initiativeId) ?? [];
  const canonical = selectCanonicalArchiveRecord(initiativeRecords);

  if (!canonical || isPublicVerificationFixtureRecord(canonical)) {
    return null;
  }

  return toCivicArchiveLifecycleRecord(canonical);
}

export function resolveCivicArchiveLifecycleRecord(id: string): CivicArchiveLifecycleRecord | null {
  const byInitiative = getCivicArchiveLifecycleRecord(id);

  if (byInitiative) {
    return byInitiative;
  }

  const archiveRecord = getArchiveRecordById(id);

  if (
    !archiveRecord ||
    archiveRecord.status !== "published" ||
    isPublicVerificationFixtureRecord(archiveRecord)
  ) {
    return null;
  }

  return getCivicArchiveLifecycleRecord(archiveRecord.initiativeId);
}

export function computeCivicArchiveLifecycleMetrics(): CivicArchiveLifecycleMetrics {
  const lifecycleRecords = listCivicArchiveLifecycleRecords();
  return computeCivicArchiveLifecycleMetricsForRecords(lifecycleRecords);
}
