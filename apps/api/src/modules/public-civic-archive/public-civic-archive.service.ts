import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { scheduleContentTranslationWarmAfterMutation } from "../language/content-translation-warm-enqueue.js";
import { getCountryLabel, normalizeCountryInput } from "@hu/geography";
import type {
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativePublicImpact,
  KnowledgeContribution,
  LessonsLearned,
  PublicCivicArchiveRecord,
  PublicCivicArchiveStatus,
  TransitiveInitiativeAncestry,
} from "@hu/types";
import { canTransitionPublicCivicArchive, isPublicCivicArchiveTerminal } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeNotFoundError,
  ParentArtifactNotFoundError,
  validateTransitiveInitiativeAncestry,
  type InitiativeExistenceChecker,
  type ParentArtifactInitiativeResolver,
} from "../../shared/initiative-ancestry/index.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getKnownInitiativeCommunity } from "../initiatives/initiative-communities.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getMemberById } from "../member/member-access.js";
import {
  assertPublicCivicArchiveEligibleForResolved,
  type ResolvedPublicCivicArchiveEligibilitySource,
} from "./public-civic-archive-eligibility.js";
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

function resolveArchiveCountryLabel(
  initiative: ReturnType<typeof getInitiativeById>,
  stewardCountry?: string,
): string {
  const countryCode = initiative?.metadata.countrySlug
    ? normalizeCountryInput(initiative.metadata.countrySlug)
    : undefined;

  if (countryCode) {
    return getCountryLabel(countryCode) ?? stewardCountry ?? "Canada";
  }

  const knownCommunity = initiative?.metadata.communitySlug
    ? getKnownInitiativeCommunity(initiative.metadata.communitySlug)
    : undefined;

  return knownCommunity?.countryLabel ?? stewardCountry ?? "Canada";
}

function resolveArchiveRegionLabel(
  initiative: ReturnType<typeof getInitiativeById>,
  stewardRegion?: string,
): string {
  if (initiative?.metadata.region?.trim()) {
    return initiative.metadata.region;
  }

  if (stewardRegion?.trim()) {
    return stewardRegion;
  }

  const knownCommunity = initiative?.metadata.communitySlug
    ? getKnownInitiativeCommunity(initiative.metadata.communitySlug)
    : undefined;

  return knownCommunity?.regionLabel ?? "";
}

function resolveCommunityLabel(initiativeCommunitySlug: string, affectedCommunity: string): string {
  if (affectedCommunity.trim().length > 0) {
    return affectedCommunity;
  }

  return initiativeCommunitySlug.replace(/-/g, " ");
}

/**
 * Recovery Task 18 — single-resolution Initiative ancestry and source
 * identity for Public Civic Archive.
 *
 * Inspection (Part 1/2/3) found `PublicCivicArchiveRecord` stores its own
 * `initiativeId` and `impactId`, but `CreatePublicCivicArchiveDraftInput`
 * carries ONLY `impactId` — there is no independently-supplied
 * `initiativeId` anywhere in the creation path. This is the same
 * "Model B — transitive child" shape Task 17 found for Public Impact's own
 * relationship to Implementation Tracking, one level further down the
 * chain:
 *
 *   Initiative ← Implementation Commitment ← Implementation Tracking
 *     ← Public Impact ← Public Civic Archive
 *
 * Ancestry is TRANSITIVE (`validateTransitiveInitiativeAncestry` with
 * `parentArtifactType: "impact"`, the canonical type for
 * `initiative-public-impact` per Task 11). Tracking/Commitment/Decision are
 * NOT part of the ancestry chain being validated here — Public Impact's own
 * Initiative ancestry was already validated at Impact-creation time
 * (Task 17). They are resolved once each below only because real,
 * pre-existing business rules (eligibility + the `references` snapshot)
 * already required them.
 */
export interface PublicCivicArchiveAncestryDependencies {
  readonly getImpact: (impactId: string) => InitiativePublicImpact | null;
  readonly getInitiative: (initiativeId: string) => Initiative | null;
  readonly getTracking: (trackingId: string) => InitiativeImplementationTracking | null;
  readonly getCommitment: (commitmentId: string) => InitiativeImplementationCommitment | null;
  readonly getDecision: (decisionId: string) => InitiativeCollectiveDecision | null;
}

const defaultPublicCivicArchiveAncestryDependencies: PublicCivicArchiveAncestryDependencies = {
  getImpact: getImpactById,
  getInitiative: getInitiativeById,
  getTracking: getTrackingById,
  getCommitment: getCommitmentById,
  getDecision: getDecisionById,
};

/** Production `ParentArtifactInitiativeResolver` adapter for the "impact" parent type. */
export function createArchiveParentImpactResolver(
  getImpact: PublicCivicArchiveAncestryDependencies["getImpact"],
  resolvedImpactBox: { value: InitiativePublicImpact | null },
): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId) {
      if (parentArtifactType !== "impact") {
        return { found: false };
      }

      const impact = getImpact(parentArtifactId);
      resolvedImpactBox.value = impact;

      return impact ? { found: true, initiativeId: impact.initiativeId } : { found: false };
    },
  };
}

