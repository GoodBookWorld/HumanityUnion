import type { Initiative, InitiativeCoverMedia, MyInitiativeGroupSummary, TimelineEvent } from "@hu/types";
import {
  canTransitionInitiativeLifecycle,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceBallotMode,
} from "@hu/types";

import type { RequestIdentity } from "./identity/request-identity.types.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import { createInitialInitiativeVersionRevision } from "../initiative-version-revision/initiative-version-revision.service.js";
import {
  deleteAlliesByInitiativeId,
  listAlliesByParticipantId,
} from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { deleteCollaborationChannelDataByInitiativeId } from "../initiative-collaboration-channel/persistence/initiative-collaboration-channel.repository.js";
import { deleteCollaborationSessionDataByInitiativeId } from "../initiative-collaboration-sessions/persistence/initiative-collaboration-sessions.repository.js";
import {
  deleteSharedDocumentsByInitiativeId,
  listAllSharedDocumentsByInitiativeId,
} from "../shared-documents/persistence/shared-documents.repository.js";
import { LocalSecureDocumentStorageProvider } from "../shared-documents/secure-document-storage.provider.js";
import { MediaUploadService, listMediaRecordsByInitiativeId } from "../media-upload/media-upload.service.js";
import {
  deleteNotificationsByRelatedEntity,
  emitCivicNotificationEvent,
} from "../notifications/notification.service.js";
import {
  createCommunityIntelligenceReminderCandidatesForPublishedInitiative,
  invalidateCommunityIntelligenceCache,
} from "../community-intelligence/index.js";
import { notifyInterestedParticipantsOfPublishedInitiative } from "../notifications/initiative-interest-match.service.js";
import { deleteRemindersByRelatedEntity } from "../reminders/reminder.service.js";
import { enrichInitiativeMetadataGeography } from "./initiative-geography.js";
import { assertInitiativeOwnership } from "./initiative-ownership.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
  listInitiativesBySteward,
  updateInitiative,
} from "./initiative.store.js";
import { toLatestInitiativeCardProjection } from "./initiative-latest-initiatives.projection.js";
import { resolveInitiativeParticipationScope } from "./initiative-world-initiatives.projection.js";
import {
  removeProjectedInitiativeCard,
  removeProjectedInitiativeCardFromAllCommunities,
  upsertProjectedInitiativeCard,
} from "./initiative-projection.store.js";
import {
  type CreateInitiativeDraftInput,
  type SaveInitiativeDraftInput,
  validateInitiativeForPublication,
} from "./initiative.validators.js";

