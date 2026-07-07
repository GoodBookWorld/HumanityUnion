import type {
  KnowledgeContribution,
  LessonsLearned,
  PublicCivicArchiveRecord,
  PublicCivicArchiveStatus,
} from "@hu/types";
import { canTransitionPublicCivicArchive, isPublicCivicArchiveTerminal } from "@hu/types";

import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getMemberById } from "../member/member.store.js";
import { assertPublicCivicArchiveEligible } from "./public-civic-archive-eligibility.js";
import {
  createArchiveRecord,
  getArchiveRecordById,
  getNextArchiveVersion,
  listArchiveRecordsByAuthor,
  updateArchiveRecord,
} from "./public-civic-archive.store.js";

export interface CreatePublicCivicArchiveDraftInput {
  impactId: string;
  title: string;
  summary: string;
  lessonsLearned: LessonsLearned;
  knowledgeContribution: KnowledgeContribution;
}

export interface UpdatePublicCivicArchiveDraftInput {
  title?: string;
  summary?: string;
  lessonsLearned?: LessonsLearned;
  knowledgeContribution?: KnowledgeContribution;
}

function getOwnedDraft(
  archiveRecordId: string,
  identity: RequestIdentity,
): PublicCivicArchiveRecord {
  const record = getArchiveRecordById(archiveRecordId);

  if (!record) {
    throw new Error("Archive record not found.");
  }

  if (record.authorId !== identity.participantId) {
    throw new Error("You do not have access to this archive record.");
  }

  return record;
}

function assertTransitionAllowed(
  record: PublicCivicArchiveRecord,
  nextStatus: PublicCivicArchiveStatus,
): void {
  if (isPublicCivicArchiveTerminal(record.status)) {
    throw new Error(`Archive record in status "${record.status}" cannot be changed.`);
  }

  if (!canTransitionPublicCivicArchive(record.status, nextStatus)) {
    throw new Error(`Archive record cannot transition from "${record.status}" to "${nextStatus}".`);
  }
}

function assertDraftEditable(record: PublicCivicArchiveRecord): void {
  if (record.status !== "draft") {
    throw new Error("Only draft archive records can be edited.");
  }
}

function formatImplementationPeriod(activatedAt?: string, completedAt?: string): string {
  const formatDate = (value?: string): string => {
    if (!value) {
      return "Unknown";
    }

    return new Date(value).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return `${formatDate(activatedAt)} – ${formatDate(completedAt)}`;
}

function resolveCommunityLabel(initiativeCommunitySlug: string, affectedCommunity: string): string {
  if (affectedCommunity.trim().length > 0) {
    return affectedCommunity;
  }

  return initiativeCommunitySlug.replace(/-/g, " ");
}

function buildArchiveReferences(impactId: string): PublicCivicArchiveRecord["references"] {
  const impact = getImpactById(impactId);

  if (!impact) {
    throw new Error("Public impact record not found.");
  }

  const tracking = getTrackingById(impact.trackingId);

  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  const commitment = getCommitmentById(tracking.commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const decision = getDecisionById(commitment.decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  return {
    initiativeId: impact.initiativeId,
    initiativeVersion: getCurrentPublishedVersion(impact.initiativeId) || 1,
    decisionId: decision.decisionId,
    commitmentId: commitment.commitmentId,
    trackingId: tracking.trackingId,
    impactId: impact.impactId,
  };
}

function buildArchiveSnapshotFields(
  impactId: string,
): Pick<
  PublicCivicArchiveRecord,
  | "initiativeId"
  | "impactId"
  | "stewardId"
  | "references"
  | "country"
  | "region"
  | "community"
  | "activityArea"
  | "participationScope"
  | "implementationPeriod"
> {
  const impact = getImpactById(impactId);

  if (!impact) {
    throw new Error("Public impact record not found.");
  }

  const initiative = getInitiativeById(impact.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const tracking = getTrackingById(impact.trackingId);
  const commitment = tracking ? getCommitmentById(tracking.commitmentId) : null;
  const decision = commitment ? getDecisionById(commitment.decisionId) : null;
  const steward = getMemberById(initiative.stewardId);

  return {
    initiativeId: impact.initiativeId,
    impactId: impact.impactId,
    stewardId: initiative.stewardId,
    references: buildArchiveReferences(impactId),
    country: steward?.profile.country ?? "Canada",
    region: initiative.metadata.region,
    community: resolveCommunityLabel(initiative.metadata.communitySlug, impact.affectedCommunity),
    activityArea: initiative.metadata.activityArea,
    participationScope: decision?.participationScope ?? "community",
    implementationPeriod: formatImplementationPeriod(tracking?.activatedAt, tracking?.completedAt),
  };
}

export function listMyPublicCivicArchiveRecords(
  identity: RequestIdentity,
): PublicCivicArchiveRecord[] {
  return listArchiveRecordsByAuthor(identity.participantId);
}

export function createPublicCivicArchiveDraft(
  identity: RequestIdentity,
  input: CreatePublicCivicArchiveDraftInput,
): PublicCivicArchiveRecord {
  assertPublicCivicArchiveEligible(input.impactId, identity.participantId);

  const snapshot = buildArchiveSnapshotFields(input.impactId);
  const now = new Date().toISOString();

  const record: PublicCivicArchiveRecord = {
    archiveRecordId: `civic-archive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorId: identity.participantId,
    title: input.title,
    summary: input.summary,
    lessonsLearned: structuredClone(input.lessonsLearned),
    knowledgeContribution: structuredClone(input.knowledgeContribution),
    status: "draft",
    archivedVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...snapshot,
  };

  return createArchiveRecord(record);
}

export function updatePublicCivicArchiveDraft(
  identity: RequestIdentity,
  archiveRecordId: string,
  input: UpdatePublicCivicArchiveDraftInput,
): PublicCivicArchiveRecord {
  const record = getOwnedDraft(archiveRecordId, identity);

  assertDraftEditable(record);

  const updated = updateArchiveRecord(archiveRecordId, input);

  if (!updated) {
    throw new Error("Archive record not found.");
  }

  return updated;
}

export function publishPublicCivicArchive(
  identity: RequestIdentity,
  archiveRecordId: string,
): PublicCivicArchiveRecord {
  const record = getArchiveRecordById(archiveRecordId);

  if (!record) {
    throw new Error("Archive record not found.");
  }

  const initiative = getInitiativeById(record.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);
  assertTransitionAllowed(record, "published");

  const impact = getImpactById(record.impactId);

  if (!impact || impact.status !== "verified") {
    throw new Error("Only verified public impact may be published to the civic archive.");
  }

  const updated = updateArchiveRecord(archiveRecordId, {
    status: "published",
    archivedVersion: getNextArchiveVersion(record.impactId),
    archivedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Archive record not found.");
  }

  return updated;
}

export function getMyPublicCivicArchiveRecord(
  identity: RequestIdentity,
  archiveRecordId: string,
): PublicCivicArchiveRecord {
  const record = getArchiveRecordById(archiveRecordId);

  if (!record) {
    throw new Error("Archive record not found.");
  }

  if (record.authorId !== identity.participantId && record.stewardId !== identity.participantId) {
    throw new Error("You do not have access to this archive record.");
  }

  return record;
}
