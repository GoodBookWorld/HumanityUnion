/**
 * Pack 02G Task 03 — civic/public content-translation source loaders.
 *
 * Each loader uses an existing public projection. Private fields never enter
 * the provider payload. Returns null when the record is not publicly eligible.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  normalizeLanguageCode,
  type ContentTranslationSourceKind,
  type LanguageCode,
} from "@hu/types";

import { getCivicMediaCenter } from "../civic-media-center/civic-media-center.service.js";
import { getPublicDecisionSession } from "../decision-session/public-decision-session.projection.js";
import { getPublicInitiativeCollectiveDecision } from "../initiative-collective-decision/public-initiative-collective-decision.projection.js";
import { getPublicInitiativeImplementationCommitment } from "../initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js";
import { getPublicInitiativeImplementationTracking } from "../initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js";
import { getPublicInitiativeImprovementProposal } from "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js";
import { getPublicInitiativePublicImpact } from "../initiative-public-impact/public-initiative-public-impact.projection.js";
import { getRevisionById } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getPublicInitiativeVersionRevision } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { getPublicOfficialResponse } from "../official-response/official-response.projection.js";
import { getPublicCivicArchive } from "../public-civic-archive/public-civic-archive.projection.js";
import {
  findActivePublicNewsRecords,
  findPublicNewsRecordById,
} from "../public-news/public-news.repository.js";
import {
  joinTranslationLines,
  stableJsonForTranslation,
} from "./content-translation-field-serialize.js";
import { buildContentTranslationSourceVersion } from "./content-translation-version.js";

export interface CivicTranslatableSourceLoad {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode;
  readonly fields: Record<string, string>;
  readonly authorParticipantId: string | null;
  readonly isPublished: boolean;
}

/** Singleton civic-media-center record id used by content-translation loaders. */
export const CIVIC_MEDIA_RECORD_ID = "civic-media-center";

export function isCivicMediaTranslationRecordId(sourceRecordId: string): boolean {
  return sourceRecordId.trim() === CIVIC_MEDIA_RECORD_ID;
}

/**
 * Pack 08J.1 — civic_media is a single static seed record (no admin mutation API).
 * Recovery / staging discovery can use this helper to find the warm candidate.
 */
export function discoverCivicMediaTranslationRecordIds(): readonly string[] {
  return [CIVIC_MEDIA_RECORD_ID];
}