function createTimelineEvent(eventType: string, metadata: Record<string, unknown>): TimelineEvent {
  return {
    eventId: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function assertDraftLifecycle(initiative: Initiative): void {
  if (initiative.lifecyclePhase !== "draft") {
    throw new Error("Only draft initiatives can be edited or published from this workflow.");
  }
}

function assertEditablePublishedLifecycle(initiative: Initiative): void {
  if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
    throw new Error("Only published or projected initiatives can be updated or republished.");
  }
}

function assertArchivableLifecycle(initiative: Initiative): void {
  if (initiative.lifecyclePhase === "archived") {
    throw new Error("Initiative is already archived.");
  }
}

/**
 * UX Evolution Pack 03 — the single place that keeps the legacy `imageUrl`
 * string in sync with the new `coverMedia` model, so every consumer that
 * still only reads `imageUrl` (world initiatives, cards, etc. — see
 * `resolveInitiativeCoverMedia`) never goes stale relative to what the
 * steward actually set as the current cover media:
 *
 * - "Remove Media" (`clearCoverMedia`) clears both.
 * - Setting `coverMedia` to an `image` keeps `imageUrl` pointing at the same
 *   uploaded file.
 * - Setting `coverMedia` to a `video_external` clears `imageUrl` — there is
 *   no still-image equivalent to fall back to, and continuing to show a
 *   stale previous image would be actively misleading.
 * - When the request does not touch `coverMedia` at all, both fields are
 *   left exactly as today's `imageUrl`-only behavior (full backward
 *   compatibility for any API client that never sends `coverMedia`).
 */
function resolveCoverMediaUpdate(
  initiative: Initiative,
  input: SaveInitiativeDraftInput,
): { coverMedia?: InitiativeCoverMedia; imageUrl?: string } {
  if (input.clearCoverMedia) {
    return { coverMedia: undefined, imageUrl: undefined };
  }

  if (input.coverMedia !== undefined) {
    return {
      coverMedia: input.coverMedia,
      imageUrl: input.coverMedia.type === "image" ? input.coverMedia.url : undefined,
    };
  }

  return {
    coverMedia: initiative.metadata.coverMedia,
    imageUrl: input.imageUrl ?? initiative.metadata.imageUrl,
  };
}

function applyInitiativeContentUpdate(
  initiative: Initiative,
  input: SaveInitiativeDraftInput,
): SaveInitiativeDraftInput {
  const coverMediaUpdate = resolveCoverMediaUpdate(initiative, input);

  return {
    title: input.title ?? initiative.title,
    description: input.description ?? initiative.description,
    communityAssociation: input.communityAssociation ?? initiative.metadata.communityAssociation,
    countrySlug: input.countrySlug ?? initiative.metadata.countrySlug,
    regionSlug: input.regionSlug ?? initiative.metadata.regionSlug,
    region: input.region ?? initiative.metadata.region,
    communitySlug: input.communitySlug ?? initiative.metadata.communitySlug,
    participationScope: input.participationScope ?? initiative.metadata.participationScope,
    activityArea: input.activityArea ?? initiative.metadata.activityArea,
    activityAreaOther: input.activityAreaOther ?? initiative.metadata.activityAreaOther,
    imageUrl: coverMediaUpdate.imageUrl,
    imageAltText: input.imageAltText ?? initiative.metadata.imageAltText,
    coverMedia: coverMediaUpdate.coverMedia,
    startDate: input.startDate ?? initiative.metadata.startDate,
    completionDate: input.completionDate ?? initiative.metadata.completionDate,
  };
}

function buildMetadataPatch(
  initiative: Initiative,
  input: SaveInitiativeDraftInput,
): Initiative["metadata"] {
  const content = applyInitiativeContentUpdate(initiative, input);

  return {
    ...initiative.metadata,
    communityAssociation: content.communityAssociation,
    countrySlug: content.countrySlug ?? initiative.metadata.countrySlug,
    regionSlug: content.regionSlug ?? initiative.metadata.regionSlug,
    region: input.region ?? initiative.metadata.region,
    communitySlug: content.communitySlug ?? initiative.metadata.communitySlug ?? "",
    participationScope:
      content.participationScope ?? initiative.metadata.participationScope ?? "community",
    activityArea: content.activityArea ?? initiative.metadata.activityArea,
    activityAreaOther: content.activityAreaOther,
    category: content.activityArea ?? initiative.metadata.activityArea,
    ballotMode:
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE"
        ? resolvePublicChoiceBallotMode(
            input.ballotMode !== undefined ? input.ballotMode : initiative.metadata.ballotMode,
          )
        : undefined,
    imageUrl: content.imageUrl,
    imageAltText: content.imageAltText,
    coverMedia: content.coverMedia,
    startDate: content.startDate,
    completionDate: content.completionDate,
  };
}

function syncProjectedInitiativeCard(initiative: Initiative, previousCommunitySlug?: string): void {
  if (previousCommunitySlug && previousCommunitySlug !== initiative.metadata.communitySlug) {
    removeProjectedInitiativeCard(previousCommunitySlug, initiative.initiativeId);
  }

  if (initiative.lifecyclePhase !== "projected") {
    return;
  }

  if (resolveInitiativeParticipationScope(initiative) !== "community") {
    return;
  }

  if (!initiative.metadata.communitySlug) {
    return;
  }

  const card = toLatestInitiativeCardProjection(initiative, 0);
  upsertProjectedInitiativeCard(initiative.metadata.communitySlug, card);
}

function removeInitiativeFromPublicProjection(initiative: Initiative): void {
  removeProjectedInitiativeCardFromAllCommunities(initiative.initiativeId);
}

export function listMyInitiatives(identity: RequestIdentity): Initiative[] {
  return listInitiativesBySteward(identity.participantId);
}

export interface MyInitiativeGroupsDependencies {
  listInitiativesStewardedBy: (participantId: string) => Initiative[];
  listAlliesByParticipantId: (participantId: string) => Promise<{ initiativeId: string; status: string }[]>;
  getInitiativeById: (initiativeId: string) => Initiative | null;
}

const defaultMyInitiativeGroupsDependencies: MyInitiativeGroupsDependencies = {
  listInitiativesStewardedBy: listInitiativesBySteward,
  listAlliesByParticipantId,
  getInitiativeById,
};

/**
 * Communication UX Pack 03.9 Part 3 — the "My Initiative Groups" picker for
 * Initiative Group Chat: every Initiative the signed-in Participant either
 * stewards (role `"author"`) or is an `active` Ally on (role
 * `"active_ally"`), deduplicated by `initiativeId` (a steward who is also
 * recorded as an Ally row on their own Initiative is only ever listed once,
 * as `"author"`). Composed entirely from the two existing reads used
 * elsewhere (`listInitiativesBySteward`, `listAlliesByParticipantId`) —
 * never a new persisted projection, so it can never drift from either
 * source of truth. Archived Initiatives are excluded: there is no
 * Collaboration Channel/Sessions surface left to open for them. Dependencies
 * are injectable (matching `workspace-allies.service.ts`) so this composition
 * is exercised fully MongoDB-free in tests.
 */
export async function listMyInitiativeGroups(
  identity: RequestIdentity,
  deps: MyInitiativeGroupsDependencies = defaultMyInitiativeGroupsDependencies,
): Promise<MyInitiativeGroupSummary[]> {
  const stewardedInitiatives = deps
    .listInitiativesStewardedBy(identity.participantId)
    .filter((initiative) => initiative.lifecyclePhase !== "archived");

  const groupsByInitiativeId = new Map<string, MyInitiativeGroupSummary>();

  for (const initiative of stewardedInitiatives) {
    groupsByInitiativeId.set(initiative.initiativeId, {
      initiativeId: initiative.initiativeId,
      title: initiative.title,
      lifecyclePhase: initiative.lifecyclePhase,
      role: "author",
    });
  }

  const ownAllyRows = await deps.listAlliesByParticipantId(identity.participantId);
  const activeAllyInitiativeIds = ownAllyRows
    .filter((ally) => ally.status === "active")
    .map((ally) => ally.initiativeId)
    .filter((initiativeId) => !groupsByInitiativeId.has(initiativeId));

  for (const initiativeId of activeAllyInitiativeIds) {
    const initiative = deps.getInitiativeById(initiativeId);

    if (!initiative || initiative.lifecyclePhase === "archived") {
      continue;
    }

    groupsByInitiativeId.set(initiativeId, {
      initiativeId: initiative.initiativeId,
      title: initiative.title,
      lifecyclePhase: initiative.lifecyclePhase,
      role: "active_ally",
    });
  }

  return [...groupsByInitiativeId.values()].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

export function createInitiativeDraft(
  identity: RequestIdentity,
  input: CreateInitiativeDraftInput,
): Initiative {
  const now = new Date().toISOString();
  const initiativeId = `initiative-${Date.now()}`;

  const initiative: Initiative = {
    initiativeId,
    stewardId: identity.participantId,
    createdAt: now,
    updatedAt: now,
    title: input.title,
    description: input.description,
    status: "draft",
    lifecyclePhase: "draft",
    lifecycleProfile: resolveInitiativeLifecycleProfile(input.lifecycleProfile),
    visibility: {
      policy: "public",
    },
    metadata: {
      category: input.activityArea ?? "",
      tags: [],
      region: "",
      language: "en",
      countrySlug: input.countrySlug,
      regionSlug: input.regionSlug,
      communitySlug: input.communitySlug ?? "",
      communityAssociation: input.communityAssociation,
      participationScope: input.participationScope ?? "community",
      activityArea: input.activityArea ?? "",
      activityAreaOther: input.activityAreaOther,
      ballotMode:
        resolveInitiativeLifecycleProfile(input.lifecycleProfile) === "PUBLIC_CHOICE"
          ? resolvePublicChoiceBallotMode(input.ballotMode)
          : undefined,
      imageUrl: input.coverMedia
        ? input.coverMedia.type === "image"
          ? input.coverMedia.url
          : undefined
        : input.imageUrl,
      imageAltText: input.imageAltText,
      coverMedia: input.coverMedia,
      startDate: input.startDate,
      completionDate: input.completionDate,
    },
    revisions: [],
    contributions: [],
    timeline: [
      createTimelineEvent("initiative_created", {
        lifecyclePhase: "draft",
        status: "draft",
      }),
    ],
    sourceReferences: input.sourceReferences ? structuredClone(input.sourceReferences) : undefined,
  };

  return createInitiative(initiative);
}

export function saveInitiativeDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeDraftInput,
): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertDraftLifecycle(initiative);

  if (
    input.ballotMode !== undefined &&
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
  ) {
    throw new Error("ballotMode is only valid for PUBLIC_CHOICE initiatives.");
  }

  const updated = updateInitiative(initiativeId, {
    title: input.title,
    description: input.description,
    metadata: buildMetadataPatch(initiative, input),
    sourceReferences: input.clearSourceReferences ? null : undefined,
    timeline: [
      ...initiative.timeline,
      createTimelineEvent("initiative_draft_saved", {
        lifecyclePhase: "draft",
      }),
    ],
  });

  if (!updated) {
    throw new Error("Initiative not found.");
  }

  return updated;
}

