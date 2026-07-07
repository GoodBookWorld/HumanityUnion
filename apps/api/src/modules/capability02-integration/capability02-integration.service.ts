import type {
  CivicBreadcrumbItem,
  CivicContext,
  CivicContextSection,
  CivicEntityType,
  CivicIntegrationView,
  CivicPipelineStageId,
  CivicPipelineStageStatus,
  CivicPipelineStatus,
  CivicRelationshipType,
  CivicSearchMetadata,
  RelatedRecord,
} from "@hu/types";

import {
  getCommitmentById,
  listCommitmentsByInitiative,
} from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import { listSessionsByInitiative } from "../decision-session/decision-session.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getProposalById } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listPublicTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listPublicImpactsByInitiative } from "../initiative-public-impact/initiative-public-impact.store.js";
import {
  getLatestRevisionForInitiative,
  listRevisionsByInitiative,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  getArchiveRecordById,
  listArchiveRecordsByInitiative,
} from "../public-civic-archive/public-civic-archive.store.js";
import {
  getCapByDecisionId,
  getCapById,
  listCapsByInitiative,
} from "../civic-action-package/civic-action-package.store.js";
import {
  getResponseById,
  listResponsesByInitiative,
} from "../official-response/official-response.store.js";

const PIPELINE_STAGE_ORDER: readonly { id: CivicPipelineStageId; label: string }[] = [
  { id: "initiative", label: "Initiative" },
  { id: "analysis", label: "Analysis" },
  { id: "proposal", label: "Proposal" },
  { id: "revision", label: "Revision" },
  { id: "decision_session", label: "Decision Session" },
  { id: "collective_decision", label: "Collective Decision" },
  { id: "civic_action_package", label: "Civic Action Package" },
  { id: "official_response", label: "Official Responses" },
  { id: "commitment", label: "Commitment" },
  { id: "tracking", label: "Tracking" },
  { id: "public_impact", label: "Public Impact" },
  { id: "archive", label: "Archive" },
];

export function publicUrlForEntity(
  entityType: CivicEntityType,
  entityId: string,
  extra?: { initiativeId?: string; version?: number },
): string {
  switch (entityType) {
    case "initiative":
      return `/initiatives/public/${encodeURIComponent(entityId)}`;
    case "analysis":
      return `/initiative-analyses/public/${encodeURIComponent(entityId)}`;
    case "improvement_proposal":
      return `/improvement-proposals/public/${encodeURIComponent(entityId)}`;
    case "initiative_revision":
      return `/initiatives/public/${encodeURIComponent(extra?.initiativeId ?? entityId)}/revisions/${extra?.version ?? 1}`;
    case "decision_session":
      return `/decision-sessions/public/${encodeURIComponent(entityId)}`;
    case "collective_decision":
      return `/collective-decisions/public/${encodeURIComponent(entityId)}`;
    case "civic_action_package":
      return `/civic-action-packages/public/${encodeURIComponent(entityId)}`;
    case "official_response":
      return `/public-responses/${encodeURIComponent(entityId)}`;
    case "implementation_commitment":
      return `/initiative-implementation-commitments/public/${encodeURIComponent(entityId)}`;
    case "implementation_tracking":
      return `/implementation-tracking/public/${encodeURIComponent(entityId)}`;
    case "public_impact":
      return `/public-impact/${encodeURIComponent(entityId)}`;
    case "civic_archive":
      return `/civic-archive/${encodeURIComponent(entityId)}`;
  }
}

function relatedRecord(
  entityType: CivicEntityType,
  entityId: string,
  title: string,
  summary: string,
  relationshipType: CivicRelationshipType,
  extra?: { initiativeId?: string; version?: number },
): RelatedRecord {
  return {
    entityType,
    entityId,
    title,
    summary,
    publicUrl: publicUrlForEntity(entityType, entityId, extra),
    relationshipType,
  };
}

