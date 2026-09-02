import { randomUUID } from "node:crypto";

import type {
  CivicArchiveTraceability,
  Initiative,
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveLifecycleDraftContext,
  InitiativeCivicArchiveVersion,
  InitiativeLifecycleArchiveDocument,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import {
  getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId,
  listResponsesByPackageId,
} from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { getReportByInitiativeId as getPublicImpactReportByInitiativeId } from "../initiative-public-impact-lifecycle/initiative-public-impact-report.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generateCivicArchiveDraftContent } from "./initiative-civic-archive-builder.js";
import {
  buildArchiveDocumentFromDraft,
  buildArchiveDocumentFromVersion,
} from "./initiative-civic-archive-document.projection.js";
import { generateCivicArchivePdfBuffer } from "./initiative-civic-archive-pdf-export.service.js";
import {
  deleteInitiativeCivicArchiveLifecycleDraft,
  getInitiativeCivicArchiveLifecycleDraftByInitiativeId,
  updateInitiativeCivicArchiveLifecycleDraft,
  upsertInitiativeCivicArchiveLifecycleDraft,
  type InitiativeCivicArchiveLifecycleDraftUpdate,
} from "./initiative-civic-archive-lifecycle-draft.store.js";
import { buildInitiativeCivicArchiveIntelligenceSnapshot } from "./initiative-civic-archive-intelligence.service.js";
import {
  getArchiveVersionById,
  getLatestArchiveVersionByInitiativeId,
  listArchiveVersionsByInitiative,
  upsertArchiveVersion,
} from "./initiative-civic-archive-version.store.js";
import { validateInitiativeCivicArchiveLifecycleDraftForPublication } from "./initiative-civic-archive-lifecycle.validators.js";

function emptyCompleteness() {
  return {
    stagesFound: [] as string[],
    stagesPublished: [] as string[],
    missingOptionalStages: [] as string[],
    unresolvedTrackingCount: 0,
    unfinishedCommitmentCount: 0,
    missingEvidenceCount: 0,
    officialResponseCount: 0,
    publicImpactAvailable: false,
    traceabilityComplete: false,
    summaryDescriptors: [] as const,
    summary: "",
  };
}

function emptyParticipationStatistics() {
  return {
    signatureCount: 0,
    supportCount: 0,
    reactionCount: 0,
    activeAllyCount: 0,
  };
}

function publicArchiveUrlPath(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#civic-archive`;
}

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function getOrCreateWorkingDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativeCivicArchiveLifecycleDraft {
  const existing = getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativeCivicArchiveLifecycleDraft = {
    draftId: `initiative-civic-archive-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    finalArchiveTitle: "",
    finalSummary: "",
    lessonsLearned: "",
    knowledgeContribution: "",
    publicImpactReportId: null,
    sections: [],
    timeline: [],
    completeness: emptyCompleteness(),
    participationStatistics: emptyParticipationStatistics(),
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeCivicArchiveLifecycleDraft(draft);
}

async function resolveStewardDisplayName(stewardId: string): Promise<string | null> {
  try {
    const users = await findAuthUsersByMemberIds([stewardId]);
    return users.get(stewardId)?.displayName ?? null;
  } catch {
    return null;
  }
}

function buildCivicArchiveTraceability(
  draft: InitiativeCivicArchiveLifecycleDraft,
  snapshot: Awaited<ReturnType<typeof buildInitiativeCivicArchiveIntelligenceSnapshot>>,
): CivicArchiveTraceability {
  const trackings = listTrackingsByInitiative(draft.initiativeId);
  const commitments = listCommitmentsByInitiative(draft.initiativeId);
  const primaryCommitment = commitments.find(
    (commitment) => commitment.proposalStatus === "accepted",
  );
  const source = primaryCommitment?.traceability ?? null;
  const officialResponsePackage = getOfficialResponsePackageByInitiativeId(draft.initiativeId);
  const evidenceReferences = [
    ...new Set(draft.sections.flatMap((section) => section.sourceRecordIds)),
  ];

  return {
    analysisId: source?.analysisId ?? snapshot.analysisReference?.recordId ?? null,
    analysisVersion: source?.analysisVersion ?? snapshot.analysisReference?.version ?? null,
    proposalIds: source
      ? [...source.proposalIds]
      : snapshot.proposalReferences.map((proposal) => proposal.recordId),
    revisionId: source?.revisionId ?? snapshot.revisionReference?.recordId ?? null,
    revisionVersion: source?.revisionVersion ?? snapshot.revisionReference?.version ?? null,
    petitionId: source?.petitionId ?? snapshot.petitionReference?.recordId ?? null,
    petitionVersion: source?.petitionVersion ?? snapshot.petitionReference?.version ?? null,
    decisionSessionId:
      source?.decisionSessionId ?? snapshot.decisionSessionReference?.recordId ?? null,
    decisionSessionVersion:
      source?.decisionSessionVersion ?? snapshot.decisionSessionReference?.version ?? null,
    decisionId:
      source?.decisionId ??
      primaryCommitment?.decisionId ??
      snapshot.decisionReference?.recordId ??
      null,
    commitmentPackageId: snapshot.commitmentPackageReference?.recordId ?? null,
    trackingPackageId: snapshot.trackingPackageReference?.recordId ?? null,
    officialResponsePackageId: snapshot.officialResponsePackageReference?.recordId ?? null,
    publicImpactReportId: draft.publicImpactReportId,
    relatedTrackingIds: trackings.map((tracking) => tracking.trackingId),
    relatedCommitmentIds: commitments.map((commitment) => commitment.commitmentId),
    relatedOfficialResponseIds: officialResponsePackage
      ? listResponsesByPackageId(officialResponsePackage.packageId).map(
          (response) => response.responseId,
        )
      : [],
    evidenceReferences,
  };
}

async function createOptionalArchiveReadyReminders(input: {
  initiative: Initiative;
  draft: InitiativeCivicArchiveLifecycleDraft;
  actorParticipantId: string;
}): Promise<void> {
  if (process.env.NODE_TEST_ENV === "true" || process.env.INITIATIVE_CIVIC_ARCHIVE_SKIP_REMINDERS === "1") {
    return;
  }

  const finalsEmpty =
    !input.draft.finalArchiveTitle.trim() ||
    !input.draft.finalSummary.trim() ||
    !input.draft.lessonsLearned.trim() ||
    !input.draft.knowledgeContribution.trim();

  if (!finalsEmpty) {
    return;
  }

  const authorUsers = await findAuthUsersByMemberIds([input.actorParticipantId]);
  const authorUser = authorUsers.get(input.actorParticipantId);

  if (!authorUser) {
    return;
  }

  await createReminderIfNotExists({
    recipientUserId: authorUser.userId,
    recipientProfileId: input.actorParticipantId,
    category: "implementation",
    title: "Archive ready",
    message: `Civic Archive draft for "${input.initiative.title}" is ready — complete the final contribution fields before publishing.`,
    relatedEntityType: "civic_archive_draft",
    relatedEntityId: input.draft.draftId,
    relatedUrl: publicArchiveUrlPath(input.initiative.initiativeId),
  });
}

export async function getInitiativeCivicArchiveWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCivicArchiveLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const latest = getLatestArchiveVersionByInitiativeId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
  const draft = getOrCreateWorkingDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    publishedArchiveVersionId: latest?.archiveVersionId ?? null,
    latestPublishedVersion: latest?.archiveVersion ?? null,
  };
}

export async function generateInitiativeCivicArchiveDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCivicArchiveLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);

  // Public Impact is SOURCE_OPTIONAL for all profiles — archive whatever exists.

  const content = generateCivicArchiveDraftContent(snapshot, initiative.lifecycleProfile);
  const existing = getOrCreateWorkingDraft(identity, initiative);
  const updated = updateInitiativeCivicArchiveLifecycleDraft(initiativeId, {
    finalArchiveTitle: content.finalArchiveTitle,
    finalSummary: content.finalSummary,
    lessonsLearned: content.lessonsLearned,
    knowledgeContribution: content.knowledgeContribution,
    publicImpactReportId: content.publicImpactReportId,
    sections: content.sections.map((section) => structuredClone(section)),
    timeline: content.timeline.map((entry) => structuredClone(entry)),
    completeness: structuredClone(content.completeness),
    participationStatistics: structuredClone(content.participationStatistics),
  });

  const draft = updated ?? existing;

  try {
    await createOptionalArchiveReadyReminders({
      initiative,
      draft,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-civic-archive-lifecycle] Archive-ready reminder skipped: ${String(error)}`,
    );
  }

  return draft;
}

export function saveInitiativeCivicArchiveDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeCivicArchiveLifecycleDraftUpdate,
): InitiativeCivicArchiveLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  const existing = getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Civic Archive draft not found.");
  }

  const updated = updateInitiativeCivicArchiveLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Civic Archive draft not found.");
  }

  return updated;
}

/**
 * Initiative Lifecycle — Part M. Publishes a new immutable Archive version
 * (v1, v2, …). Never mutates prior versions. Does NOT change Initiative.status
 * or Initiative.lifecyclePhase — only `publishInitiativeLifecycleStage`.
 * Leaves TASK-037 `public-civic-archive/` completely untouched.
 */
export async function publishInitiativeCivicArchiveStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCivicArchiveVersion> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Civic Archive draft not found.");
  }

  validateInitiativeCivicArchiveLifecycleDraftForPublication(draft, {
    lifecycleProfile: initiative.lifecycleProfile,
  });

  const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
  const currentPublicImpact = getPublicImpactReportByInitiativeId(initiativeId);

  // When Public Impact was linked, it must still be current.
  if (
    draft.publicImpactReportId &&
    (!snapshot.publicImpactReportReference ||
      !currentPublicImpact ||
      snapshot.publicImpactReportReference.recordId !== draft.publicImpactReportId ||
      currentPublicImpact.reportId !== draft.publicImpactReportId)
  ) {
    throw new Error(
      "The Public Impact Report this draft was generated from is no longer current. Generate Civic Archive again before publishing.",
    );
  }

  const latest = getLatestArchiveVersionByInitiativeId(initiativeId);
  const nextVersion = (latest?.archiveVersion ?? 0) + 1;
  const now = new Date().toISOString();
  const archiveVersionId = `civic-archive-version-${randomUUID()}`;
  const publicUrlPath = publicArchiveUrlPath(initiativeId);
  const traceability = buildCivicArchiveTraceability(draft, snapshot);

  const frozenSourceRecordIds = [
    ...new Set(
      [
        snapshot.analysisReference?.recordId,
        ...snapshot.proposalReferences.map((proposal) => proposal.recordId),
        snapshot.revisionReference?.recordId,
        snapshot.petitionReference?.recordId,
        snapshot.decisionSessionReference?.recordId,
        snapshot.decisionReference?.recordId,
        snapshot.commitmentPackageReference?.recordId,
        snapshot.trackingPackageReference?.recordId,
        snapshot.officialResponsePackageReference?.recordId,
        draft.publicImpactReportId,
        ...draft.sections.flatMap((section) => section.sourceRecordIds),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];

  const version: InitiativeCivicArchiveVersion = {
    archiveVersionId,
    initiativeId,
    stewardId: initiative.stewardId,
    archiveVersion: nextVersion,
    finalArchiveTitle: draft.finalArchiveTitle,
    finalSummary: draft.finalSummary,
    lessonsLearned: draft.lessonsLearned,
    knowledgeContribution: draft.knowledgeContribution,
    sections: draft.sections.map((section) => structuredClone(section)),
    timeline: draft.timeline.map((entry) => structuredClone(entry)),
    completeness: structuredClone(draft.completeness),
    participationStatistics: structuredClone(draft.participationStatistics),
    publicImpactReportId: draft.publicImpactReportId,
    frozenSourceRecordIds,
    traceability,
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    publicUrlPath,
  };

  upsertArchiveVersion(version);
  deleteInitiativeCivicArchiveLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "archive",
      stageLabel: "Civic Archive",
      stageArtifactId: archiveVersionId,
      stageVersion: nextVersion,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: publicUrlPath,
    });
  } catch (error) {
    console.warn(
      `[initiative-civic-archive-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  // Part 19: after final Archive publication do NOT create repetitive
  // lifecycle / "keep active" reminders — lifecycle notification only.

  return version;
}

export function getPublishedInitiativeCivicArchiveVersion(
  initiativeId: string,
): InitiativeCivicArchiveVersion | null {
  return getLatestArchiveVersionByInitiativeId(initiativeId);
}

export function getPublishedInitiativeCivicArchiveVersionById(
  archiveVersionId: string,
): InitiativeCivicArchiveVersion | null {
  return getArchiveVersionById(archiveVersionId);
}

export function listPublishedInitiativeCivicArchiveVersions(
  initiativeId: string,
): InitiativeCivicArchiveVersion[] {
  return listArchiveVersionsByInitiative(initiativeId);
}

export async function getPublishedArchiveDocument(
  initiativeId: string,
): Promise<{
  version: InitiativeCivicArchiveVersion;
  document: InitiativeLifecycleArchiveDocument;
} | null> {
  const version = getLatestArchiveVersionByInitiativeId(initiativeId);

  if (!version) {
    return null;
  }

  const stewardDisplayName = await resolveStewardDisplayName(version.stewardId);

  return {
    version,
    document: buildArchiveDocumentFromVersion({ version, stewardDisplayName }),
  };
}

export async function getArchiveDocumentByVersionId(
  archiveVersionId: string,
): Promise<{
  version: InitiativeCivicArchiveVersion;
  document: InitiativeLifecycleArchiveDocument;
} | null> {
  const version = getArchiveVersionById(archiveVersionId);

  if (!version) {
    return null;
  }

  const stewardDisplayName = await resolveStewardDisplayName(version.stewardId);

  return {
    version,
    document: buildArchiveDocumentFromVersion({ version, stewardDisplayName }),
  };
}

export async function getDraftArchiveDocument(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeLifecycleArchiveDocument> {
  getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Civic Archive draft not found.");
  }

  const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
  const stewardDisplayName = await resolveStewardDisplayName(draft.authorId);

  return buildArchiveDocumentFromDraft({
    draft,
    stewardDisplayName,
    traceability: buildCivicArchiveTraceability(draft, snapshot),
  });
}

export async function downloadPublishedArchivePdf(input: {
  initiativeId?: string;
  archiveVersionId?: string;
  locale?: string | null;
}): Promise<{ buffer: Buffer; filename: string; document: InitiativeLifecycleArchiveDocument }> {
  let packed:
    | {
        version: InitiativeCivicArchiveVersion;
        document: InitiativeLifecycleArchiveDocument;
      }
    | null = null;

  if (input.archiveVersionId) {
    packed = await getArchiveDocumentByVersionId(input.archiveVersionId);
  } else if (input.initiativeId) {
    packed = await getPublishedArchiveDocument(input.initiativeId);
  }

  if (!packed) {
    throw new Error("Published Civic Archive not found.");
  }

  const buffer = await generateCivicArchivePdfBuffer(packed.document, {
    locale: input.locale,
  });
  const filename = `civic-archive-${packed.version.initiativeId}-v${packed.version.archiveVersion}.pdf`;

  return { buffer, filename, document: packed.document };
}

export async function downloadDraftArchivePdf(
  identity: RequestIdentity,
  initiativeId: string,
  options: { readonly locale?: string | null } = {},
): Promise<{ buffer: Buffer; filename: string; document: InitiativeLifecycleArchiveDocument }> {
  const document = await getDraftArchiveDocument(identity, initiativeId);
  const buffer = await generateCivicArchivePdfBuffer(document, {
    draftWatermark: true,
    locale: options.locale,
  });

  return {
    buffer,
    filename: `civic-archive-${initiativeId}-draft-preview.pdf`,
    document,
  };
}