export function updatePublishedInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeDraftInput,
): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertEditablePublishedLifecycle(initiative);

  const content = applyInitiativeContentUpdate(initiative, input);

  const updated = updateInitiative(initiativeId, {
    title: content.title,
    description: content.description,
    metadata: buildMetadataPatch(initiative, input),
    timeline: [
      ...initiative.timeline,
      createTimelineEvent("initiative_updated", {
        lifecyclePhase: initiative.lifecyclePhase,
      }),
    ],
  });

  if (!updated) {
    throw new Error("Initiative not found.");
  }

  invalidateGlobalSearchIndex();
  invalidateCommunityIntelligenceCache(initiativeId);

  return updated;
}

export function publishInitiative(identity: RequestIdentity, initiativeId: string): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertDraftLifecycle(initiative);
  validateInitiativeForPublication(initiative);

  if (!canTransitionInitiativeLifecycle("draft", "published")) {
    throw new Error("Publishing is not allowed from the current lifecycle phase.");
  }

  const publishedAt = new Date().toISOString();
  const publishedTimeline = [
    ...initiative.timeline,
    createTimelineEvent("initiative_published", {
      lifecyclePhase: "published",
      status: "proposal",
    }),
  ];

  const published = updateInitiative(initiativeId, {
    status: "proposal",
    lifecyclePhase: "published",
    visibility: {
      policy: "public",
    },
    timeline: publishedTimeline,
  });

  if (!published) {
    throw new Error("Initiative not found.");
  }

  if (!canTransitionInitiativeLifecycle("published", "projected")) {
    throw new Error("Projection generation is not allowed from the current lifecycle phase.");
  }

  const projectedTimeline = [
    ...published.timeline,
    createTimelineEvent("initiative_projected", {
      lifecyclePhase: "projected",
      projectedAt: publishedAt,
    }),
  ];

  const projected = updateInitiative(initiativeId, {
    lifecyclePhase: "projected",
    timeline: projectedTimeline,
  });

  if (!projected) {
    throw new Error("Initiative not found.");
  }

  const geographyMetadata = enrichInitiativeMetadataGeography(projected, identity.participantId);
  const projectedWithGeography =
    updateInitiative(initiativeId, { metadata: geographyMetadata }) ?? projected;

  syncProjectedInitiativeCard(projectedWithGeography);
  createInitialInitiativeVersionRevision(projectedWithGeography, identity.participantId);

  emitCivicNotificationEvent({
    eventType: "initiative_published",
    entityType: "initiative",
    entityId: initiativeId,
    initiativeId,
    actorMemberId: identity.participantId,
  });

  void notifyInterestedParticipantsOfPublishedInitiative(
    projectedWithGeography,
    identity.participantId,
  ).catch(() => undefined);

  void createCommunityIntelligenceReminderCandidatesForPublishedInitiative(
    projectedWithGeography,
    identity.participantId,
  ).catch(() => undefined);

  invalidateGlobalSearchIndex();
  invalidateCommunityIntelligenceCache(initiativeId);

  return projectedWithGeography;
}