/** Production `InitiativeExistenceChecker` adapter that captures the resolved Initiative. */
export function createArchiveInitiativeExistenceChecker(
  getInitiative: PublicCivicArchiveAncestryDependencies["getInitiative"],
  resolvedInitiativeBox: { value: Initiative | null },
): InitiativeExistenceChecker {
  return {
    initiativeExists(initiativeId) {
      const initiative = getInitiative(initiativeId);
      resolvedInitiativeBox.value = initiative;

      return initiative !== null;
    },
  };
}

export interface ResolvedPublicCivicArchiveSource extends ResolvedPublicCivicArchiveEligibilitySource {
  readonly ancestry: TransitiveInitiativeAncestry;
}

/**
 * Resolves and validates the Public Civic Archive write-side source in a
 * single pass: Public Impact ancestry (transitive, through Initiative) plus
 * the Tracking/Commitment/Decision records the existing eligibility and
 * snapshot-construction logic already depends on.
 *
 * Lookup counts for a successful resolution (Part 6/7/8 targets):
 * Public Impact 1, Initiative 1, Tracking 1, Commitment 1, Decision 1.
 */
export async function resolvePublicCivicArchiveSource(
  impactId: string,
  deps: PublicCivicArchiveAncestryDependencies,
): Promise<ResolvedPublicCivicArchiveSource> {
  const resolvedImpactBox: { value: InitiativePublicImpact | null } = { value: null };
  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  let ancestry: TransitiveInitiativeAncestry;

  try {
    ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "impact", parentArtifactId: impactId },
      {
        ...createArchiveParentImpactResolver(deps.getImpact, resolvedImpactBox),
        ...createArchiveInitiativeExistenceChecker(deps.getInitiative, resolvedInitiativeBox),
      },
    );
  } catch (error) {
    if (
      error instanceof ParentArtifactNotFoundError ||
      error instanceof InitiativeAncestryMissingError
    ) {
      // Preserves the pre-existing "Public impact record not found." message
      // for the same, previously-reachable case (missing/nonexistent impactId).
      throw new Error("Public impact record not found.");
    }

    if (error instanceof InitiativeNotFoundError) {
      // Preserves the pre-existing "Initiative not found." message — this
      // Initiative-existence check already existed pre-Task-18, just as
      // ad hoc code rather than the shared validator.
      throw new Error("Initiative not found.");
    }

    throw error;
  }

  const impact = resolvedImpactBox.value;
  const initiative = resolvedInitiativeBox.value;

  if (!impact) {
    throw new Error("Public impact record not found.");
  }

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const tracking = deps.getTracking(impact.trackingId);
  const commitment = tracking ? deps.getCommitment(tracking.commitmentId) : null;
  const decision = commitment ? deps.getDecision(commitment.decisionId) : null;

  return { impact, initiative, tracking, commitment, decision, ancestry };
}

async function buildArchiveSnapshotFieldsForResolved(
  resolved: ResolvedPublicCivicArchiveSource,
): Promise<
  Pick<
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
  >
> {
  const { impact, initiative, tracking, commitment, decision } = resolved;

  // Defensive only — eligibility (already asserted by the caller) already
  // requires all three to be non-null, using these exact messages.
  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  const steward = await getMemberById(initiative.stewardId);

  return {
    initiativeId: impact.initiativeId,
    impactId: impact.impactId,
    stewardId: initiative.stewardId,
    references: {
      initiativeId: impact.initiativeId,
      initiativeVersion: getCurrentPublishedVersion(impact.initiativeId) || 1,
      decisionId: decision.decisionId,
      commitmentId: commitment.commitmentId,
      trackingId: tracking.trackingId,
      impactId: impact.impactId,
    },
    country: resolveArchiveCountryLabel(initiative, steward?.profile.country),
    region: resolveArchiveRegionLabel(initiative, steward?.profile.region),
    community: resolveCommunityLabel(initiative.metadata.communitySlug, impact.affectedCommunity),
    activityArea: initiative.metadata.activityArea,
    participationScope: decision.participationScope,
    implementationPeriod: formatImplementationPeriod(tracking.activatedAt, tracking.completedAt),
  };
}

export function listMyPublicCivicArchiveRecords(
  identity: RequestIdentity,
): PublicCivicArchiveRecord[] {
  return listArchiveRecordsByAuthor(identity.participantId);
}

export async function createPublicCivicArchiveDraft(
  identity: RequestIdentity,
  input: CreatePublicCivicArchiveDraftInput,
  deps: PublicCivicArchiveAncestryDependencies = defaultPublicCivicArchiveAncestryDependencies,
): Promise<PublicCivicArchiveRecord> {
  const resolved = await resolvePublicCivicArchiveSource(input.impactId, deps);

  assertPublicCivicArchiveEligibleForResolved(resolved, identity.participantId);

  const snapshot = await buildArchiveSnapshotFieldsForResolved(resolved);
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

  emitCivicNotificationEvent({
    eventType: "archive_published",
    entityType: "civic_archive",
    entityId: archiveRecordId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

  scheduleContentTranslationWarmAfterMutation({
    sourceKind: "civic_archive",
    sourceRecordId: archiveRecordId,
    reason: "public_mutation",
  });

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