function resolveInitiativeId(entityType: CivicEntityType, entityId: string): string | null {
  switch (entityType) {
    case "initiative":
      return entityId;
    case "analysis": {
      const analysis = getAnalysisById(entityId);
      return analysis?.initiativeId ?? null;
    }
    case "improvement_proposal": {
      const proposal = getProposalById(entityId);
      return proposal?.initiativeId ?? null;
    }
    case "decision_session": {
      const session = getSessionById(entityId);
      return session?.initiativeId ?? null;
    }
    case "collective_decision": {
      const decision = getDecisionById(entityId);
      return decision?.initiativeId ?? null;
    }
    case "civic_action_package": {
      const capPackage = getCapById(entityId);
      return capPackage?.initiativeId ?? null;
    }
    case "official_response": {
      const response = getResponseById(entityId);
      return response?.initiativeId ?? null;
    }
    case "implementation_commitment": {
      const commitment = getCommitmentById(entityId);
      return commitment?.initiativeId ?? null;
    }
    case "implementation_tracking": {
      const tracking = getTrackingById(entityId);
      return tracking?.initiativeId ?? null;
    }
    case "public_impact": {
      const impact = getImpactById(entityId);
      return impact?.initiativeId ?? null;
    }
    case "civic_archive": {
      const archive = getArchiveRecordById(entityId);
      return archive?.initiativeId ?? null;
    }
    case "initiative_revision":
      return entityId.split("::")[0] ?? null;
    default:
      return null;
  }
}

function buildInitiativePipelineCompletion(
  initiativeId: string,
): Record<CivicPipelineStageId, boolean> {
  const initiative = getInitiativeById(initiativeId);
  const analyses = listPublishedAnalysesByInitiative(initiativeId);
  const proposals = listProposalsByInitiative(initiativeId).filter((p) => p.status !== "draft");
  const revisions = listRevisionsByInitiative(initiativeId);
  const sessions = listSessionsByInitiative(initiativeId).filter((s) =>
    ["published", "closed", "archived"].includes(s.status),
  );
  const decisions = listDecisionsByInitiative(initiativeId).filter((d) => d.status === "closed");
  const commitments = listCommitmentsByInitiative(initiativeId).filter(
    (c) => c.status === "published",
  );
  const trackings = listPublicTrackingsByInitiative(initiativeId);
  const impacts = listPublicImpactsByInitiative(initiativeId);
  const archives = listArchiveRecordsByInitiative(initiativeId).filter(
    (a) => a.status === "published",
  );
  const caps = listCapsByInitiative(initiativeId);
  const officialResponses = listResponsesByInitiative(initiativeId).filter(
    (response) => response.publicationStatus !== "draft",
  );

  return {
    initiative: Boolean(initiative && initiative.lifecyclePhase !== "draft"),
    analysis: analyses.length > 0,
    proposal: proposals.length > 0,
    revision: revisions.length > 0,
    decision_session: sessions.length > 0,
    collective_decision: decisions.length > 0,
    civic_action_package: caps.length > 0,
    official_response: officialResponses.length > 0,
    commitment: commitments.length > 0,
    tracking: trackings.length > 0,
    public_impact: impacts.some((impact) => ["published", "verified"].includes(impact.status)),
    archive: archives.length > 0,
  };
}

export function buildPipelineStatus(initiativeId: string): CivicPipelineStatus {
  const completion = buildInitiativePipelineCompletion(initiativeId);
  const stages: CivicPipelineStageStatus[] = PIPELINE_STAGE_ORDER.map((stage) => ({
    id: stage.id,
    label: stage.label,
    complete: completion[stage.id],
  }));

  const completedIds = stages.filter((stage) => stage.complete).map((stage) => stage.id);
  const currentStageId = completedIds.at(-1) ?? null;
  const currentIndex = currentStageId
    ? PIPELINE_STAGE_ORDER.findIndex((stage) => stage.id === currentStageId)
    : -1;
  const previousStageId =
    currentIndex > 0 ? (PIPELINE_STAGE_ORDER[currentIndex - 1]?.id ?? null) : null;
  const nextStageId =
    currentIndex >= 0 && currentIndex < PIPELINE_STAGE_ORDER.length - 1
      ? (PIPELINE_STAGE_ORDER[currentIndex + 1]?.id ?? null)
      : (PIPELINE_STAGE_ORDER.find((stage) => !completion[stage.id])?.id ?? null);

  const nextStage = nextStageId
    ? PIPELINE_STAGE_ORDER.find((stage) => stage.id === nextStageId)
    : null;

  return {
    stages,
    currentStageId,
    previousStageId,
    nextStageId,
    nextAvailableStep: nextStage && !completion[nextStage.id] ? nextStage.label : null,
  };
}

