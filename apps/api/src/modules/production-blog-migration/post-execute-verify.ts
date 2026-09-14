/**
 * Read-only post-execute Blog migration verifier.
 */

import type { Db } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
} from "./constants.js";
import { isBlogObjectIntegrityEquivalent, type BlogMediaCopyExecutor } from "./r2-copy.js";
import { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";

export interface BlogPostExecuteVerificationReport {
  tool: "verify-production-blog-migration";
  mode: "read-only";
  overallVerdict: "PASS" | "FAIL";
  collectionCounts: Record<string, number>;
  countMismatches: string[];
  posts: {
    expected: number;
    present: number;
    missingPostIds: string[];
    stagingMediaUrlLeaks: number;
    externalHttpsPreserveIntact: boolean;
  };
  subscribers: {
    expected: number;
    present: number;
    privateFieldsExposedInReport: false;
  };
  deliveries: {
    expected: number;
    present: number;
    invalidRelationships: number;
  };
  media: {
    expectedRecords: number;
    presentRecords: number;
    r2Equivalent: number;
    r2MissingOrMismatch: string[];
    productionBaseUrlOk: boolean;
  };
  participants: {
    checked: number;
    missing: string[];
  };
  forbiddenOperationalLeakage: string[];
  blockers: string[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function runPostExecuteBlogMigrationVerification(input: {
  sourceDb: Db;
  destinationDb: Db;
  mediaExecutor: BlogMediaCopyExecutor;
  expectedStorageKeys: readonly string[];
  migrationExecutionId?: string;
}): Promise<BlogPostExecuteVerificationReport> {
  const blockers: string[] = [];
  const countMismatches: string[] = [];
  const collectionCounts: Record<string, number> = {};

  for (const [name, expected] of Object.entries(EXPECTED_BLOG_COLLECTION_COUNTS)) {
    const actual = await input.destinationDb.collection(name).countDocuments({});
    collectionCounts[name] = actual;
    // Source has 4 categories; destination after migrate should also have 4
    // (3 seed preserved + human_potential inserted).
    if (actual !== expected) {
      countMismatches.push(`${name}: expected ${expected}, got ${actual}`);
      blockers.push(`Destination count mismatch for ${name}`);
    }
  }

  const sourcePosts = await input.sourceDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .find({})
    .project({ postId: 1, authorParticipantId: 1, categoryId: 1, status: 1, content: 1 })
    .toArray();
  const destPosts = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .find({})
    .toArray();
  const destPostById = new Map(
    destPosts
      .map((p) => [asString(p.postId), p] as const)
      .filter((row): row is [string, (typeof destPosts)[number]] => Boolean(row[0])),
  );

  const missingPostIds: string[] = [];
  let stagingMediaUrlLeaks = 0;
  let externalHttpsPreserveIntact = true;
  for (const source of sourcePosts) {
    const postId = asString(source.postId);
    if (!postId) continue;
    const dest = destPostById.get(postId);
    if (!dest) {
      missingPostIds.push(postId);
      continue;
    }
    if (asString(dest.authorParticipantId) !== asString(source.authorParticipantId)) {
      blockers.push(`Post ${postId} author mismatch`);
    }
    if (asString(dest.categoryId) !== asString(source.categoryId)) {
      blockers.push(`Post ${postId} category mismatch`);
    }
    if (asString(dest.status) !== asString(source.status)) {
      blockers.push(`Post ${postId} status mismatch`);
    }
    const content = typeof dest.content === "string" ? dest.content : "";
    if (/media-staging\.huws\.org/i.test(content)) {
      stagingMediaUrlLeaks += 1;
    }
    if (
      typeof source.content === "string" &&
      /i0\.wp\.com/i.test(source.content) &&
      !/i0\.wp\.com/i.test(content)
    ) {
      externalHttpsPreserveIntact = false;
      blockers.push(`External HTTPS preserve lost on post ${postId}`);
    }
    const coverUrl = asString(
      dest.coverMedia && typeof dest.coverMedia === "object"
        ? (dest.coverMedia as { mediaUrl?: unknown }).mediaUrl
        : null,
    );
    if (coverUrl && !coverUrl.startsWith(`${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/`)) {
      if (!/i0\.wp\.com/i.test(coverUrl)) {
        blockers.push(`Post ${postId} coverMedia not on production media base`);
      }
    }
  }
  if (missingPostIds.length) {
    blockers.push(`Missing destination posts count=${missingPostIds.length}`);
  }
  if (stagingMediaUrlLeaks > 0) {
    blockers.push(`Staging media URL leaks in post content count=${stagingMediaUrlLeaks}`);
  }

  const destSubscribers = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogSubscribers)
    .countDocuments({});
  const destDeliveries = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogPublicationDeliveries)
    .find({})
    .project({ deliveryId: 1, postId: 1, subscriberId: 1 })
    .toArray();
  const postIds = new Set(
    destPosts.map((p) => asString(p.postId)).filter((id): id is string => Boolean(id)),
  );
  const subscriberIds = new Set(
    (
      await input.destinationDb
        .collection(MONGO_COLLECTIONS.blogSubscribers)
        .find({})
        .project({ subscriberId: 1 })
        .toArray()
    )
      .map((s) => asString(s.subscriberId))
      .filter((id): id is string => Boolean(id)),
  );
  let invalidRelationships = 0;
  for (const delivery of destDeliveries) {
    const postId = asString(delivery.postId);
    const subscriberId = asString(delivery.subscriberId);
    if (!postId || !postIds.has(postId) || !subscriberId || !subscriberIds.has(subscriberId)) {
      invalidRelationships += 1;
    }
  }
  if (invalidRelationships > 0) {
    blockers.push(`Invalid delivery relationships count=${invalidRelationships}`);
  }

  const destCategories = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogCategories)
    .find({})
    .project({ categoryId: 1 })
    .toArray();
  const categoryIds = new Set(
    destCategories.map((c) => asString(c.categoryId)).filter((id): id is string => Boolean(id)),
  );
  for (const id of EXPECTED_CATEGORY_IDS) {
    if (!categoryIds.has(id)) {
      blockers.push(`Destination missing categoryId=${id}`);
    }
  }
  if (!categoryIds.has(EXPECTED_INSERT_CATEGORY_ID)) {
    blockers.push("Destination missing human_potential insert");
  }

  const participantIds = new Set<string>();
  for (const post of destPosts) {
    const id = asString(post.authorParticipantId);
    if (id) participantIds.add(id);
  }
  const missingParticipants: string[] = [];
  for (const participantId of [...participantIds].sort()) {
    const member = await input.destinationDb
      .collection(MONGO_COLLECTIONS.members)
      .findOne({ memberId: participantId }, { projection: { memberId: 1 } });
    if (!member) missingParticipants.push(participantId);
  }
  if (missingParticipants.length) {
    blockers.push(`Missing Participants count=${missingParticipants.length}`);
  }

  let presentRecords = 0;
  let r2Equivalent = 0;
  const r2MissingOrMismatch: string[] = [];
  let productionBaseUrlOk = true;
  for (const storageKey of input.expectedStorageKeys) {
    const record = await input.destinationDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .findOne({ storageKey });
    if (!record) {
      r2MissingOrMismatch.push(storageKey);
      continue;
    }
    presentRecords += 1;
    const mediaUrl = asString(record.mediaUrl) ?? "";
    if (!mediaUrl.startsWith(`${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/`)) {
      productionBaseUrlOk = false;
      blockers.push(`Media record URL not production base for ${storageKey}`);
    }
    const sourcePrepared = await input.mediaExecutor.prepareSourceObject(storageKey);
    const destInspect = await input.mediaExecutor.inspectDestinationObject(
      storageKey,
      input.migrationExecutionId,
    );
    if (
      !destInspect ||
      !isBlogObjectIntegrityEquivalent(
        {
          contentLength: sourcePrepared.contentLength,
          contentType: sourcePrepared.contentType,
          checksumSHA256: sourcePrepared.checksumSHA256,
        },
        {
          contentLength: destInspect.contentLength,
          contentType: destInspect.contentType,
          checksumSHA256: destInspect.checksumSHA256,
        },
      )
    ) {
      r2MissingOrMismatch.push(storageKey);
    } else {
      r2Equivalent += 1;
    }
  }
  if (r2MissingOrMismatch.length) {
    blockers.push(`R2 verify failures count=${r2MissingOrMismatch.length}`);
  }
  if (!productionBaseUrlOk) {
    blockers.push("Canonical media URLs must use production media base");
  }

  const forbiddenOperationalLeakage: string[] = [];
  for (const name of ["outbox", "processed_events"] as const) {
    // Presence of collection docs is fine; migration must not have written staging IDs.
    // We only flag if our tool wrote — verifier checks count stayed unmanaged by asserting
    // we never allow-list these collections (structural). Report empty leakage list unless
    // explicitly seeded test hooks add markers.
    const marked = await input.destinationDb.collection(name).findOne({
      migratedBy: "production-blog-migration",
    });
    if (marked) {
      forbiddenOperationalLeakage.push(name);
      blockers.push(`Forbidden operational leakage in ${name}`);
    }
  }

  const report: BlogPostExecuteVerificationReport = {
    tool: "verify-production-blog-migration",
    mode: "read-only",
    overallVerdict: blockers.length === 0 ? "PASS" : "FAIL",
    collectionCounts,
    countMismatches,
    posts: {
      expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts,
      present: destPosts.length,
      missingPostIds,
      stagingMediaUrlLeaks,
      externalHttpsPreserveIntact,
    },
    subscribers: {
      expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers,
      present: destSubscribers,
      privateFieldsExposedInReport: false,
    },
    deliveries: {
      expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_publication_deliveries,
      present: destDeliveries.length,
      invalidRelationships,
    },
    media: {
      expectedRecords: input.expectedStorageKeys.length,
      presentRecords,
      r2Equivalent,
      r2MissingOrMismatch,
      productionBaseUrlOk,
    },
    participants: {
      checked: participantIds.size,
      missing: missingParticipants,
    },
    forbiddenOperationalLeakage,
    blockers: [...new Set(blockers)],
  };

  const safe = stripForbiddenReportFields(report);
  assertNoSecretLeak(JSON.stringify(safe));
  return safe;
}
