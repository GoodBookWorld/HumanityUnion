import type { Initiative, TimelineEvent } from "@hu/types";
import { canTransitionInitiativeLifecycle } from "@hu/types";

import type { RequestIdentity } from "./identity/request-identity.types.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import { createInitialInitiativeVersionRevision } from "../initiative-version-revision/initiative-version-revision.service.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { notifyInterestedParticipantsOfPublishedInitiative } from "../notifications/initiative-interest-match.service.js";
import { enrichInitiativeMetadataGeography } from "./initiative-geography.js";
import { assertInitiativeOwnership } from "./initiative-ownership.js";
import {
  createInitiative,
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

function applyInitiativeContentUpdate(
  initiative: Initiative,
  input: SaveInitiativeDraftInput,
): SaveInitiativeDraftInput {
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
    imageUrl: input.imageUrl ?? initiative.metadata.imageUrl,
    imageAltText: input.imageAltText ?? initiative.metadata.imageAltText,
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
    imageUrl: content.imageUrl,
    imageAltText: content.imageAltText,
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
    visibility: {
      policy: "public",
    },
    metadata: {
      category: input.activityArea,
      tags: [],
      region: "",
      language: "en",
      countrySlug: input.countrySlug,
      regionSlug: input.regionSlug,
      communitySlug: input.communitySlug ?? "",
      communityAssociation: input.communityAssociation,
      participationScope: input.participationScope ?? "community",
      activityArea: input.activityArea,
      activityAreaOther: input.activityAreaOther,
      imageUrl: input.imageUrl,
      imageAltText: input.imageAltText,
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

  invalidateGlobalSearchIndex();

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