function initiativeRelatedRecords(initiativeId: string): RelatedRecord[] {
  const initiative = getInitiativeById(initiativeId);
  const records: RelatedRecord[] = [];

  if (!initiative) {
    return records;
  }

  records.push(
    relatedRecord(
      "initiative",
      initiativeId,
      initiative.title,
      initiative.description,
      "references",
    ),
  );

  for (const analysis of listPublishedAnalysesByInitiative(initiativeId)) {
    records.push(
      relatedRecord("analysis", analysis.analysisId, analysis.title, analysis.summary, "produced"),
    );
  }

  for (const proposal of listProposalsByInitiative(initiativeId).filter(
    (p) => p.status !== "draft",
  )) {
    records.push(
      relatedRecord(
        "improvement_proposal",
        proposal.proposalId,
        proposal.targetSection,
        proposal.proposedChange,
        "produced",
      ),
    );
  }

  for (const revision of listRevisionsByInitiative(initiativeId)) {
    records.push(
      relatedRecord(
        "initiative_revision",
        `${initiativeId}::${revision.version}`,
        `Version ${revision.version}`,
        revision.revisionSummary,
        "produced",
        { initiativeId, version: revision.version },
      ),
    );
  }

  for (const session of listSessionsByInitiative(initiativeId).filter(
    (s) => s.status !== "draft",
  )) {
    records.push(
      relatedRecord(
        "decision_session",
        session.sessionId,
        session.title,
        session.purpose,
        "produced",
      ),
    );
  }

  for (const decision of listDecisionsByInitiative(initiativeId)) {
    if (decision.status === "draft") {
      continue;
    }

    records.push(
      relatedRecord(
        "collective_decision",
        decision.decisionId,
        decision.question,
        decision.question,
        "produced",
      ),
    );
  }

  for (const capPackage of listCapsByInitiative(initiativeId)) {
    records.push(
      relatedRecord(
        "civic_action_package",
        capPackage.capId,
        capPackage.title,
        capPackage.summary,
        "documents",
      ),
    );
  }

  for (const response of listResponsesByInitiative(initiativeId).filter(
    (item) => item.publicationStatus !== "draft",
  )) {
    records.push(
      relatedRecord(
        "official_response",
        response.responseId,
        `${response.responseNumber} — ${response.organizationName}`,
        response.summary,
        "produced",
      ),
    );
  }

  for (const commitment of listCommitmentsByInitiative(initiativeId).filter(
    (c) => c.status !== "draft",
  )) {
    records.push(
      relatedRecord(
        "implementation_commitment",
        commitment.commitmentId,
        commitment.commitmentTitle,
        commitment.commitmentSummary,
        "produced",
      ),
    );
  }

  for (const tracking of listPublicTrackingsByInitiative(initiativeId)) {
    records.push(
      relatedRecord(
        "implementation_tracking",
        tracking.trackingId,
        tracking.summary,
        tracking.currentStage,
        "documents",
      ),
    );
  }

  for (const impact of listPublicImpactsByInitiative(initiativeId)) {
    records.push(
      relatedRecord(
        "public_impact",
        impact.impactId,
        impact.title,
        impact.observedImpact,
        "documents",
      ),
    );
  }

  for (const archive of listArchiveRecordsByInitiative(initiativeId).filter(
    (a) => a.status === "published",
  )) {
    records.push(
      relatedRecord(
        "civic_archive",
        archive.archiveRecordId,
        archive.title,
        archive.summary,
        "archives",
      ),
    );
  }

  return records;
}