export function republishInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeDraftInput = {},
): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertEditablePublishedLifecycle(initiative);

  const previousCommunitySlug = initiative.metadata.communitySlug;
  const content = applyInitiativeContentUpdate(initiative, input);
  const nextMetadata = buildMetadataPatch(initiative, input);
  validateInitiativeForPublication({
    ...initiative,
    title: content.title ?? initiative.title,
    description: content.description ?? initiative.description,
    metadata: nextMetadata,
  });

  let current = initiative;

  const metadataChanged = JSON.stringify(nextMetadata) !== JSON.stringify(initiative.metadata);

  if (
    content.title !== initiative.title ||
    content.description !== initiative.description ||
    metadataChanged
  ) {
    const updated = updateInitiative(initiativeId, {
      title: content.title,
      description: content.description,
      metadata: nextMetadata,
      timeline: [
        ...initiative.timeline,
        createTimelineEvent("initiative_updated", {
          lifecyclePhase: initiative.lifecyclePhase,
        }),
      ],
    });

    if (!updated) {
      throw new Error("Initiative not found.");
    }

    current = updated;
  }

  if (current.lifecyclePhase === "published") {
    if (!canTransitionInitiativeLifecycle("published", "projected")) {
      throw new Error("Republishing is not allowed from the current lifecycle phase.");
    }

    const projected = updateInitiative(initiativeId, {
      lifecyclePhase: "projected",
      timeline: [
        ...current.timeline,
        createTimelineEvent("initiative_projected", {
          lifecyclePhase: "projected",
        }),
      ],
    });

    if (!projected) {
      throw new Error("Initiative not found.");
    }

    current = projected;
  }

  const republished = updateInitiative(initiativeId, {
    timeline: [
      ...current.timeline,
      createTimelineEvent("initiative_republished", {
        lifecyclePhase: "projected",
      }),
    ],
  });

  if (!republished) {
    throw new Error("Initiative not found.");
  }

  syncProjectedInitiativeCard(republished, previousCommunitySlug);
  invalidateGlobalSearchIndex();
  invalidateCommunityIntelligenceCache(initiativeId);

  return republished;
}