export async function loadImprovementProposalTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicInitiativeImprovementProposal(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    targetSection: projection.targetSection,
    currentIssue: projection.currentIssue,
    proposedChange: projection.proposedChange,
    rationale: projection.rationale,
    expectedImprovement: projection.expectedImprovement,
    references: projection.references,
    decisionNote: projection.decisionNote ?? "",
  };
  return {
    sourceKind: "improvement_proposal",
    sourceRecordId: projection.proposalId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: projection.updatedAt,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadInitiativeRevisionTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const revision = getRevisionById(sourceRecordId);
  if (!revision) {
    return null;
  }
  const projection = await getPublicInitiativeVersionRevision(
    revision.initiativeId,
    revision.version,
  );
  if (!projection) {
    return null;
  }
  const fields = {
    revisionSummary: projection.revisionSummary,
    title: projection.title,
    description: projection.description,
    changes: stableJsonForTranslation(
      projection.changes.map((change) => ({
        sectionLabel: change.sectionLabel,
        before: change.before,
        after: change.after,
        authorOriginatedReason: change.authorOriginatedReason ?? "",
        explanation: change.explanation,
      })),
    ),
  };
  return {
    sourceKind: "initiative_revision",
    sourceRecordId: projection.revisionId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: projection.publishedAt,
      publishedVersion: projection.version,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadDecisionSessionTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicDecisionSession(sourceRecordId);
  if (!projection) {
    return null;
  }
  const structured = projection.structuredContent;
  const fields = {
    title: projection.title,
    purpose: projection.purpose,
    decisionQuestion: projection.decisionQuestion,
    structuredContent: structured
      ? stableJsonForTranslation({
          decisionContext: structured.decisionContext,
          objectives: structured.objectives,
          options: structured.options,
          supportingArguments: structured.supportingArguments,
          risks: structured.risks,
          dependencies: structured.dependencies,
          requiredResources: structured.requiredResources,
          suggestedTimeline: structured.suggestedTimeline,
          suggestedParticipants: structured.suggestedParticipants,
          suggestedResponsibleRoles: structured.suggestedResponsibleRoles,
          unresolvedQuestions: structured.unresolvedQuestions,
        })
      : "",
  };
  return {
    sourceKind: "decision_session",
    sourceRecordId: projection.sessionId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: projection.publishedAt,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadCollectiveDecisionTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicInitiativeCollectiveDecision(sourceRecordId);
  if (!projection) {
    return null;
  }
  const structured = projection.structuredContent;
  const fields = {
    question: projection.question,
    outcomeSummary: projection.outcomeSummary,
    transparencyNote: projection.transparencyNote,
    structuredContent: structured
      ? stableJsonForTranslation({
          title: structured.title,
          decisionSummary: structured.decisionSummary,
          approvedActions: structured.approvedActions,
          rejectedAlternatives: structured.rejectedAlternatives,
          responsibleRoles: structured.responsibleRoles,
          implementationPriorities: structured.implementationPriorities,
          implementationTimeline: structured.implementationTimeline,
          decisionRationale: structured.decisionRationale,
          decisionRisks: structured.decisionRisks,
          successCriteria: structured.successCriteria,
          requiredResources: structured.requiredResources,
          supportingReferences: structured.supportingReferences,
          votingOutcomeSummary: structured.votingOutcomeSummary ?? "",
        })
      : "",
  };
  const versionStamp =
    projection.closedAt ?? projection.openedAt ?? projection.closesAt ?? projection.decisionId;
  return {
    sourceKind: "collective_decision",
    sourceRecordId: projection.decisionId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadImplementationCommitmentTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicInitiativeImplementationCommitment(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    title: projection.title,
    summary: projection.summary,
    organization: projection.organization ?? "",
    commitmentScope: projection.commitmentScope,
    approvedAction: projection.approvedAction ?? "",
    suggestedResponsibleRole: projection.suggestedResponsibleRole ?? "",
    priority: projection.priority ?? "",
    requiredResources: joinTranslationLines(projection.requiredResources),
    relatedRisks: joinTranslationLines(projection.relatedRisks),
    references: joinTranslationLines(projection.references),
  };
  const versionStamp =
    projection.publishedAt ??
    projection.completedAt ??
    projection.withdrawnAt ??
    projection.commitmentId;
  return {
    sourceKind: "implementation_commitment",
    sourceRecordId: projection.commitmentId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadImplementationTrackingTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicInitiativeImplementationTracking(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    currentStage: projection.currentStage,
    summary: projection.summary,
    notes: projection.notes ?? "",
    approvedAction: projection.approvedAction ?? "",
    dependencies: joinTranslationLines(projection.dependencies),
    obstacles: joinTranslationLines(projection.obstacles),
    evidenceReferences: joinTranslationLines(projection.evidenceReferences),
    executionHistory: stableJsonForTranslation(
      projection.executionHistory.map((entry) => ({
        title: entry.title,
        summary: entry.summary,
        evidence: entry.evidence,
        references: entry.references,
      })),
    ),
  };
  return {
    sourceKind: "implementation_tracking",
    sourceRecordId: projection.trackingId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: projection.updatedAt,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadOfficialResponseTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = getPublicOfficialResponse(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    subject: projection.subject,
    summary: projection.summary,
    responseReference: projection.responseReference,
    organizationName: projection.organizationName,
  };
  // Privacy: never include rawSource / messageHeaders / providerMetadata.
  const versionStamp = projection.publishedAt ?? projection.receivedAt;
  return {
    sourceKind: "official_response",
    sourceRecordId: projection.responseId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadPublicImpactTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicInitiativePublicImpact(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    title: projection.title,
    summary: projection.summary,
    observedImpact: projection.observedImpact,
    affectedCommunity: projection.affectedCommunity,
    evidenceSummary: projection.evidenceSummary,
    evidence: stableJsonForTranslation(
      projection.evidence.map((item) => ({
        title: item.title,
        description: item.description,
      })),
    ),
  };
  const versionStamp =
    projection.verifiedAt ?? projection.publishedAt ?? projection.archivedAt ?? projection.impactId;
  return {
    sourceKind: "public_impact",
    sourceRecordId: projection.impactId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

export async function loadCivicArchiveTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const projection = await getPublicCivicArchive(sourceRecordId);
  if (!projection) {
    return null;
  }
  const fields = {
    title: projection.title,
    summary: projection.summary,
    implementationPeriod: projection.implementationPeriod,
    initiativeSummary: projection.initiativeSummary,
    civicChallenge: projection.civicChallenge,
    implementationStory: projection.implementationStory,
    verifiedPublicImpact: projection.verifiedPublicImpact,
    lessonsLearned_whatWorked: projection.lessonsLearned.whatWorked,
    lessonsLearned_whatDidNotWork: projection.lessonsLearned.whatDidNotWork,
    lessonsLearned_recommendationsForFuture: projection.lessonsLearned.recommendationsForFuture,
    lessonsLearned_transferableExperience: projection.lessonsLearned.transferableExperience,
    knowledgeContribution_socialBenefits: projection.knowledgeContribution.socialBenefits,
    knowledgeContribution_environmentalBenefits:
      projection.knowledgeContribution.environmentalBenefits,
    knowledgeContribution_economicBenefits: projection.knowledgeContribution.economicBenefits,
    knowledgeContribution_governanceBenefits: projection.knowledgeContribution.governanceBenefits,
    knowledgeContribution_educationalBenefits:
      projection.knowledgeContribution.educationalBenefits,
    knowledgeContribution_additionalObservations:
      projection.knowledgeContribution.additionalObservations,
    timelineLabels: joinTranslationLines(
      projection.historicalTimeline.map((entry) => entry.label),
    ),
  };
  // Privacy: verification metadata is never on PublicCivicArchiveProjection.
  return {
    sourceKind: "civic_archive",
    sourceRecordId: projection.archiveRecordId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: projection.archivedAt,
      publishedVersion: projection.archivedVersion,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

/**
 * Civic Media Center editorial copy (overview / FAQ / principles / flow) plus
 * trusted-media explanations. Names/URLs/logos stay identity-only and are
 * excluded; trusted explanations ARE included as semantic participant-facing copy.
 * Fact-check missions stay in UI dictionaries (FactCheckCard) — not this bag.
 *
 * Pack 08J.1 — static seed only (no mutation API); schedule warm via recovery
 * discovery (`discoverCivicMediaTranslationRecordIds`), not post-mutation enqueue.
 */
export async function loadCivicMediaTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  if (!isCivicMediaTranslationRecordId(sourceRecordId)) {
    return null;
  }
  const center = await getCivicMediaCenter();
  const fields = {
    overviewTitle: center.overview.title,
    overviewSummary: center.overview.summary,
    overviewPoints: stableJsonForTranslation(
      center.overview.points.map((point) => ({
        heading: point.heading,
        body: point.body,
      })),
    ),
    selectionPrinciples: stableJsonForTranslation(
      center.selectionPrinciples.map((item) => ({
        title: item.title,
        description: item.description,
      })),
    ),
    faq: stableJsonForTranslation(
      center.faq.map((item) => ({
        question: item.question,
        answer: item.answer,
      })),
    ),
    initiativeFlowTitle: center.initiativeFlow.title,
    initiativeFlowSummary: center.initiativeFlow.summary,
    initiativeFlowStages: joinTranslationLines(center.initiativeFlow.stages),
    trustedMediaExplanations: stableJsonForTranslation(
      center.trustedMedia.map((item) => ({
        id: item.id,
        explanation: item.explanation,
      })),
    ),
  };
  return {
    sourceKind: "civic_media",
    sourceRecordId: CIVIC_MEDIA_RECORD_ID,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: center.updatedAt,
    }),
    sourceLanguage: DEFAULT_PLATFORM_LANGUAGE,
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

/**
 * Pack 08K.3.1 — public_news active article → content-translation source.
 * Geographic scope / URLs / outlet identity stay outside the field bag.
 */
export async function loadPublicNewsTranslationSource(
  sourceRecordId: string,
): Promise<CivicTranslatableSourceLoad | null> {
  const record = await findPublicNewsRecordById(sourceRecordId.trim());
  if (!record) {
    return null;
  }
  if (record.status !== "active") {
    return null;
  }
  const now = Date.now();
  if (Date.parse(record.expiresAt) <= now) {
    return null;
  }
  const fields: Record<string, string> = {
    title: record.title,
    summary: record.summary,
    category: record.category?.trim() ?? "",
  };
  return {
    sourceKind: "public_news",
    sourceRecordId: record.id,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: record.updatedAt,
    }),
    sourceLanguage: normalizeLanguageCode(record.language, DEFAULT_PLATFORM_LANGUAGE),
    fields,
    authorParticipantId: null,
    isPublished: true,
  };
}

/** Warm/recovery discovery: active, non-expired public news ids (bounded). */
export async function discoverPublicNewsTranslationRecordIds(input?: {
  readonly limit?: number;
}): Promise<readonly string[]> {
  const limit = input?.limit ?? 200;
  const records = await findActivePublicNewsRecords({ limit });
  return records.map((record) => record.id);
}