export function resolveRelatedRecords(
  entityType: CivicEntityType,
  entityId: string,
): RelatedRecord[] {
  const initiativeId = resolveInitiativeId(entityType, entityId);

  if (!initiativeId) {
    return [];
  }

  const all = initiativeRelatedRecords(initiativeId);

  switch (entityType) {
    case "initiative":
      return all.filter(
        (record) => record.entityId !== entityId || record.entityType !== "initiative",
      );
    case "analysis":
      return all.filter(
        (record) =>
          record.entityType === "improvement_proposal" ||
          record.entityType === "initiative" ||
          (record.entityType === "analysis" && record.entityId !== entityId),
      );
    case "improvement_proposal":
      return all.filter(
        (record) =>
          record.entityType === "analysis" ||
          record.entityType === "initiative" ||
          record.entityType === "initiative_revision" ||
          record.entityType === "collective_decision",
      );
    case "collective_decision": {
      const decision = getDecisionById(entityId);
      const sessionRecords = decision
        ? all.filter((record) => record.entityType === "decision_session")
        : [];
      const capPackage = getCapByDecisionId(entityId);
      const capRecords = capPackage
        ? [
            relatedRecord(
              "civic_action_package",
              capPackage.capId,
              capPackage.title,
              capPackage.summary,
              "documents",
            ),
          ]
        : [];
      const responseRecords = capPackage
        ? all.filter(
            (record) =>
              record.entityType === "official_response" &&
              listResponsesByInitiative(capPackage.initiativeId).some(
                (response) =>
                  response.capId === capPackage.capId && response.responseId === record.entityId,
              ),
          )
        : [];
      return [
        ...all.filter(
          (record) =>
            record.entityType === "initiative" ||
            record.entityType === "official_response" ||
            record.entityType === "implementation_commitment" ||
            (record.entityType === "collective_decision" && record.entityId !== entityId),
        ),
        ...sessionRecords,
        ...capRecords,
        ...responseRecords,
      ];
    }
    case "civic_action_package": {
      const capPackage = getCapById(entityId);
      const responseRecords = all.filter(
        (record) =>
          record.entityType === "official_response" &&
          listResponsesByInitiative(capPackage?.initiativeId ?? "").some(
            (response) => response.capId === entityId && response.responseId === record.entityId,
          ),
      );
      return [
        ...all.filter(
          (record) =>
            record.entityType === "initiative" ||
            record.entityType === "official_response" ||
            record.entityType === "implementation_commitment" ||
            (record.entityType === "civic_action_package" && record.entityId !== entityId),
        ),
        ...(capPackage
          ? [
              relatedRecord(
                "collective_decision",
                capPackage.decisionId,
                capPackage.content.decisionQuestion,
                capPackage.content.decisionResultSummary,
                "created_from",
              ),
            ]
          : []),
        ...responseRecords,
      ];
    }
    case "official_response": {
      const response = getResponseById(entityId);
      return [
        ...all.filter(
          (record) =>
            record.entityType === "initiative" ||
            record.entityType === "civic_action_package" ||
            (record.entityType === "official_response" && record.entityId !== entityId),
        ),
        ...(response
          ? [
              relatedRecord(
                "civic_action_package",
                response.capId,
                "Civic Action Package",
                "Parent CAP for this official response",
                "created_from",
              ),
            ]
          : []),
      ];
    }
    case "implementation_tracking": {
      const tracking = getTrackingById(entityId);
      return [
        ...all.filter(
          (record) =>
            record.entityType === "implementation_commitment" ||
            record.entityType === "official_response" ||
            record.entityType === "public_impact" ||
            record.entityType === "civic_archive" ||
            record.entityType === "initiative",
        ),
        ...(tracking
          ? [
              relatedRecord(
                "implementation_commitment",
                tracking.commitmentId,
                "Implementation commitment",
                "Parent commitment",
                "created_from",
              ),
            ]
          : []),
      ];
    }
    case "public_impact": {
      const impact = getImpactById(entityId);
      return [
        ...all.filter(
          (record) =>
            record.entityType === "implementation_tracking" ||
            record.entityType === "civic_archive" ||
            record.entityType === "initiative",
        ),
        ...(impact
          ? [
              relatedRecord(
                "implementation_tracking",
                impact.trackingId,
                "Implementation tracking",
                "Parent tracking record",
                "created_from",
              ),
            ]
          : []),
      ];
    }
    case "civic_archive":
      return all;
    default:
      return all.filter(
        (record) => !(record.entityType === entityType && record.entityId === entityId),
      );
  }
}