export function updateManagedInitiative(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeDraftInput,
): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  switch (initiative.lifecyclePhase) {
    case "draft":
      return saveInitiativeDraft(identity, initiativeId, input);
    case "published":
    case "projected":
      return updatePublishedInitiative(identity, initiativeId, input);
    case "archived":
      throw new Error("Archived initiatives cannot be updated.");
    default:
      throw new Error("Initiative update is not allowed from the current lifecycle phase.");
  }
}

export function archiveInitiative(identity: RequestIdentity, initiativeId: string): Initiative {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertArchivableLifecycle(initiative);

  if (!canTransitionInitiativeLifecycle(initiative.lifecyclePhase, "archived")) {
    throw new Error("Archive is not allowed from the current lifecycle phase.");
  }

  if (initiative.lifecyclePhase === "projected" || initiative.lifecyclePhase === "published") {
    removeInitiativeFromPublicProjection(initiative);
  }

  const archived = updateInitiative(initiativeId, {
    status: "archived",
    lifecyclePhase: "archived",
    timeline: [
      ...initiative.timeline,
      createTimelineEvent("initiative_archived", {
        lifecyclePhase: "archived",
      }),
    ],
  });

  if (!archived) {
    throw new Error("Initiative not found.");
  }

  invalidateGlobalSearchIndex();

  return archived;
}

function assertDeletableDraftLifecycle(initiative: Initiative): void {
  if (initiative.lifecyclePhase === "draft") {
    return;
  }

  if (initiative.lifecyclePhase === "archived") {
    throw new Error(
      "Only draft initiatives can be deleted. This Initiative has already been archived and is protected from deletion.",
    );
  }

  throw new Error(
    "Only draft initiatives can be deleted. This Initiative has already been published and is protected from deletion.",
  );
}

