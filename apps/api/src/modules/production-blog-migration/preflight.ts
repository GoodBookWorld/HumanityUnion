/**
 * Task Blog-02 — Read-only staging → production Blog migration preflight.
 */

import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  classifyHumanPotentialCategory,
  classifySeedCategoryPair,
  type CategoryCanonicalFields,
  type CategoryClassification,
} from "./categories.js";
import {
  BLOG_SUBSCRIPTION_TYPE,
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
} from "./constants.js";
import { isBlogMigrationR2Configured } from "./guards.js";
import {
  extractMediaReferencesFromPost,
  isExternalHttpsPreserveReference,
  storageKeyFromMediaUrl,
  summarizeMediaReferences,
  type ExtractedMediaReference,
  type MediaHostClassification,
} from "./media-inventory.js";
import { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";
import {
  DualBucketBlogR2Inspector,
  resolveDualBlogR2Config,
  verifyCanonicalBlogR2Objects,
  type BlogR2ObjectInspector,
} from "./r2-preflight.js";

export type BlogPreflightVerdict = "PASS" | "BLOCKED";

export type BlogPreflightMutationProof = {
  mongoWrites: number;
  putObjectCalls: number;
  deleteObjectCalls: number;
  emailSends: number;
  outboxWrites: number;
};

export interface BlogMigrationPreflightReport {
  tool: "preflight-production-blog-migration";
  mode: "read-only";
  sourceDatabase: string;
  destinationDatabase: string;
  expectedCounts: typeof EXPECTED_BLOG_COLLECTION_COUNTS;
  sourceInventory: {
    counts: Record<string, number>;
    countMismatches: string[];
    postIds: string[];
    categoryIds: string[];
    subscriberIds: string[];
    deliveryIds: string[];
    reactionIds: string[];
    grantParticipantIds: string[];
    applicationIds: string[];
    relationshipBlockers: string[];
  };
  destinationCollisions: {
    postId: string[];
    postSlug: string[];
    subscriberId: string[];
    subscriberEmailTypeOpaqueIds: string[];
    deliveryId: string[];
    deliveryPostSubscriber: string[];
    reactionId: string[];
    reactionPostActor: string[];
    grantParticipantId: string[];
    applicationId: string[];
    totalCollisionCount: number;
  };
  categories: {
    seedRows: Array<{
      categoryId: string;
      classification: CategoryClassification;
      sortOrderDiffers: boolean;
      divergentFields: string[];
      source: CategoryCanonicalFields | null;
      destination: CategoryCanonicalFields | null;
    }>;
    humanPotential: {
      classification: CategoryClassification;
      sourceMetadata: CategoryCanonicalFields | null;
    };
  };
  participantForeignKeys: {
    checked: number;
    missing: string[];
  };
  media: {
    totalPostMediaReferences: number;
    uniqueMediaIds: string[];
    uniqueStorageKeys: string[];
    bySource: Record<string, number>;
    byHostClassification: Record<MediaHostClassification, number>;
    externalHttpsPreserveCount: number;
    externalHttpsHosts: string[];
    canonicalStructuredMediaCount: number;
    missingMediaRecords: string[];
    unresolvedReferences: number;
    destinationMediaIdCollisions: string[];
    expectedCanonicalObjects: number;
    sourceObjectsPresent: number;
    sourceObjectsMissing: string[];
    destinationAbsent: number;
    destinationEquivalent: number;
    destinationCollisions: string[];
    r2ObjectVerification: "DEFERRED" | "PASS" | "FAIL";
    mediaCopyReady: boolean;
  };
  tokenPolicy: {
    preserveConfirmAndUnsubscribeHashes: true;
    rotateTokens: false;
    sendSubscriberEmail: false;
    hashesExposedInReport: false;
  };
  derivedDataPolicies: {
    content_translations: "REBUILD_OR_DEFER";
    global_search: "REBUILD";
    category_cache: "REBUILD";
    traffic_analytics: "DO_NOT_MIGRATE";
    outbox_processed_events: "DO_NOT_MIGRATE";
  };
  mutationProof: BlogPreflightMutationProof;
  blockers: string[];
  overallVerdict: BlogPreflightVerdict;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toCategoryFields(doc: Document | null | undefined): CategoryCanonicalFields | null {
  if (!doc) return null;
  const categoryId = asString(doc.categoryId);
  const slug = asString(doc.slug);
  const name = asString(doc.name);
  const status = asString(doc.status);
  if (!categoryId || !slug || !name || !status) return null;
  return {
    categoryId,
    slug,
    name,
    status,
    sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : undefined,
  };
}

async function countCollection(db: Db, name: string): Promise<number> {
  return db.collection(name).countDocuments({});
}

export async function runProductionBlogMigrationPreflight(input: {
  sourceDb: Db;
  destinationDb: Db;
  sourceDatabase?: string;
  destinationDatabase?: string;
  allowTestIsolation?: boolean;
  /** Test hook — force R2 configured flag. */
  r2Configured?: boolean;
  /** Injected R2 HEAD inspector (tests / CLI). */
  r2Inspector?: BlogR2ObjectInspector | null;
  mutationCounters?: Partial<BlogPreflightMutationProof>;
}): Promise<BlogMigrationPreflightReport> {
  const blockers: string[] = [];
  const sourceDatabase =
    input.sourceDatabase ?? PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE;
  const destinationDatabase =
    input.destinationDatabase ?? PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE;

  // --- 1. Source inventory ---
  const collectionNames = Object.keys(
    EXPECTED_BLOG_COLLECTION_COUNTS,
  ) as Array<keyof typeof EXPECTED_BLOG_COLLECTION_COUNTS>;
  const counts: Record<string, number> = {};
  const countMismatches: string[] = [];
  for (const name of collectionNames) {
    const actual = await countCollection(input.sourceDb, name);
    counts[name] = actual;
    const expected = EXPECTED_BLOG_COLLECTION_COUNTS[name];
    if (actual !== expected) {
      countMismatches.push(`${name}: expected ${expected}, got ${actual}`);
      blockers.push(`Source inventory count mismatch for ${name}`);
    }
  }

  const sourcePosts = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .find({})
    .project({
      postId: 1,
      slug: 1,
      authorParticipantId: 1,
      categoryId: 1,
      coverMedia: 1,
      optimization: 1,
      content: 1,
      status: 1,
    })
    .toArray();
  const sourceCategories = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogCategories)
    .find({})
    .project({ categoryId: 1, slug: 1, name: 1, status: 1, sortOrder: 1 })
    .toArray();
  const sourceSubscribers = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogSubscribers)
    .find({})
    .project({
      subscriberId: 1,
      emailNormalized: 1,
      subscriptionType: 1,
      participantId: 1,
      status: 1,
    })
    .toArray();
  const sourceDeliveries = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogPublicationDeliveries)
    .find({})
    .project({ deliveryId: 1, postId: 1, subscriberId: 1, status: 1 })
    .toArray();
  const sourceReactions = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogReactions)
    .find({})
    .project({ reactionId: 1, postId: 1, actorParticipantId: 1 })
    .toArray();
  const sourceGrants = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogCapabilityGrants)
    .find({})
    .project({ participantId: 1, grantedByParticipantId: 1 })
    .toArray();
  const sourceApplications = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogAuthorApplications)
    .find({})
    .project({
      applicationId: 1,
      participantId: 1,
      decidedByParticipantId: 1,
      preferredCategoryIds: 1,
    })
    .toArray();

  const postIds = sourcePosts
    .map((d) => asString(d.postId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const categoryIds = sourceCategories
    .map((d) => asString(d.categoryId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const subscriberIds = sourceSubscribers
    .map((d) => asString(d.subscriberId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const deliveryIds = sourceDeliveries
    .map((d) => asString(d.deliveryId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const reactionIds = sourceReactions
    .map((d) => asString(d.reactionId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const grantParticipantIds = sourceGrants
    .map((d) => asString(d.participantId))
    .filter((id): id is string => Boolean(id))
    .sort();
  const applicationIds = sourceApplications
    .map((d) => asString(d.applicationId))
    .filter((id): id is string => Boolean(id))
    .sort();

  const postIdSet = new Set(postIds);
  const categoryIdSet = new Set(categoryIds);
  const subscriberIdSet = new Set(subscriberIds);
  const relationshipBlockers: string[] = [];

  for (const id of EXPECTED_CATEGORY_IDS) {
    if (!categoryIdSet.has(id)) {
      relationshipBlockers.push(`Source missing expected categoryId=${id}`);
    }
  }
  for (const post of sourcePosts) {
    const postId = asString(post.postId) ?? "unknown";
    const categoryId = asString(post.categoryId);
    if (!categoryId || !categoryIdSet.has(categoryId)) {
      relationshipBlockers.push(`Post ${postId} categoryId missing/unknown`);
    }
    if (!asString(post.authorParticipantId)) {
      relationshipBlockers.push(`Post ${postId} missing authorParticipantId`);
    }
  }
  for (const delivery of sourceDeliveries) {
    const deliveryId = asString(delivery.deliveryId) ?? "unknown";
    const postId = asString(delivery.postId);
    const subscriberId = asString(delivery.subscriberId);
    if (!postId || !postIdSet.has(postId)) {
      relationshipBlockers.push(`Delivery ${deliveryId} postId invalid`);
    }
    if (!subscriberId || !subscriberIdSet.has(subscriberId)) {
      relationshipBlockers.push(`Delivery ${deliveryId} subscriberId invalid`);
    }
  }
  for (const reaction of sourceReactions) {
    const reactionId = asString(reaction.reactionId) ?? "unknown";
    const postId = asString(reaction.postId);
    if (!postId || !postIdSet.has(postId)) {
      relationshipBlockers.push(`Reaction ${reactionId} postId invalid`);
    }
    if (!asString(reaction.actorParticipantId)) {
      relationshipBlockers.push(`Reaction ${reactionId} missing actorParticipantId`);
    }
  }
  for (const app of sourceApplications) {
    const applicationId = asString(app.applicationId) ?? "unknown";
    const preferred = Array.isArray(app.preferredCategoryIds)
      ? app.preferredCategoryIds
      : [];
    for (const raw of preferred) {
      const categoryId = asString(raw);
      if (categoryId && !categoryIdSet.has(categoryId)) {
        relationshipBlockers.push(
          `Application ${applicationId} preferredCategoryId unknown=${categoryId}`,
        );
      }
    }
  }
  blockers.push(...relationshipBlockers);

  // --- 2. Destination collisions ---
  const destPosts = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .find({})
    .project({ postId: 1, slug: 1 })
    .toArray();
  const destPostIds = new Set(
    destPosts.map((d) => asString(d.postId)).filter((id): id is string => Boolean(id)),
  );
  const destPostSlugs = new Set(
    destPosts.map((d) => asString(d.slug)).filter((id): id is string => Boolean(id)),
  );
  const postIdCollisions = postIds.filter((id) => destPostIds.has(id));
  const postSlugCollisions = sourcePosts
    .map((d) => asString(d.slug))
    .filter((slug): slug is string => Boolean(slug))
    .filter((slug) => destPostSlugs.has(slug));

  const destSubscribers = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogSubscribers)
    .find({})
    .project({ subscriberId: 1, emailNormalized: 1, subscriptionType: 1 })
    .toArray();
  const destSubscriberIds = new Set(
    destSubscribers
      .map((d) => asString(d.subscriberId))
      .filter((id): id is string => Boolean(id)),
  );
  const destEmailTypeKeys = new Set(
    destSubscribers
      .map((d) => {
        const email = asString(d.emailNormalized);
        const type = asString(d.subscriptionType) ?? BLOG_SUBSCRIPTION_TYPE;
        return email ? `${email}::${type}` : null;
      })
      .filter((k): k is string => Boolean(k)),
  );
  const subscriberIdCollisions = subscriberIds.filter((id) => destSubscriberIds.has(id));
  const subscriberEmailTypeOpaqueIds: string[] = [];
  for (const sub of sourceSubscribers) {
    const subscriberId = asString(sub.subscriberId);
    const email = asString(sub.emailNormalized);
    const type = asString(sub.subscriptionType) ?? BLOG_SUBSCRIPTION_TYPE;
    if (!subscriberId || !email) continue;
    if (destEmailTypeKeys.has(`${email}::${type}`)) {
      subscriberEmailTypeOpaqueIds.push(subscriberId);
    }
  }

  const destDeliveries = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogPublicationDeliveries)
    .find({})
    .project({ deliveryId: 1, postId: 1, subscriberId: 1 })
    .toArray();
  const destDeliveryIds = new Set(
    destDeliveries
      .map((d) => asString(d.deliveryId))
      .filter((id): id is string => Boolean(id)),
  );
  const destDeliveryPairs = new Set(
    destDeliveries
      .map((d) => {
        const postId = asString(d.postId);
        const subscriberId = asString(d.subscriberId);
        return postId && subscriberId ? `${postId}::${subscriberId}` : null;
      })
      .filter((k): k is string => Boolean(k)),
  );
  const deliveryIdCollisions = deliveryIds.filter((id) => destDeliveryIds.has(id));
  const deliveryPostSubscriberCollisions = sourceDeliveries
    .map((d) => {
      const postId = asString(d.postId);
      const subscriberId = asString(d.subscriberId);
      return postId && subscriberId ? `${postId}::${subscriberId}` : null;
    })
    .filter((k): k is string => Boolean(k))
    .filter((k) => destDeliveryPairs.has(k));

  const destReactions = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogReactions)
    .find({})
    .project({ reactionId: 1, postId: 1, actorParticipantId: 1 })
    .toArray();
  const destReactionIds = new Set(
    destReactions
      .map((d) => asString(d.reactionId))
      .filter((id): id is string => Boolean(id)),
  );
  const destReactionPairs = new Set(
    destReactions
      .map((d) => {
        const postId = asString(d.postId);
        const actor = asString(d.actorParticipantId);
        return postId && actor ? `${postId}::${actor}` : null;
      })
      .filter((k): k is string => Boolean(k)),
  );
  const reactionIdCollisions = reactionIds.filter((id) => destReactionIds.has(id));
  const reactionPostActorCollisions = sourceReactions
    .map((d) => {
      const postId = asString(d.postId);
      const actor = asString(d.actorParticipantId);
      return postId && actor ? `${postId}::${actor}` : null;
    })
    .filter((k): k is string => Boolean(k))
    .filter((k) => destReactionPairs.has(k));

  const destGrants = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogCapabilityGrants)
    .find({})
    .project({ participantId: 1 })
    .toArray();
  const destGrantParticipants = new Set(
    destGrants
      .map((d) => asString(d.participantId))
      .filter((id): id is string => Boolean(id)),
  );
  const grantParticipantCollisions = grantParticipantIds.filter((id) =>
    destGrantParticipants.has(id),
  );

  const destApplications = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogAuthorApplications)
    .find({})
    .project({ applicationId: 1 })
    .toArray();
  const destApplicationIds = new Set(
    destApplications
      .map((d) => asString(d.applicationId))
      .filter((id): id is string => Boolean(id)),
  );
  const applicationIdCollisions = applicationIds.filter((id) => destApplicationIds.has(id));

  const collisionBuckets = [
    postIdCollisions,
    postSlugCollisions,
    subscriberIdCollisions,
    subscriberEmailTypeOpaqueIds,
    deliveryIdCollisions,
    deliveryPostSubscriberCollisions,
    reactionIdCollisions,
    reactionPostActorCollisions,
    grantParticipantCollisions,
    applicationIdCollisions,
  ];
  const totalCollisionCount = collisionBuckets.reduce((sum, rows) => sum + rows.length, 0);
  if (totalCollisionCount > 0) {
    blockers.push(`Destination collisions detected total=${totalCollisionCount}`);
  }

  // --- 3. Categories ---
  const destCategories = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogCategories)
    .find({})
    .project({ categoryId: 1, slug: 1, name: 1, status: 1, sortOrder: 1 })
    .toArray();
  const sourceCategoryById = new Map(
    sourceCategories
      .map((d) => toCategoryFields(d))
      .filter((c): c is CategoryCanonicalFields => Boolean(c))
      .map((c) => [c.categoryId, c]),
  );
  const destCategoryById = new Map(
    destCategories
      .map((d) => toCategoryFields(d))
      .filter((c): c is CategoryCanonicalFields => Boolean(c))
      .map((c) => [c.categoryId, c]),
  );
  const destCategoryBySlug = new Map(
    [...destCategoryById.values()].map((c) => [c.slug, c]),
  );

  const seedRows = EXPECTED_SEED_CATEGORY_IDS.map((categoryId) => {
    const source = sourceCategoryById.get(categoryId) ?? null;
    const destination = destCategoryById.get(categoryId) ?? null;
    const classified = classifySeedCategoryPair({ source, destination });
    if (classified.classification === "DIVERGENT") {
      blockers.push(`Category ${categoryId} divergent: ${classified.divergentFields.join(",")}`);
    }
    if (classified.classification === "SOURCE_MISSING") {
      blockers.push(`Category ${categoryId} missing on source`);
    }
    if (classified.classification === "UNEXPECTED") {
      blockers.push(`Category ${categoryId} missing on destination (expected seed present)`);
    }
    return {
      categoryId,
      classification: classified.classification,
      sortOrderDiffers: classified.sortOrderDiffers,
      divergentFields: classified.divergentFields,
      source,
      destination,
    };
  });

  const humanSource = sourceCategoryById.get(EXPECTED_INSERT_CATEGORY_ID) ?? null;
  const humanClassified = classifyHumanPotentialCategory({
    source: humanSource,
    destinationById: destCategoryById.get(EXPECTED_INSERT_CATEGORY_ID) ?? null,
    destinationBySlug: humanSource
      ? destCategoryBySlug.get(humanSource.slug) ?? null
      : null,
  });
  if (humanClassified.classification !== "INSERT") {
    blockers.push(
      `human_potential classification=${humanClassified.classification} (expected INSERT)`,
    );
  }

  // --- 4. Participant FKs ---
  const participantIds = new Set<string>();
  for (const post of sourcePosts) {
    const id = asString(post.authorParticipantId);
    if (id) participantIds.add(id);
  }
  for (const reaction of sourceReactions) {
    const id = asString(reaction.actorParticipantId);
    if (id) participantIds.add(id);
  }
  for (const grant of sourceGrants) {
    const id = asString(grant.participantId);
    if (id) participantIds.add(id);
    const grantedBy = asString(grant.grantedByParticipantId);
    if (grantedBy) participantIds.add(grantedBy);
  }
  for (const app of sourceApplications) {
    const id = asString(app.participantId);
    if (id) participantIds.add(id);
    const decidedBy = asString(app.decidedByParticipantId);
    if (decidedBy) participantIds.add(decidedBy);
  }
  for (const sub of sourceSubscribers) {
    const id = asString(sub.participantId);
    if (id) participantIds.add(id);
  }

  const missingParticipants: string[] = [];
  for (const participantId of [...participantIds].sort()) {
    const member = await input.destinationDb
      .collection(MONGO_COLLECTIONS.members)
      .findOne({ memberId: participantId }, { projection: { memberId: 1 } });
    if (!member) {
      missingParticipants.push(participantId);
    }
  }
  if (missingParticipants.length > 0) {
    blockers.push(
      `Destination missing Participants count=${missingParticipants.length}`,
    );
  }

  // --- 5. Media inventory ---
  const mediaRefs: ExtractedMediaReference[] = [];
  for (const post of sourcePosts) {
    const postId = asString(post.postId);
    if (!postId) continue;
    mediaRefs.push(
      ...extractMediaReferencesFromPost({
        postId,
        coverMedia: post.coverMedia,
        optimization: post.optimization as { socialImage?: unknown } | null,
        content: post.content,
      }),
    );
  }
  const mediaSummary = summarizeMediaReferences(mediaRefs);
  const uniqueMediaIds = [
    ...new Set(mediaRefs.map((r) => r.mediaId).filter((id): id is string => Boolean(id))),
  ].sort();
  const uniqueStorageKeys = new Set<string>();
  const missingMediaRecords: string[] = [];
  let unresolvedReferences = 0;

  for (const ref of mediaRefs) {
    // Legacy external HTTPS without mediaId (e.g. i0.wp.com WordPress in HTML).
    // Never invent storageKey, never require media_upload_records, never R2-copy.
    // Structured cover/social with mediaId are never skipped here — even on *.r2.dev URLs.
    if (isExternalHttpsPreserveReference(ref)) {
      continue;
    }

    let resolvedStorageKey: string | null = null;
    if (ref.mediaId) {
      const record = await input.sourceDb
        .collection(MONGO_COLLECTIONS.mediaUploadRecords)
        .findOne(
          { mediaId: ref.mediaId },
          { projection: { mediaId: 1, storageKey: 1, mediaUrl: 1 } },
        );
      if (!record) {
        missingMediaRecords.push(ref.mediaId);
        unresolvedReferences += 1;
      } else {
        resolvedStorageKey = asString(record.storageKey);
      }
    } else if (ref.mediaUrl) {
      // Canonical HU URLs only — storageKeyFromMediaUrl returns null for externals.
      resolvedStorageKey = storageKeyFromMediaUrl(ref.mediaUrl);
      if (!resolvedStorageKey) {
        unresolvedReferences += 1;
      } else {
        const byKey = await input.sourceDb
          .collection(MONGO_COLLECTIONS.mediaUploadRecords)
          .findOne(
            { storageKey: resolvedStorageKey },
            { projection: { mediaId: 1, storageKey: 1 } },
          );
        if (!byKey) {
          unresolvedReferences += 1;
        }
      }
    } else {
      unresolvedReferences += 1;
    }
    if (resolvedStorageKey) uniqueStorageKeys.add(resolvedStorageKey);
  }

  const uniqueMissing = [...new Set(missingMediaRecords)].sort();
  if (uniqueMissing.length > 0) {
    blockers.push(`Missing source media_upload_records count=${uniqueMissing.length}`);
  }
  if (unresolvedReferences > 0) {
    blockers.push(`Unresolved media references count=${unresolvedReferences}`);
  }

  const destinationMediaIdCollisions: string[] = [];
  for (const mediaId of uniqueMediaIds) {
    const dest = await input.destinationDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .findOne({ mediaId }, { projection: { mediaId: 1 } });
    if (dest) destinationMediaIdCollisions.push(mediaId);
  }
  if (destinationMediaIdCollisions.length > 0) {
    blockers.push(
      `Destination mediaId collisions count=${destinationMediaIdCollisions.length}`,
    );
  }

  const r2Configured =
    input.r2Configured ?? isBlogMigrationR2Configured(process.env);

  let expectedCanonicalObjects = 0;
  let sourceObjectsPresent = 0;
  let sourceObjectsMissing: string[] = [];
  let destinationAbsent = 0;
  let destinationEquivalent = 0;
  let destinationCollisions: string[] = [];
  let r2ObjectVerification: "DEFERRED" | "PASS" | "FAIL" = "DEFERRED";
  let mediaCopyReady = false;
  let r2PutCalls = 0;
  let r2DeleteCalls = 0;

  const canonicalKeys = [...uniqueStorageKeys].sort();
  expectedCanonicalObjects = canonicalKeys.length;

  if (!r2Configured && !input.r2Inspector) {
    r2ObjectVerification = "DEFERRED";
    mediaCopyReady = false;
  } else {
    let inspector = input.r2Inspector ?? null;
    if (!inspector) {
      try {
        inspector = new DualBucketBlogR2Inspector(resolveDualBlogR2Config());
      } catch (error) {
        blockers.push(
          `Blog R2 configuration/integrity failure: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        r2ObjectVerification = "FAIL";
        mediaCopyReady = false;
      }
    }
    if (inspector) {
      const r2Report = await verifyCanonicalBlogR2Objects({
        storageKeys: canonicalKeys,
        inspector,
      });
      expectedCanonicalObjects = r2Report.expectedCanonicalObjects;
      sourceObjectsPresent = r2Report.sourceObjectsPresent;
      sourceObjectsMissing = r2Report.sourceObjectsMissing;
      destinationAbsent = r2Report.destinationAbsent;
      destinationEquivalent = r2Report.destinationEquivalent;
      destinationCollisions = r2Report.destinationCollisions;
      r2ObjectVerification = r2Report.r2ObjectVerification;
      mediaCopyReady = r2Report.mediaCopyReady;
      r2PutCalls = r2Report.putObjectCalls;
      r2DeleteCalls = r2Report.deleteObjectCalls;
      blockers.push(...r2Report.blockers);
    }
  }

  // --- Mutation proof ---
  const mutationProof: BlogPreflightMutationProof = {
    mongoWrites: input.mutationCounters?.mongoWrites ?? 0,
    putObjectCalls: (input.mutationCounters?.putObjectCalls ?? 0) + r2PutCalls,
    deleteObjectCalls: (input.mutationCounters?.deleteObjectCalls ?? 0) + r2DeleteCalls,
    emailSends: input.mutationCounters?.emailSends ?? 0,
    outboxWrites: input.mutationCounters?.outboxWrites ?? 0,
  };
  if (
    mutationProof.mongoWrites ||
    mutationProof.putObjectCalls ||
    mutationProof.deleteObjectCalls ||
    mutationProof.emailSends ||
    mutationProof.outboxWrites
  ) {
    blockers.push("Refusing PASS: mutation detected during read-only Blog preflight");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const overallVerdict: BlogPreflightVerdict =
    uniqueBlockers.length === 0 ? "PASS" : "BLOCKED";

  const report: BlogMigrationPreflightReport = {
    tool: "preflight-production-blog-migration",
    mode: "read-only",
    sourceDatabase,
    destinationDatabase,
    expectedCounts: EXPECTED_BLOG_COLLECTION_COUNTS,
    sourceInventory: {
      counts,
      countMismatches,
      postIds,
      categoryIds,
      subscriberIds,
      deliveryIds,
      reactionIds,
      grantParticipantIds,
      applicationIds,
      relationshipBlockers,
    },
    destinationCollisions: {
      postId: postIdCollisions,
      postSlug: [...new Set(postSlugCollisions)].sort(),
      subscriberId: subscriberIdCollisions,
      subscriberEmailTypeOpaqueIds: [...new Set(subscriberEmailTypeOpaqueIds)].sort(),
      deliveryId: deliveryIdCollisions,
      deliveryPostSubscriber: deliveryPostSubscriberCollisions,
      reactionId: reactionIdCollisions,
      reactionPostActor: reactionPostActorCollisions,
      grantParticipantId: grantParticipantCollisions,
      applicationId: applicationIdCollisions,
      totalCollisionCount,
    },
    categories: {
      seedRows,
      humanPotential: {
        classification: humanClassified.classification,
        sourceMetadata: humanClassified.sourceMetadata,
      },
    },
    participantForeignKeys: {
      checked: participantIds.size,
      missing: missingParticipants,
    },
    media: {
      totalPostMediaReferences: mediaSummary.totalReferences,
      uniqueMediaIds,
      uniqueStorageKeys: [...uniqueStorageKeys].sort(),
      bySource: mediaSummary.bySource,
      byHostClassification: mediaSummary.byHostClassification,
      externalHttpsPreserveCount: mediaSummary.externalHttpsPreserveCount,
      externalHttpsHosts: mediaSummary.externalHttpsHosts,
      canonicalStructuredMediaCount: mediaSummary.canonicalStructuredMediaCount,
      missingMediaRecords: uniqueMissing,
      unresolvedReferences,
      destinationMediaIdCollisions,
      expectedCanonicalObjects,
      sourceObjectsPresent,
      sourceObjectsMissing,
      destinationAbsent,
      destinationEquivalent,
      destinationCollisions,
      r2ObjectVerification,
      mediaCopyReady,
    },
    tokenPolicy: {
      preserveConfirmAndUnsubscribeHashes: true,
      rotateTokens: false,
      sendSubscriberEmail: false,
      hashesExposedInReport: false,
    },
    derivedDataPolicies: {
      content_translations: "REBUILD_OR_DEFER",
      global_search: "REBUILD",
      category_cache: "REBUILD",
      traffic_analytics: "DO_NOT_MIGRATE",
      outbox_processed_events: "DO_NOT_MIGRATE",
    },
    mutationProof,
    blockers: uniqueBlockers,
    overallVerdict,
  };

  const safe = stripForbiddenReportFields(report);
  assertNoSecretLeak(JSON.stringify(safe));
  return safe;
}