export function buildCivicContext(
  entityType: CivicEntityType,
  entityId: string,
): CivicContext | null {
  const initiativeId = resolveInitiativeId(entityType, entityId);

  if (!initiativeId) {
    return null;
  }

  const initiative = getInitiativeById(initiativeId);
  const pipelineStatus = buildPipelineStatus(initiativeId);
  const relatedRecords = resolveRelatedRecords(entityType, entityId);

  const sections: CivicContextSection[] = [
    {
      id: "related-analyses",
      title: "Related Analyses",
      records: relatedRecords.filter((record) => record.entityType === "analysis"),
    },
    {
      id: "related-proposals",
      title: "Related Improvement Proposals",
      records: relatedRecords.filter((record) => record.entityType === "improvement_proposal"),
    },
    {
      id: "current-version",
      title: "Current Version",
      records: (() => {
        const revision = getLatestRevisionForInitiative(initiativeId);
        return revision
          ? [
              relatedRecord(
                "initiative_revision",
                `${initiativeId}::${revision.version}`,
                `Version ${revision.version}`,
                revision.revisionSummary,
                "references",
                { initiativeId, version: revision.version },
              ),
            ]
          : [];
      })(),
    },
    {
      id: "decision-sessions",
      title: "Decision Sessions",
      records: relatedRecords.filter((record) => record.entityType === "decision_session"),
    },
    {
      id: "collective-decisions",
      title: "Collective Decisions",
      records: relatedRecords.filter((record) => record.entityType === "collective_decision"),
    },
    {
      id: "civic-action-packages",
      title: "Civic Action Packages",
      records: relatedRecords.filter((record) => record.entityType === "civic_action_package"),
    },
    {
      id: "official-responses",
      title: "Official Responses",
      records: relatedRecords.filter((record) => record.entityType === "official_response"),
    },
    {
      id: "implementation-commitments",
      title: "Implementation Commitments",
      records: relatedRecords.filter((record) => record.entityType === "implementation_commitment"),
    },
    {
      id: "implementation-tracking",
      title: "Implementation Tracking",
      records: relatedRecords.filter((record) => record.entityType === "implementation_tracking"),
    },
    {
      id: "public-impact",
      title: "Public Impact",
      records: relatedRecords.filter((record) => record.entityType === "public_impact"),
    },
    {
      id: "archive-record",
      title: "Archive Record",
      records: relatedRecords.filter((record) => record.entityType === "civic_archive"),
    },
  ].filter((section) => section.records.length > 0);

  let title = initiative?.title ?? "Civic record";
  let summary = initiative?.description ?? "";

  switch (entityType) {
    case "analysis": {
      const analysis = getAnalysisById(entityId);
      title = analysis?.title ?? title;
      summary = analysis?.summary ?? summary;
      break;
    }
    case "improvement_proposal": {
      const proposal = getProposalById(entityId);
      title = proposal?.targetSection ?? title;
      summary = proposal?.proposedChange ?? summary;
      break;
    }
    case "collective_decision": {
      const decision = getDecisionById(entityId);
      title = decision?.question ?? title;
      summary = decision?.question ?? summary;
      break;
    }
    case "civic_action_package": {
      const capPackage = getCapById(entityId);
      title = capPackage?.title ?? title;
      summary = capPackage?.summary ?? summary;
      break;
    }
    case "official_response": {
      const response = getResponseById(entityId);
      title = response ? `${response.responseNumber} — ${response.organizationName}` : title;
      summary = response?.summary ?? summary;
      break;
    }
    case "implementation_tracking": {
      const tracking = getTrackingById(entityId);
      title = tracking?.summary ?? title;
      summary = tracking?.currentStage ?? summary;
      break;
    }
    case "public_impact": {
      const impact = getImpactById(entityId);
      title = impact?.title ?? title;
      summary = impact?.observedImpact ?? summary;
      break;
    }
    case "civic_archive": {
      const archive = getArchiveRecordById(entityId);
      title = archive?.title ?? title;
      summary = archive?.summary ?? summary;
      break;
    }
    default:
      break;
  }

  return {
    entityType,
    entityId,
    title,
    summary,
    initiativeId,
    currentStageId: pipelineStatus.currentStageId,
    relatedSections: sections,
  };
}

