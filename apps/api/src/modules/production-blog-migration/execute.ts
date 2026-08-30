/**
 * Task Blog-04 — Controlled staging → production Blog migration executor.
 * Independent of production-initiative-migration.
 *
 * Default: dry-run (zero writes).
 * Execute requires --execute + CONFIRM=YES + fresh preflight PASS + R2 PASS + mediaCopyReady.
 */

import { randomUUID } from "node:crypto";

import type { ClientSession, Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { invalidateBlogCategoryCache } from "../blog/blog-categories.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import {
  CRASH_SAFE_BLOG_EXECUTION_ORDER,
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
} from "./constants.js";
import {
  prepareBlogDeliveryForMigration,
  prepareBlogSubscriberForMigration,
  prepareIdentityDocument,
  sanitizeBlogPostForMigration,
  sanitizeMediaUploadRecordForBlogMigration,
} from "./documents.js";
import { ProductionBlogMigrationError } from "./errors.js";
import {
  assertBlogMigrationDestinationDatabase,
  assertBlogMigrationExecuteWriteGuards,
  assertBlogMigrationSourceDatabase,
  assertBlogMigrationWritableCollection,
  resolveBlogMigrationMode,
} from "./guards.js";
import {
  InMemoryBlogDurableMediaRecoveryStore,
  MongoBlogDurableMediaRecoveryStore,
  type BlogDurableMediaRecoveryStore,
} from "./media-recovery-store.js";
import { BlogMigrationOwnershipLedger } from "./ownership-ledger.js";
import {
  runProductionBlogMigrationPreflight,
  type BlogMigrationPreflightReport,
} from "./preflight.js";
import {
  DeferredBlogMediaCopyExecutor,
  destinationUrlForBlogStorageKey,
  DualBucketBlogR2CopyExecutor,
  resolveDualBlogR2CopyConfig,
  type BlogMediaCopyExecutor,
} from "./r2-copy.js";
import {
  DualBucketBlogR2Inspector,
  InMemoryBlogR2Inspector,
  resolveDualBlogR2Config,
  type BlogR2ObjectInspector,
} from "./r2-preflight.js";
import { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";
import {
  InMemoryBlogRunRecoveryStore,
  MongoBlogRunRecoveryStore,
  type BlogRunRecoveryStore,
} from "./run-recovery-store.js";
import {
  runPostExecuteBlogMigrationVerification,
  type BlogPostExecuteVerificationReport,
} from "./post-execute-verify.js";
import { reconcileBlogMediaCreateAttempted } from "./recovery.js";

export type BlogMigrationPhase = (typeof CRASH_SAFE_BLOG_EXECUTION_ORDER)[number];

export interface DualBlogMongoHandles {
  sourceClient: MongoClient;
  sourceDb: Db;
  sourceDatabase: string;
  destinationClient: MongoClient;
  destinationDb: Db;
  destinationDatabase: string;
}

export interface RunProductionBlogMigrationInput {
  handles: DualBlogMongoHandles;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
  /** Test-only: allow non-transactional writes on hu_test_* destinations. */
  forceNonTransactional?: boolean;
  r2Configured?: boolean;
  r2Inspector?: BlogR2ObjectInspector | null;
  mediaExecutor?: BlogMediaCopyExecutor;
  durableMediaRecoveryStore?: BlogDurableMediaRecoveryStore;
  runRecoveryStore?: BlogRunRecoveryStore;
  /** Test hook: throw after R2 copy, before Mongo commit. */
  crashAfterR2Copy?: boolean;
  /** Test hook: throw after successful PUT before durable owned/verified ledger update. */
  crashAfterPutBeforeLedger?: boolean;
  /** Test hook: throw after Mongo commit. */
  crashAfterMongoCommit?: boolean;
  mutationCounters?: {
    emailSends?: number;
    outboxWrites?: number;
  };
}

export interface BlogPhaseResult {
  phase: BlogMigrationPhase | string;
  status: "planned" | "completed" | "skipped" | "failed" | "deferred";
  counts: Record<string, number>;
  notes: string[];
}

export interface BlogMigrationExecutionReport {
  tool: "execute-production-blog-migration";
  mode: "dry-run" | "execute";
  migrationExecutionId: string;
  sourceDatabase: string;
  destinationDatabase: string;
  overallStatus: "SUCCESS" | "FAILED" | "DRY_RUN" | "ALREADY_COMPLETE" | "RECOVERY_REQUIRED";
  phases: BlogPhaseResult[];
  preflight: {
    overallVerdict: BlogMigrationPreflightReport["overallVerdict"];
    r2ObjectVerification: BlogMigrationPreflightReport["media"]["r2ObjectVerification"];
    mediaCopyReady: boolean;
    externalHttpsPreserveCount: number;
    uniqueStorageKeyCount: number;
  } | null;
  ownership: ReturnType<BlogMigrationOwnershipLedger["toSafeReport"]>;
  media: {
    plannedCopies: number;
    copied: number;
    alreadyEquivalent: number;
    storageKeys: string[];
  };
  derivedState: {
    categoryCache: "INVALIDATED" | "DEFERRED";
    globalSearch: "INVALIDATED" | "DEFERRED";
    contentTranslations: "DEFERRED";
    trafficAnalytics: "DO_NOT_MIGRATE";
  };
  postExecuteVerification: BlogPostExecuteVerificationReport | null;
  mutationProof: {
    emailSends: number;
    outboxWrites: number;
    putObjectCalls: number;
    deleteObjectCalls: number;
  };
  rollback: {
    strategy: string;
    mediaKeysDeleted: number;
    mongoInsertsRolledBack: number;
  };
  blockers: string[];
  crashSafeOrder: readonly string[];
  notes: string[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function withRequiredBlogTransaction(input: {
  client: MongoClient;
  destinationDatabase: string;
  allowTestIsolation?: boolean;
  forceNonTransactional?: boolean;
  work: (session: ClientSession | null) => Promise<void>;
}): Promise<void> {
  const isProduction =
    input.destinationDatabase === PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE;
  if (input.forceNonTransactional) {
    if (isProduction) {
      throw new ProductionBlogMigrationError(
        "forceNonTransactional is forbidden on humanity_union_production.",
        "FORCE_NON_TRANSACTIONAL_FORBIDDEN",
      );
    }
    if (!input.allowTestIsolation) {
      throw new ProductionBlogMigrationError(
        "forceNonTransactional requires allowTestIsolation.",
        "FORCE_NON_TRANSACTIONAL_FORBIDDEN",
      );
    }
    await input.work(null);
    return;
  }

  const session = input.client.startSession();
  try {
    await session.withTransaction(async () => {
      await input.work(session);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Transaction numbers are only allowed|transactions are not supported/i.test(message)) {
      throw new ProductionBlogMigrationError(
        "Mongo transactions required for Blog migration; topology does not support them.",
        "TRANSACTION_REQUIRED",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function insertOwned(input: {
  db: Db;
  collection: string;
  doc: Document;
  primaryFilter: Record<string, unknown>;
  phase: string;
  ledger: BlogMigrationOwnershipLedger;
  session: ClientSession | null;
  mode: "dry-run" | "execute";
}): Promise<void> {
  assertBlogMigrationWritableCollection(input.collection);
  if (input.mode === "dry-run") {
    input.ledger.recordMongoInsert({
      collection: input.collection,
      insertedId: null,
      primaryFilter: input.primaryFilter,
      phase: input.phase,
    });
    return;
  }
  if (!input.session && input.mode === "execute") {
    // Allowed only via forceNonTransactional test path (session null).
  }
  const result = await input.db.collection(input.collection).insertOne(input.doc, {
    session: input.session ?? undefined,
  });
  input.ledger.recordMongoInsert({
    collection: input.collection,
    insertedId: result.insertedId,
    primaryFilter: input.primaryFilter,
    phase: input.phase,
  });
}

async function rollbackOwnedMongoInserts(input: {
  db: Db;
  ledger: BlogMigrationOwnershipLedger;
}): Promise<number> {
  let deleted = 0;
  for (const row of [...input.ledger.rollbackEligibleMongoInserts()].reverse()) {
    if (row.insertedId == null) continue;
    await input.db.collection(row.collection).deleteOne({ _id: row.insertedId });
    deleted += 1;
  }
  return deleted;
}

export async function rollbackOwnedBlogMediaObjects(input: {
  executor: BlogMediaCopyExecutor;
  ledger: BlogMigrationOwnershipLedger;
  durableStore?: BlogDurableMediaRecoveryStore | null;
}): Promise<number> {
  let deleted = 0;
  for (const key of input.ledger.rollbackEligibleMediaKeys()) {
    await input.executor.deleteOwnedObject(key, input.ledger.migrationExecutionId);
    deleted += 1;
    if (input.durableStore) {
      try {
        await input.durableStore.markRollbackDeleted(
          input.ledger.migrationExecutionId,
          key,
        );
      } catch {
        await input.durableStore.markRollbackFailed(
          input.ledger.migrationExecutionId,
          key,
        );
      }
    }
  }
  return deleted;
}

function buildPhase(
  phase: string,
  status: BlogPhaseResult["status"],
  counts: Record<string, number> = {},
  notes: string[] = [],
): BlogPhaseResult {
  return { phase, status, counts, notes };
}

async function destinationAlreadyComplete(destDb: Db): Promise<boolean> {
  const posts = await destDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .countDocuments({});
  const subscribers = await destDb
    .collection(MONGO_COLLECTIONS.blogSubscribers)
    .countDocuments({});
  const deliveries = await destDb
    .collection(MONGO_COLLECTIONS.blogPublicationDeliveries)
    .countDocuments({});
  return (
    posts === EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts &&
    subscribers === EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers &&
    deliveries === EXPECTED_BLOG_COLLECTION_COUNTS.blog_publication_deliveries
  );
}

/**
 * Compensating R2 rollback is allowed only when durable status proves Mongo did
 * not commit AND destination does not already show expected canonical posts
 * (defense against commit-marker lag).
 */
export function blogFailureAllowsOwnedR2Rollback(input: {
  mongoTransactionStatus: string | null | undefined;
  destinationBlogPostCount: number;
}): boolean {
  if (input.mongoTransactionStatus === "committed") return false;
  if (
    input.destinationBlogPostCount === EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts
  ) {
    return false;
  }
  return true;
}

export async function runProductionBlogMigration(
  input: RunProductionBlogMigrationInput,
): Promise<BlogMigrationExecutionReport> {
  const mode = resolveBlogMigrationMode({
    execute: input.execute,
    confirm: input.confirm,
  });
  const migrationExecutionId = `mig_${randomUUID()}`;
  const ledger = new BlogMigrationOwnershipLedger(migrationExecutionId);
  const phases: BlogPhaseResult[] = [];
  const blockers: string[] = [];
  const notes: string[] = [
    "R2 object copy (P2a) precedes the Mongo transaction that commits rewritten production media URLs.",
    "Categories (P1) run inside that Mongo transaction after R2 for a single atomic Mongo boundary.",
    "Historical publication deliveries are ledger rows only — never enqueued for resend.",
    "External HTTPS preserve images are never R2-copied.",
  ];
  let mediaCopied = 0;
  let mediaEquivalent = 0;
  let putObjectCalls = 0;
  let deleteObjectCalls = 0;
  let mediaKeysDeleted = 0;
  let mongoInsertsRolledBack = 0;
  let postVerify: BlogPostExecuteVerificationReport | null = null;
  let overallStatus: BlogMigrationExecutionReport["overallStatus"] =
    mode === "execute" ? "FAILED" : "DRY_RUN";
  let derivedState: BlogMigrationExecutionReport["derivedState"] = {
    categoryCache: "DEFERRED",
    globalSearch: "DEFERRED",
    contentTranslations: "DEFERRED",
    trafficAnalytics: "DO_NOT_MIGRATE",
  };

  assertBlogMigrationSourceDatabase(input.handles.sourceDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  assertBlogMigrationDestinationDatabase(input.handles.destinationDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  if (input.handles.sourceDatabase === input.handles.destinationDatabase) {
    throw new ProductionBlogMigrationError(
      "Source and destination databases must differ.",
      "SAME_SOURCE_DESTINATION",
    );
  }

  if (mode === "execute") {
    assertBlogMigrationExecuteWriteGuards({
      sourceDatabase: input.handles.sourceDatabase,
      destinationDatabase: input.handles.destinationDatabase,
      execute: true,
      confirm: input.confirm,
      allowTestIsolation: input.allowTestIsolation,
    });
  } else if (input.execute) {
    blockers.push(
      "Execute requested but CONFIRM≠YES — remaining in dry-run with zero writes.",
    );
  }

  const r2Configured = input.r2Configured ?? true;
  let r2Inspector = input.r2Inspector ?? null;
  if (!r2Inspector && mode === "execute" && r2Configured) {
    try {
      r2Inspector = new DualBucketBlogR2Inspector(resolveDualBlogR2Config());
    } catch (error) {
      blockers.push(
        `Blog R2 inspector config failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // P0 — fresh preflight in this process
  const preflight = await runProductionBlogMigrationPreflight({
    sourceDb: input.handles.sourceDb,
    destinationDb: input.handles.destinationDb,
    sourceDatabase: input.handles.sourceDatabase,
    destinationDatabase: input.handles.destinationDatabase,
    allowTestIsolation: input.allowTestIsolation,
    r2Configured,
    r2Inspector,
    mutationCounters: {
      mongoWrites: 0,
      putObjectCalls: 0,
      deleteObjectCalls: 0,
      emailSends: input.mutationCounters?.emailSends ?? 0,
      outboxWrites: input.mutationCounters?.outboxWrites ?? 0,
    },
  });
  phases.push(
    buildPhase("P0_preflight", "completed", {
      blockers: preflight.blockers.length,
    }),
  );

  if (mode === "execute") {
    if (preflight.overallVerdict !== "PASS") {
      throw new ProductionBlogMigrationError(
        `Refusing Blog execute: fresh preflight ${preflight.overallVerdict}`,
        "PREFLIGHT_NOT_PASS",
      );
    }
    if (preflight.media.r2ObjectVerification !== "PASS") {
      throw new ProductionBlogMigrationError(
        `Refusing Blog execute: R2 verification ${preflight.media.r2ObjectVerification}`,
        "R2_PREFLIGHT_NOT_PASS",
      );
    }
    if (!preflight.media.mediaCopyReady) {
      throw new ProductionBlogMigrationError(
        "Refusing Blog execute: mediaCopyReady=false",
        "MEDIA_COPY_NOT_READY",
      );
    }
  }

  const storageKeys = [...preflight.media.uniqueStorageKeys].sort();
  const mediaExecutor: BlogMediaCopyExecutor =
    input.mediaExecutor ??
    (mode === "execute"
      ? new DualBucketBlogR2CopyExecutor(resolveDualBlogR2CopyConfig())
      : new DeferredBlogMediaCopyExecutor());

  const durableMediaStore: BlogDurableMediaRecoveryStore =
    input.durableMediaRecoveryStore ??
    (mode === "execute"
      ? new MongoBlogDurableMediaRecoveryStore(input.handles.destinationDb)
      : new InMemoryBlogDurableMediaRecoveryStore());
  const runStore: BlogRunRecoveryStore =
    input.runRecoveryStore ??
    (mode === "execute"
      ? new MongoBlogRunRecoveryStore(input.handles.destinationDb)
      : new InMemoryBlogRunRecoveryStore());

  await runStore.createPlanned({
    migrationId: migrationExecutionId,
    expectedStorageKeys: storageKeys,
  });

  if (mode === "execute" && (await destinationAlreadyComplete(input.handles.destinationDb))) {
    await runStore.update({
      migrationId: migrationExecutionId,
      patch: {
        status: "already_complete",
        phaseReached: "P0_preflight",
        verificationStatus: "required",
      },
    });
    overallStatus = "ALREADY_COMPLETE";
    phases.push(buildPhase("idempotency", "skipped", {}, ["Destination already complete"]));
    const report = finalizeReport();
    return report;
  }

  // Dry-run planning
  if (mode === "dry-run") {
    phases.push(
      buildPhase("P2a_r2_objects", "planned", { expected: storageKeys.length }),
      buildPhase("P1_categories", "planned", { insert: 1, preserve: 3 }),
      buildPhase("P2b_media_records", "planned", { expected: storageKeys.length }),
      buildPhase("P3_capability_grants", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_capability_grants,
      }),
      buildPhase("P4_author_applications", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_author_applications,
      }),
      buildPhase("P5_posts", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts,
      }),
      buildPhase("P6_reactions", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_reactions,
      }),
      buildPhase("P7_subscribers", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers,
      }),
      buildPhase("P8_publication_deliveries", "planned", {
        expected: EXPECTED_BLOG_COLLECTION_COUNTS.blog_publication_deliveries,
      }),
      buildPhase("P9_zero_count_assertions", "planned"),
      buildPhase("P10_derived_state", "deferred"),
      buildPhase("P11_verification", "deferred"),
    );
    putObjectCalls = mediaExecutor.getWriteCount();
    deleteObjectCalls = mediaExecutor.getDeleteCount();
    overallStatus = "DRY_RUN";
    return finalizeReport();
  }

  // --- EXECUTE PATH ---
  try {
    await runStore.update({
      migrationId: migrationExecutionId,
      patch: { status: "r2_copying", phaseReached: "P2a_r2_objects" },
    });

    const preCopyAbsentKeys: string[] = [];
    const createdStorageKeys: string[] = [];
    const equivalentSkippedKeys: string[] = [];

    for (const storageKey of storageKeys) {
      const prepared = await mediaExecutor.prepareSourceObject(storageKey);
      const destinationUrl = destinationUrlForBlogStorageKey(storageKey);
      const destBefore = await mediaExecutor.inspectDestinationObject(
        storageKey,
        migrationExecutionId,
      );
      const preCopyState = destBefore ? "EQUIVALENT" : "ABSENT";
      if (!destBefore) preCopyAbsentKeys.push(storageKey);

      await durableMediaStore.upsertPlanned({
        migrationExecutionId,
        storageKey,
        destinationUrl,
        expectedContentSha256: prepared.checksumSHA256,
        expectedContentLength: prepared.contentLength,
        expectedContentType: prepared.contentType,
        preCopyDestinationState: destBefore ? "UNKNOWN" : "ABSENT",
      });

      if (!destBefore) {
        await durableMediaStore.markDestinationAbsentProven(
          migrationExecutionId,
          storageKey,
        );
      }

      await durableMediaStore.markCreateAttempted(migrationExecutionId, storageKey);

      let outcome;
      try {
        outcome = await mediaExecutor.copyPublicObject({
          storageKey,
          destinationUrl,
          preparedSource: prepared,
          migrationExecutionId,
        });
      } catch (error) {
        if (
          error instanceof ProductionBlogMigrationError &&
          error.code === "MEDIA_DESTINATION_RACE"
        ) {
          await durableMediaStore.markCreateRejectedRace(
            migrationExecutionId,
            storageKey,
          );
        }
        throw error;
      }

      if (outcome.status === "created") {
        if (preCopyState !== "ABSENT") {
          throw new ProductionBlogMigrationError(
            `Ownership invariant broken for ${storageKey}`,
            "MEDIA_OWNERSHIP_INVARIANT",
          );
        }
        // PUT succeeded — ownership exists on R2. Persist created_owned before verify/ledger.
        await durableMediaStore.markCreatedOwned(migrationExecutionId, storageKey);

        if (input.crashAfterPutBeforeLedger) {
          throw new ProductionBlogMigrationError(
            "Simulated crash after successful create-only PUT before ledger ownership finalize",
            "CRASH_AFTER_PUT_BEFORE_LEDGER",
          );
        }

        mediaCopied += 1;
        createdStorageKeys.push(storageKey);
        ledger.recordMediaObject({
          storageKey,
          destinationUrl,
          copied: true,
          createdByThisExecution: true,
          contentSha256: outcome.integrity.checksumSHA256,
          migrationExecutionId,
        });
        await durableMediaStore.markCreatedVerified(migrationExecutionId, storageKey);
      } else {
        mediaEquivalent += 1;
        equivalentSkippedKeys.push(storageKey);
        ledger.recordMediaObject({
          storageKey,
          destinationUrl,
          copied: false,
          createdByThisExecution: false,
          contentSha256: outcome.integrity.checksumSHA256,
          migrationExecutionId,
        });
        await durableMediaStore.markPreexistingEquivalent(
          migrationExecutionId,
          storageKey,
        );
      }
    }

    putObjectCalls = mediaExecutor.getWriteCount();
    phases.push(
      buildPhase("P2a_r2_objects", "completed", {
        copied: mediaCopied,
        equivalent: mediaEquivalent,
      }),
    );

    await runStore.update({
      migrationId: migrationExecutionId,
      patch: {
        status: "r2_complete",
        phaseReached: "P2a_r2_objects",
        preCopyAbsentKeys,
        createdStorageKeys,
        equivalentSkippedKeys,
      },
    });

    if (input.crashAfterR2Copy) {
      throw new ProductionBlogMigrationError(
        "Simulated crash after R2 copy before Mongo commit",
        "CRASH_AFTER_R2",
      );
    }

    await runStore.update({
      migrationId: migrationExecutionId,
      patch: {
        status: "mongo_committing",
        mongoTransactionStatus: "in_progress",
        phaseReached: "P1_categories",
      },
    });

    const sourceDb = input.handles.sourceDb;
    const destDb = input.handles.destinationDb;

    await withRequiredBlogTransaction({
      client: input.handles.destinationClient,
      destinationDatabase: input.handles.destinationDatabase,
      allowTestIsolation: input.allowTestIsolation,
      forceNonTransactional: input.forceNonTransactional,
      work: async (session) => {
        // P1 — insert human_potential only
        const human = await sourceDb
          .collection(MONGO_COLLECTIONS.blogCategories)
          .findOne({ categoryId: EXPECTED_INSERT_CATEGORY_ID });
        if (!human) {
          throw new ProductionBlogMigrationError(
            "Source missing human_potential category",
            "CATEGORY_SOURCE_MISSING",
          );
        }
        const humanDoc = prepareIdentityDocument(
          { ...human },
          "categoryId",
        );
        await insertOwned({
          db: destDb,
          collection: MONGO_COLLECTIONS.blogCategories,
          doc: humanDoc,
          primaryFilter: { categoryId: EXPECTED_INSERT_CATEGORY_ID },
          phase: "P1_categories",
          ledger,
          session,
          mode,
        });
        phases.push(
          buildPhase("P1_categories", "completed", {
            inserted: 1,
            preservedSeeds: EXPECTED_SEED_CATEGORY_IDS.length,
          }),
        );

        // P2b — media_upload_records for canonical keys only
        const mediaIds = preflight.media.uniqueMediaIds;
        const mediaIdToStorageKey = new Map<string, string>();
        let mediaRecordCount = 0;
        for (const mediaId of mediaIds) {
          const record = await sourceDb
            .collection(MONGO_COLLECTIONS.mediaUploadRecords)
            .findOne({ mediaId });
          if (!record) {
            throw new ProductionBlogMigrationError(
              `Missing source media_upload_records for mediaId=${mediaId}`,
              "MEDIA_RECORD_MISSING",
            );
          }
          const storageKey = asString(record.storageKey);
          if (!storageKey || !storageKeys.includes(storageKey)) continue;
          mediaIdToStorageKey.set(mediaId, storageKey);
          const sanitized = sanitizeMediaUploadRecordForBlogMigration(
            record,
            PRODUCTION_MEDIA_PUBLIC_BASE_URL,
            mediaIdToStorageKey,
          );
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.mediaUploadRecords,
            doc: sanitized,
            primaryFilter: { mediaId },
            phase: "P2b_media_records",
            ledger,
            session,
            mode,
          });
          mediaRecordCount += 1;
        }
        phases.push(
          buildPhase("P2b_media_records", "completed", { inserted: mediaRecordCount }),
        );

        // P3 grants
        const grants = await sourceDb
          .collection(MONGO_COLLECTIONS.blogCapabilityGrants)
          .find({})
          .toArray();
        for (const grant of grants) {
          const participantId = asString(grant.participantId);
          if (!participantId) continue;
          const doc = { ...grant, _id: participantId, participantId };
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogCapabilityGrants,
            doc,
            primaryFilter: { participantId },
            phase: "P3_capability_grants",
            ledger,
            session,
            mode,
          });
        }
        phases.push(
          buildPhase("P3_capability_grants", "completed", { inserted: grants.length }),
        );

        // P4 applications
        const apps = await sourceDb
          .collection(MONGO_COLLECTIONS.blogAuthorApplications)
          .find({})
          .toArray();
        for (const app of apps) {
          const prepared = prepareIdentityDocument(app, "applicationId");
          const applicationId = asString(prepared.applicationId);
          if (!applicationId) continue;
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogAuthorApplications,
            doc: prepared,
            primaryFilter: { applicationId },
            phase: "P4_author_applications",
            ledger,
            session,
            mode,
          });
        }
        phases.push(
          buildPhase("P4_author_applications", "completed", { inserted: apps.length }),
        );

        // P5 posts
        const posts = await sourceDb
          .collection(MONGO_COLLECTIONS.blogPosts)
          .find({})
          .toArray();
        for (const post of posts) {
          const sanitized = sanitizeBlogPostForMigration(
            post,
            PRODUCTION_MEDIA_PUBLIC_BASE_URL,
            mediaIdToStorageKey,
          );
          const postId = asString(sanitized.postId);
          if (!postId) continue;
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogPosts,
            doc: sanitized,
            primaryFilter: { postId },
            phase: "P5_posts",
            ledger,
            session,
            mode,
          });
        }
        phases.push(buildPhase("P5_posts", "completed", { inserted: posts.length }));

        // P6 reactions
        const reactions = await sourceDb
          .collection(MONGO_COLLECTIONS.blogReactions)
          .find({})
          .toArray();
        for (const reaction of reactions) {
          const prepared = prepareIdentityDocument(reaction, "reactionId");
          const reactionId = asString(prepared.reactionId);
          if (!reactionId) continue;
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogReactions,
            doc: prepared,
            primaryFilter: { reactionId },
            phase: "P6_reactions",
            ledger,
            session,
            mode,
          });
        }
        phases.push(
          buildPhase("P6_reactions", "completed", { inserted: reactions.length }),
        );

        // P7 subscribers — preserve token state; never email
        const subscribers = await sourceDb
          .collection(MONGO_COLLECTIONS.blogSubscribers)
          .find({})
          .toArray();
        for (const subscriber of subscribers) {
          const prepared = prepareBlogSubscriberForMigration(subscriber);
          const subscriberId = asString(prepared.subscriberId);
          if (!subscriberId) continue;
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogSubscribers,
            doc: prepared,
            primaryFilter: { subscriberId },
            phase: "P7_subscribers",
            ledger,
            session,
            mode,
          });
        }
        phases.push(
          buildPhase("P7_subscribers", "completed", {
            inserted: subscribers.length,
            emailsTriggered: 0,
          }),
        );

        // P8 historical deliveries
        const deliveries = await sourceDb
          .collection(MONGO_COLLECTIONS.blogPublicationDeliveries)
          .find({})
          .toArray();
        for (const delivery of deliveries) {
          const prepared = prepareBlogDeliveryForMigration(delivery);
          const deliveryId = asString(prepared.deliveryId);
          if (!deliveryId) continue;
          await insertOwned({
            db: destDb,
            collection: MONGO_COLLECTIONS.blogPublicationDeliveries,
            doc: prepared,
            primaryFilter: { deliveryId },
            phase: "P8_publication_deliveries",
            ledger,
            session,
            mode,
          });
        }
        phases.push(
          buildPhase("P8_publication_deliveries", "completed", {
            inserted: deliveries.length,
            resends: 0,
          }),
        );

        // Commit marker MUST be written inside the same Mongo transaction as
        // canonical Blog inserts. Otherwise a crash between commit and durable
        // status update could allow R2 compensating deletes after live URLs exist.
        await runStore.update({
          migrationId: migrationExecutionId,
          session,
          patch: {
            status: "mongo_committed",
            mongoTransactionStatus: "committed",
            phaseReached: "P8_publication_deliveries",
          },
        });
      },
    });

    if (input.crashAfterMongoCommit) {
      await runStore.update({
        migrationId: migrationExecutionId,
        patch: {
          status: "recovery_required",
          verificationStatus: "required",
        },
      });
      throw new ProductionBlogMigrationError(
        "Simulated failure after Mongo commit — recovery required",
        "CRASH_AFTER_MONGO_COMMIT",
      );
    }

    // P9 zero-count assertions
    for (const name of [
      MONGO_COLLECTIONS.blogSubscriptionSettings,
      MONGO_COLLECTIONS.blogAdminSubscriberMessages,
      MONGO_COLLECTIONS.blogAdminSubscriberMessageDeliveries,
      MONGO_COLLECTIONS.blogComments,
    ] as const) {
      const count = await destDb.collection(name).countDocuments({});
      if (count !== 0) {
        blockers.push(`Zero-count collection ${name} has ${count} docs`);
      }
    }
    phases.push(
      buildPhase("P9_zero_count_assertions", blockers.length ? "failed" : "completed"),
    );

    // P10 derived state — invalidate only; no new canonical stores
    try {
      invalidateBlogCategoryCache();
      derivedState = {
        ...derivedState,
        categoryCache: "INVALIDATED",
      };
    } catch {
      notes.push("Category cache invalidate unavailable in this process; mark deferred.");
    }
    try {
      invalidateGlobalSearchIndex();
      derivedState = {
        ...derivedState,
        globalSearch: "INVALIDATED",
      };
    } catch {
      notes.push("Global search invalidate unavailable in this process; mark deferred.");
    }
    phases.push(
      buildPhase("P10_derived_state", "completed", {}, [
        "content_translations DEFERRED",
        "traffic analytics DO_NOT_MIGRATE",
      ]),
    );

    // P11 verification
    postVerify = await runPostExecuteBlogMigrationVerification({
      sourceDb: input.handles.sourceDb,
      destinationDb: input.handles.destinationDb,
      mediaExecutor,
      expectedStorageKeys: storageKeys,
      migrationExecutionId,
    });
    phases.push(
      buildPhase(
        "P11_verification",
        postVerify.overallVerdict === "PASS" ? "completed" : "failed",
        { blockers: postVerify.blockers.length },
      ),
    );

    if (postVerify.overallVerdict !== "PASS" || blockers.length > 0) {
      await runStore.update({
        migrationId: migrationExecutionId,
        patch: {
          status: "recovery_required",
          verificationStatus: "fail",
          blockers: [...blockers, ...postVerify.blockers],
        },
      });
      overallStatus = "RECOVERY_REQUIRED";
    } else {
      await runStore.update({
        migrationId: migrationExecutionId,
        patch: {
          status: "verified",
          verificationStatus: "pass",
          phaseReached: "P11_verification",
        },
      });
      overallStatus = "SUCCESS";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(message);
    const run = await runStore.get(migrationExecutionId);
    const mongoCommitted = run?.mongoTransactionStatus === "committed";

    if (!mongoCommitted) {
      const destPostCount = await input.handles.destinationDb
        .collection(MONGO_COLLECTIONS.blogPosts)
        .countDocuments({});
      const allowR2Rollback = blogFailureAllowsOwnedR2Rollback({
        mongoTransactionStatus: run?.mongoTransactionStatus,
        destinationBlogPostCount: destPostCount,
      });

      if (!allowR2Rollback) {
        blockers.push(
          "Refusing R2 compensating rollback: destination blog_posts already at expected count while run status is not committed — recovery_required",
        );
        await runStore.update({
          migrationId: migrationExecutionId,
          patch: {
            status: "recovery_required",
            verificationStatus: "required",
            blockers,
          },
        });
        overallStatus = "RECOVERY_REQUIRED";
      } else {
      // Before Mongo commit: reconcile create_attempted/created_owned orphans, then
      // abort txn (already rolled back) + cleanup only proven-owned R2.
      try {
        const reconciled = await reconcileBlogMediaCreateAttempted({
          migrationId: migrationExecutionId,
          durableMediaStore,
          mediaExecutor,
          ledger,
        });
        mediaCopied = Math.max(mediaCopied, reconciled.ownedKeys.length);
      } catch (reconcileError) {
        blockers.push(
          `R2 ownership reconcile issue: ${
            reconcileError instanceof Error
              ? reconcileError.message
              : String(reconcileError)
          }`,
        );
      }
      try {
        mongoInsertsRolledBack = await rollbackOwnedMongoInserts({
          db: input.handles.destinationDb,
          ledger,
        });
      } catch (rollbackError) {
        blockers.push(
          `Mongo compensating rollback issue: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
        );
      }
      try {
        mediaKeysDeleted = await rollbackOwnedBlogMediaObjects({
          executor: mediaExecutor,
          ledger,
          durableStore: durableMediaStore,
        });
      } catch (rollbackError) {
        blockers.push(
          `R2 compensating rollback issue: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
        );
      }
      deleteObjectCalls = mediaExecutor.getDeleteCount();
      putObjectCalls = mediaExecutor.getWriteCount();
      await runStore.update({
        migrationId: migrationExecutionId,
        patch: {
          status: "failed_before_mongo_commit",
          mongoTransactionStatus: "aborted",
          blockers,
        },
      });
      overallStatus = "FAILED";
      }
    } else {
      // After Mongo commit: do not blind-rollback business state
      await runStore.update({
        migrationId: migrationExecutionId,
        patch: {
          status: "recovery_required",
          verificationStatus: "required",
          blockers,
        },
      });
      overallStatus = "RECOVERY_REQUIRED";
    }
  }

  return finalizeReport();

  function finalizeReport(): BlogMigrationExecutionReport {
    const emailSends = input.mutationCounters?.emailSends ?? 0;
    const outboxWrites = input.mutationCounters?.outboxWrites ?? 0;
    if (emailSends || outboxWrites) {
      blockers.push("Refusing SUCCESS: email/outbox mutation detected");
      if (overallStatus === "SUCCESS") overallStatus = "FAILED";
    }
    const report: BlogMigrationExecutionReport = {
      tool: "execute-production-blog-migration",
      mode,
      migrationExecutionId,
      sourceDatabase: input.handles.sourceDatabase,
      destinationDatabase: input.handles.destinationDatabase,
      overallStatus,
      phases,
      preflight: {
        overallVerdict: preflight.overallVerdict,
        r2ObjectVerification: preflight.media.r2ObjectVerification,
        mediaCopyReady: preflight.media.mediaCopyReady,
        externalHttpsPreserveCount: preflight.media.externalHttpsPreserveCount,
        uniqueStorageKeyCount: preflight.media.uniqueStorageKeys.length,
      },
      ownership: ledger.toSafeReport(),
      media: {
        plannedCopies: storageKeys.length,
        copied: mediaCopied,
        alreadyEquivalent: mediaEquivalent,
        storageKeys,
      },
      derivedState,
      postExecuteVerification: postVerify,
      mutationProof: {
        emailSends,
        outboxWrites,
        putObjectCalls,
        deleteObjectCalls,
      },
      rollback: {
        strategy:
          overallStatus === "RECOVERY_REQUIRED"
            ? "no-blind-mongo-rollback; verification-required"
            : "compensating-owned-r2-and-insertedId-mongo",
        mediaKeysDeleted,
        mongoInsertsRolledBack,
      },
      blockers: [...new Set(blockers)],
      crashSafeOrder: CRASH_SAFE_BLOG_EXECUTION_ORDER,
      notes,
    };
    const safe = stripForbiddenReportFields(report);
    assertNoSecretLeak(JSON.stringify(safe));
    return safe;
  }
}

export function buildSafeBlogMigrationExecutionLog(
  report: BlogMigrationExecutionReport,
): BlogMigrationExecutionReport {
  return stripForbiddenReportFields(report);
}

/** Test helper re-export surface for InMemory R2 inspector seeding with copy executor. */
export { InMemoryBlogR2Inspector };