/**
 * Initiative UX Pack 01.1 Part 6 — final safety net before permanently
 * deleting a Draft. `lifecyclePhase === "draft"` should make it structurally
 * impossible for Decisions, Petitions, or Civic Archive records to exist
 * for this Initiative (every one of those surfaces requires
 * `canExposePublicInitiativeProjection`, i.e. `"projected"` + public — see
 * initiative-comments/initiative-support routes for the identical guard),
 * and lifecycle transitions are one-directional
 * (`INITIATIVE_LIFECYCLE_TRANSITIONS`), so a Draft can never have passed
 * through "published"/"projected" and back. This check exists purely as a
 * defensive, fail-safe backstop against that invariant ever being violated
 * elsewhere: if it ever finds such a record, it aborts loudly instead of
 * silently deleting alongside real civic history.
 */
async function assertNoProtectedDownstreamArtifacts(initiativeId: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();

  const protectedCollections = [
    MONGO_COLLECTIONS.decisionSessions,
    MONGO_COLLECTIONS.initiativeCollectiveDecisions,
    MONGO_COLLECTIONS.petitions,
    MONGO_COLLECTIONS.publicCivicArchiveRecords,
  ] as const;

  const counts = await Promise.all(
    protectedCollections.map((collectionName) =>
      getMongoCollection(collectionName).countDocuments({ initiativeId }),
    ),
  );

  if (counts.some((count) => count > 0)) {
    throw new Error(
      "Deleting this Draft Initiative is not allowed because it has associated civic records (Decisions, Petitions, or Civic Archive) that must be preserved.",
    );
  }
}

async function purgeDraftInitiativeMedia(initiativeId: string): Promise<void> {
  const records = listMediaRecordsByInitiativeId(initiativeId);

  if (records.length === 0) {
    return;
  }

  const { resolveMediaObjectStorage } = await import("../media-upload/resolve-media-object-storage.js");
  const mediaUploadService = new MediaUploadService(resolveMediaObjectStorage());

  for (const record of records) {
    await mediaUploadService.deleteMedia(record.mediaId);
  }
}

async function purgeDraftInitiativeSharedDocuments(initiativeId: string): Promise<void> {
  const records = await listAllSharedDocumentsByInitiativeId(initiativeId);

  if (records.length === 0) {
    return;
  }

  const storageProvider = new LocalSecureDocumentStorageProvider();

  for (const record of records) {
    await storageProvider.deleteFile(record.storageKey);
  }

  await deleteSharedDocumentsByInitiativeId(initiativeId);
}

/**
 * Initiative UX Pack 01.1 — permanently deletes an unpublished Draft
 * Initiative owned by the current Participant.
 *
 * Eligibility (Part 2), all enforced server-side and re-checked from the
 * persisted record on every call (never trusted from the client):
 *  - owned by `identity.participantId` (`getOwnedInitiative`);
 *  - `lifecyclePhase === "draft"` (`assertDeletableDraftLifecycle`) — since
 *    lifecycle transitions are one-directional, this alone also proves the
 *    Initiative was never published and is not archived.
 *
 * Cleanup order (Part 5/6 — "fail safely instead of partially deleting
 * data"): every dependent-data cleanup step runs and must succeed BEFORE
 * the Initiative record itself is removed. Each cleanup call is an exact,
 * idempotent `initiativeId`-scoped deletion (safe to retry), so if any
 * step throws, the Initiative is left completely untouched — still a
 * normal, editable Draft — rather than half-deleted. Only once every
 * dependent store has been cleaned is the Initiative record itself removed
 * as the final, irreversible step.
 */
export async function deleteInitiativeDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<void> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertDeletableDraftLifecycle(initiative);
  await assertNoProtectedDownstreamArtifacts(initiativeId);

  await purgeDraftInitiativeMedia(initiativeId);
  await purgeDraftInitiativeSharedDocuments(initiativeId);
  await deleteCollaborationChannelDataByInitiativeId(initiativeId);
  await deleteCollaborationSessionDataByInitiativeId(initiativeId);
  await deleteAlliesByInitiativeId(initiativeId);
  await deleteNotificationsByRelatedEntity("initiative", initiativeId);
  await deleteRemindersByRelatedEntity("initiative", initiativeId);

  const deleted = deleteInitiative(initiativeId);

  if (!deleted) {
    // Concurrent delete: another request already removed it between our
    // ownership check above and this final step.
    throw new Error("Initiative not found.");
  }
}