export function buildBreadcrumb(
  entityType: CivicEntityType,
  entityId: string,
): CivicBreadcrumbItem[] {
  const initiativeId = resolveInitiativeId(entityType, entityId);
  const items: CivicBreadcrumbItem[] = [{ label: "Home", href: "/" }];

  if (!initiativeId) {
    items.push({ label: "Civic record", href: null });
    return items;
  }

  const initiative = getInitiativeById(initiativeId);

  if (initiative) {
    items.push({
      label: initiative.metadata.communitySlug.replace(/-/g, " "),
      href: `/community/${encodeURIComponent(initiative.metadata.communitySlug)}`,
    });
    items.push({
      label: initiative.title,
      href: publicUrlForEntity("initiative", initiativeId),
    });
  }

  const stageLabels: Partial<Record<CivicEntityType, string>> = {
    analysis: "Analysis",
    improvement_proposal: "Proposal",
    initiative_revision: "Revision",
    decision_session: "Decision Session",
    collective_decision: "Decision",
    civic_action_package: "Civic Action Package",
    official_response: "Official Response",
    implementation_commitment: "Commitment",
    implementation_tracking: "Tracking",
    public_impact: "Impact",
    civic_archive: "Archive",
  };

  if (entityType !== "initiative" && stageLabels[entityType]) {
    items.push({
      label: stageLabels[entityType] ?? "Record",
      href: publicUrlForEntity(entityType, entityId),
    });
  }

  return items;
}

export function buildSearchMetadata(
  entityType: CivicEntityType,
  entityId: string,
): CivicSearchMetadata | null {
  const initiativeId = resolveInitiativeId(entityType, entityId);
  const initiative = initiativeId ? getInitiativeById(initiativeId) : null;
  const context = buildCivicContext(entityType, entityId);

  if (!context) {
    return null;
  }

  let status = "published";
  let updatedAt = initiative?.updatedAt ?? new Date().toISOString();

  switch (entityType) {
    case "analysis": {
      const analysis = getAnalysisById(entityId);
      status = analysis?.status ?? status;
      updatedAt = analysis?.updatedAt ?? updatedAt;
      break;
    }
    case "improvement_proposal": {
      const proposal = getProposalById(entityId);
      status = proposal?.status ?? status;
      updatedAt = proposal?.updatedAt ?? updatedAt;
      break;
    }
    case "collective_decision": {
      const decision = getDecisionById(entityId);
      status = decision?.status ?? status;
      updatedAt = decision?.updatedAt ?? updatedAt;
      break;
    }
    case "civic_action_package": {
      const capPackage = getCapById(entityId);
      status = capPackage?.status ?? status;
      updatedAt = capPackage?.updatedAt ?? updatedAt;
      break;
    }
    case "official_response": {
      const response = getResponseById(entityId);
      status = response?.publicationStatus ?? status;
      updatedAt = response?.updatedAt ?? updatedAt;
      break;
    }
    case "implementation_tracking": {
      const tracking = getTrackingById(entityId);
      status = tracking?.status ?? status;
      updatedAt = tracking?.updatedAt ?? updatedAt;
      break;
    }
    case "public_impact": {
      const impact = getImpactById(entityId);
      status = impact?.status ?? status;
      updatedAt = impact?.updatedAt ?? updatedAt;
      break;
    }
    case "civic_archive": {
      const archive = getArchiveRecordById(entityId);
      status = archive?.status ?? status;
      updatedAt = archive?.updatedAt ?? updatedAt;
      break;
    }
    default:
      status = initiative?.lifecyclePhase ?? status;
      break;
  }

  return {
    entityType,
    entityId,
    title: context.title,
    summary: context.summary,
    country: initiative?.metadata.region ? "Canada" : "Unknown",
    region: initiative?.metadata.region ?? "",
    community: initiative?.metadata.communitySlug.replace(/-/g, " ") ?? "",
    activityArea: initiative?.metadata.activityArea ?? "",
    status,
    publicUrl: publicUrlForEntity(entityType, entityId),
    updatedAt,
  };
}

export function buildIntegrationView(
  entityType: CivicEntityType,
  entityId: string,
): CivicIntegrationView | null {
  const context = buildCivicContext(entityType, entityId);

  if (!context || !context.initiativeId) {
    return null;
  }

  return {
    context,
    relatedRecords: resolveRelatedRecords(entityType, entityId),
    pipelineStatus: buildPipelineStatus(context.initiativeId),
    breadcrumb: buildBreadcrumb(entityType, entityId),
    searchMetadata: buildSearchMetadata(entityType, entityId),
  };
}
