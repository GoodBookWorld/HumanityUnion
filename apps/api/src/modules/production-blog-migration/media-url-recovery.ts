/**
 * Post-commit Blog media URL recovery — Mongo URL strings only.
 * Never copies/deletes R2, never emails, never writes outbox/subscribers/deliveries.
 */

import type { ClientSession, Db, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT,
  PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG,
  PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  SUPPORTED_BLOG_MEDIA_URL_RECOVERY_MIGRATION_ID,
} from "./constants.js";
import {
  productionMediaUrlForStorageKey,
  tryResolveOwnedStorageKey,
} from "./documents.js";
import { ProductionBlogMigrationError } from "./errors.js";
import {
  assertBlogMigrationDestinationDatabase,
  assertBlogMigrationSourceDatabase,
  isBlogExecuteModeRequested,
} from "./guards.js";
import {
  InMemoryBlogDurableMediaRecoveryStore,
  MongoBlogDurableMediaRecoveryStore,
  type BlogDurableMediaRecoveryRecord,
  type BlogDurableMediaRecoveryStore,
} from "./media-recovery-store.js";
import { classifyMediaUrlHost } from "./media-inventory.js";
import {
  runPostExecuteBlogMigrationVerification,
  type BlogPostExecuteVerificationReport,
} from "./post-execute-verify.js";
import {
  DeferredBlogMediaCopyExecutor,
  type BlogMediaCopyExecutor,
} from "./r2-copy.js";
import { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";
import {
  InMemoryBlogRunRecoveryStore,
  MongoBlogRunRecoveryStore,
  type BlogRunRecoveryRecord,
  type BlogRunRecoveryStore,
} from "./run-recovery-store.js";

const OWNED_MEDIA_STATUSES = new Set([
  "created_owned",
  "created_verified",
  "preexisting_equivalent",
]);

export type BlogMediaUrlRepairAction = "repair" | "no-op" | "preserve";

export interface BlogMediaUrlRepairPlanItem {
  collection: "media_upload_records" | "blog_posts";
  documentId: string;
  field: string;
  storageKey: string | null;
  from: string | null;
  to: string | null;
  action: BlogMediaUrlRepairAction;
}

export interface BlogMediaUrlRecoveryReport {
  tool: "recover-production-blog-media-urls";
  mode: "dry-run" | "execute";
  migrationExecutionId: string;
  sourceDatabase: string;
  destinationDatabase: string;
  overallStatus:
    | "DRY_RUN_OK"
    | "REPAIRED"
    | "NO_OP"
    | "BLOCKED"
    | "FAILED"
    | "VERIFIER_FAIL";
  gates: {
    migrationExecutionIdProvided: boolean;
    supportedOrProvenCommittedRun: boolean;
    mongoTransactionCommitted: boolean;
    destinationIsProduction: boolean;
    sourceDiffersDestination: boolean;
    executeFlag: boolean;
    confirmOk: boolean;
  };
  ownership: {
    expectedCount: number;
    storageKeyCount: number;
    mediaIdCount: number;
    storageKeys: string[];
    mediaIds: string[];
  };
  plannedRepairs: BlogMediaUrlRepairPlanItem[];
  repairCounts: {
    planned: number;
    noOp: number;
    preserved: number;
  };
  mutationProof: {
    r2Put: number;
    r2Delete: number;
    emailSends: number;
    outboxWrites: number;
    subscriberChanges: number;
    deliveryChanges: number;
    mongoUrlUpdates: number;
  };
  postExecuteVerification: BlogPostExecuteVerificationReport | null;
  recoveryMarked: boolean;
  blockers: string[];
  notes: string[];
}

export interface RunBlogMediaUrlRecoveryInput {
  handles: {
    sourceClient: MongoClient;
    sourceDb: Db;
    sourceDatabase: string;
    destinationClient: MongoClient;
    destinationDb: Db;
    destinationDatabase: string;
  };
  migrationExecutionId: string;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
  forceNonTransactional?: boolean;
  durableMediaRecoveryStore?: BlogDurableMediaRecoveryStore;
  runRecoveryStore?: BlogRunRecoveryStore;
  mediaExecutor?: BlogMediaCopyExecutor;
  /** Test hook: throw after N successful document updates inside the txn. */
  simulateFailureAfterUpdates?: number;
  mutationCounters?: {
    emailSends?: number;
    outboxWrites?: number;
    subscriberChanges?: number;
    deliveryChanges?: number;
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRepairableHost(url: string): boolean {
  const host = classifyMediaUrlHost(url);
  if (host === "production_public" || host === "staging_public" || host === "relative_api") {
    return true;
  }
  return /^https?:\/\/[^/]*\.r2\.dev\//i.test(url.trim());
}

/**
 * Assess a URL that must become https://media.huws.org/{expectedKey}.
 * Fail closed on unknown/mismatched values.
 */
export function assessOwnedMediaUrlRepair(
  url: string | null | undefined,
  expectedKey: string,
  publicBaseUrl: string = PRODUCTION_MEDIA_PUBLIC_BASE_URL,
): { action: "repair" | "no-op"; from: string | null; to: string; blocker?: string } {
  const target = productionMediaUrlForStorageKey(expectedKey, publicBaseUrl);
  const trimmed = url?.trim() ?? "";
  if (!trimmed) {
    return {
      action: "repair",
      from: null,
      to: target,
    };
  }
  if (trimmed === target) {
    return { action: "no-op", from: trimmed, to: target };
  }
  const ownedKeys = new Set([expectedKey]);
  const resolved = tryResolveOwnedStorageKey(trimmed, ownedKeys);
  if (resolved === expectedKey) {
    return { action: "repair", from: trimmed, to: target };
  }
  if (isRepairableHost(trimmed)) {
    const loose = tryResolveOwnedStorageKey(trimmed, new Set([expectedKey]));
    if (loose === expectedKey) {
      return { action: "repair", from: trimmed, to: target };
    }
    return {
      action: "repair",
      from: trimmed,
      to: target,
      blocker: `URL does not resolve to owned storageKey=${expectedKey}`,
    };
  }
  const host = classifyMediaUrlHost(trimmed);
  if (
    host === "external_https_preserve" &&
    !/^https?:\/\/[^/]*\.r2\.dev\//i.test(trimmed)
  ) {
    return {
      action: "repair",
      from: trimmed,
      to: target,
      blocker: `Unexpected external URL on owned media field (storageKey=${expectedKey})`,
    };
  }
  return {
    action: "repair",
    from: trimmed,
    to: target,
    blocker: `Unknown or mismatched URL for storageKey=${expectedKey}`,
  };
}

function rewriteOwnedHtmlImgSrc(
  html: string,
  ownedStorageKeys: ReadonlySet<string>,
  publicBaseUrl: string,
): { next: string; repairs: Array<{ from: string; to: string; storageKey: string }>; blockers: string[] } {
  const repairs: Array<{ from: string; to: string; storageKey: string }> = [];
  const blockers: string[] = [];
  const next = html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_full, prefix: string, quote: string, src: string) => {
      const trimmed = src.trim();
      const owned = tryResolveOwnedStorageKey(trimmed, ownedStorageKeys);
      if (owned) {
        const to = productionMediaUrlForStorageKey(owned, publicBaseUrl);
        if (trimmed !== to) {
          repairs.push({ from: trimmed, to, storageKey: owned });
        }
        return `${prefix}${quote}${to}${quote}`;
      }
      // Staging/r2/relative that looks repairable but is not in owned set → fail closed
      // only when path extracts a key-shaped value under blog/ (migration media prefix).
      if (isRepairableHost(trimmed) || classifyMediaUrlHost(trimmed) === "relative_api") {
        try {
          const path = trimmed.startsWith("/")
            ? trimmed.replace(/^\/api\/v1\/media\/files\//i, "").replace(/^\/+/, "")
            : new URL(trimmed).pathname.replace(/^\/+/, "");
          if (path && !ownedStorageKeys.has(path) && /^blog\//i.test(path)) {
            blockers.push(`HTML img src path not in owned migration set: ${path}`);
          }
        } catch {
          blockers.push("HTML img src unparseable repairable URL");
        }
      }
      return `${prefix}${quote}${src}${quote}`;
    },
  );
  return { next, repairs, blockers };
}

async function withRequiredRecoveryTransaction(input: {
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
        "Mongo transactions required for Blog media URL recovery; topology does not support them.",
        "TRANSACTION_REQUIRED",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

function proveCommittedBlogMigrationRun(run: BlogRunRecoveryRecord | null): boolean {
  if (!run) return false;
  if (run.mongoTransactionStatus !== "committed") return false;
  if (run.expectedStorageKeys.length !== EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT) {
    return false;
  }
  return (
    run.status === "mongo_committed" ||
    run.status === "recovery_required" ||
    run.status === "verified"
  );
}

function assertRecoveryIdentityGate(input: {
  migrationExecutionId: string;
  run: BlogRunRecoveryRecord | null;
  sourceDatabase: string;
  destinationDatabase: string;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
}): {
  gates: BlogMediaUrlRecoveryReport["gates"];
  mode: "dry-run" | "execute";
  blockers: string[];
} {
  const blockers: string[] = [];
  const migrationExecutionIdProvided = Boolean(
    input.migrationExecutionId?.startsWith("mig_"),
  );
  if (!migrationExecutionIdProvided) {
    blockers.push("migrationExecutionId is required (mig_…)");
  }

  const isSupportedExact =
    input.migrationExecutionId === SUPPORTED_BLOG_MEDIA_URL_RECOVERY_MIGRATION_ID;
  const proven = proveCommittedBlogMigrationRun(input.run);
  const supportedOrProvenCommittedRun = isSupportedExact || proven;
  if (migrationExecutionIdProvided && !supportedOrProvenCommittedRun) {
    blockers.push(
      "Migration run is not the supported recovery id and is not a proven committed Blog migration run",
    );
  }
  if (isSupportedExact && input.run && !proven) {
    // Exact id still requires durable committed proof when a run record exists.
    if (input.run.mongoTransactionStatus !== "committed") {
      blockers.push("Durable run state must prove mongoTransactionStatus=committed");
    }
  }
  if (isSupportedExact && !input.run) {
    blockers.push("Durable run recovery record missing for supported migration id");
  }

  const mongoTransactionCommitted = input.run?.mongoTransactionStatus === "committed";
  if (input.run && !mongoTransactionCommitted) {
    blockers.push("Durable run mongoTransactionStatus is not committed");
  }
  if (!input.run) {
    blockers.push("Missing durable Blog migration run recovery record");
  }

  let destinationIsProduction = false;
  try {
    assertBlogMigrationDestinationDatabase(input.destinationDatabase, {
      allowTestIsolation: input.allowTestIsolation,
    });
    destinationIsProduction =
      input.destinationDatabase === PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE ||
      Boolean(input.allowTestIsolation);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertBlogMigrationSourceDatabase(input.sourceDatabase, {
      allowTestIsolation: input.allowTestIsolation,
    });
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  const sourceDiffersDestination = input.sourceDatabase !== input.destinationDatabase;
  if (!sourceDiffersDestination) {
    blockers.push("Source and destination databases must differ");
  }

  const executeFlag = input.execute === true;
  const confirmOk = input.confirm === PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE;
  const mode: "dry-run" | "execute" =
    executeFlag && confirmOk ? "execute" : "dry-run";

  if (executeFlag && !confirmOk) {
    blockers.push(
      `Refusing write: set ${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG}=${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE}`,
    );
  }

  return {
    gates: {
      migrationExecutionIdProvided,
      supportedOrProvenCommittedRun,
      mongoTransactionCommitted: Boolean(mongoTransactionCommitted),
      destinationIsProduction,
      sourceDiffersDestination,
      executeFlag,
      confirmOk,
    },
    mode,
    blockers,
  };
}

export async function resolveMigrationOwnedMediaSet(input: {
  migrationExecutionId: string;
  run: BlogRunRecoveryRecord;
  mediaRecords: BlogDurableMediaRecoveryRecord[];
  destinationDb: Db;
}): Promise<{
  storageKeys: string[];
  mediaIds: string[];
  mediaIdToStorageKey: Map<string, string>;
  blockers: string[];
}> {
  const blockers: string[] = [];
  const ownedMedia = input.mediaRecords.filter((r) => OWNED_MEDIA_STATUSES.has(r.status));
  if (ownedMedia.length !== EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT) {
    blockers.push(
      `Expected ${EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT} owned media recovery records, got ${ownedMedia.length}`,
    );
  }

  const fromMedia = [...new Set(ownedMedia.map((r) => r.storageKey))].sort();
  const fromRun = [...new Set(input.run.expectedStorageKeys)].sort();
  if (fromMedia.join("|") !== fromRun.join("|")) {
    blockers.push("Run expectedStorageKeys do not match durable media recovery ownership set");
  }
  if (fromRun.length !== EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT) {
    blockers.push(
      `Run expectedStorageKeys length must be ${EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT}`,
    );
  }

  const mediaIdToStorageKey = new Map<string, string>();
  const mediaIds: string[] = [];
  for (const storageKey of fromRun) {
    const record = await input.destinationDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .findOne({ storageKey });
    if (!record) {
      blockers.push(`Missing destination media_upload_records for storageKey=${storageKey}`);
      continue;
    }
    const mediaId = asString(record.mediaId) ?? asString(record._id);
    if (!mediaId) {
      blockers.push(`media_upload_records missing mediaId for storageKey=${storageKey}`);
      continue;
    }
    if (mediaIdToStorageKey.has(mediaId) && mediaIdToStorageKey.get(mediaId) !== storageKey) {
      blockers.push(`Duplicate mediaId mapping conflict for mediaId=${mediaId}`);
      continue;
    }
    mediaIdToStorageKey.set(mediaId, storageKey);
    mediaIds.push(mediaId);
  }

  if (
    blockers.length === 0 &&
    mediaIds.length !== EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT
  ) {
    blockers.push(
      `Expected ${EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT} mediaIds, got ${mediaIds.length}`,
    );
  }

  return {
    storageKeys: fromRun,
    mediaIds: [...mediaIds].sort(),
    mediaIdToStorageKey,
    blockers,
  };
}

export async function planBlogMediaUrlRepairs(input: {
  destinationDb: Db;
  mediaIdToStorageKey: ReadonlyMap<string, string>;
  storageKeys: readonly string[];
  publicBaseUrl?: string;
}): Promise<{ plannedRepairs: BlogMediaUrlRepairPlanItem[]; blockers: string[] }> {
  const publicBaseUrl = input.publicBaseUrl ?? PRODUCTION_MEDIA_PUBLIC_BASE_URL;
  const ownedKeys = new Set(input.storageKeys);
  const plannedRepairs: BlogMediaUrlRepairPlanItem[] = [];
  const blockers: string[] = [];

  for (const storageKey of input.storageKeys) {
    const record = await input.destinationDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .findOne({ storageKey });
    if (!record) {
      blockers.push(`Missing media_upload_records for ${storageKey}`);
      continue;
    }
    const mediaId = asString(record.mediaId) ?? asString(record._id) ?? storageKey;
    for (const field of ["mediaUrl", "publicUrl"] as const) {
      if (field === "publicUrl" && typeof record.publicUrl !== "string") continue;
      const current = asString(record[field]);
      const assessed = assessOwnedMediaUrlRepair(current, storageKey, publicBaseUrl);
      if (assessed.blocker) {
        blockers.push(`${mediaId}.${field}: ${assessed.blocker}`);
        continue;
      }
      plannedRepairs.push({
        collection: "media_upload_records",
        documentId: mediaId,
        field,
        storageKey,
        from: assessed.from,
        to: assessed.to,
        action: assessed.action,
      });
    }
  }

  const posts = await input.destinationDb
    .collection(MONGO_COLLECTIONS.blogPosts)
    .find({})
    .toArray();

  for (const post of posts) {
    const postId = asString(post.postId) ?? asString(post._id);
    if (!postId) continue;

    const cover =
      post.coverMedia && typeof post.coverMedia === "object"
        ? (post.coverMedia as Record<string, unknown>)
        : null;
    const coverMediaId = cover ? asString(cover.mediaId) : null;
    if (coverMediaId && input.mediaIdToStorageKey.has(coverMediaId)) {
      const storageKey = input.mediaIdToStorageKey.get(coverMediaId)!;
      const assessed = assessOwnedMediaUrlRepair(
        asString(cover!.mediaUrl),
        storageKey,
        publicBaseUrl,
      );
      if (assessed.blocker) {
        blockers.push(`post ${postId} coverMedia.mediaUrl: ${assessed.blocker}`);
      } else {
        plannedRepairs.push({
          collection: "blog_posts",
          documentId: postId,
          field: "coverMedia.mediaUrl",
          storageKey,
          from: assessed.from,
          to: assessed.to,
          action: assessed.action,
        });
      }
    }

    const opt =
      post.optimization && typeof post.optimization === "object"
        ? (post.optimization as Record<string, unknown>)
        : null;
    const social =
      opt?.socialImage && typeof opt.socialImage === "object"
        ? (opt.socialImage as Record<string, unknown>)
        : null;
    const socialMediaId = social ? asString(social.mediaId) : null;
    if (socialMediaId && input.mediaIdToStorageKey.has(socialMediaId)) {
      const storageKey = input.mediaIdToStorageKey.get(socialMediaId)!;
      const assessed = assessOwnedMediaUrlRepair(
        asString(social!.mediaUrl),
        storageKey,
        publicBaseUrl,
      );
      if (assessed.blocker) {
        blockers.push(`post ${postId} optimization.socialImage.mediaUrl: ${assessed.blocker}`);
      } else {
        plannedRepairs.push({
          collection: "blog_posts",
          documentId: postId,
          field: "optimization.socialImage.mediaUrl",
          storageKey,
          from: assessed.from,
          to: assessed.to,
          action: assessed.action,
        });
      }
    }

    if (typeof post.content === "string") {
      const { next, repairs, blockers: htmlBlockers } = rewriteOwnedHtmlImgSrc(
        post.content,
        ownedKeys,
        publicBaseUrl,
      );
      blockers.push(...htmlBlockers.map((b) => `post ${postId}: ${b}`));
      if (/i0\.wp\.com/i.test(post.content)) {
        plannedRepairs.push({
          collection: "blog_posts",
          documentId: postId,
          field: "content.external_https_preserve",
          storageKey: null,
          from: "i0.wp.com",
          to: "i0.wp.com",
          action: "preserve",
        });
      }
      if (next !== post.content) {
        plannedRepairs.push({
          collection: "blog_posts",
          documentId: postId,
          field: "content",
          storageKey: repairs[0]?.storageKey ?? null,
          from: `html_img_repairs=${repairs.length}`,
          to: `html_img_repairs=${repairs.length}`,
          action: repairs.length ? "repair" : "no-op",
        });
      }
    }
  }

  return { plannedRepairs, blockers };
}

export async function runBlogMediaUrlRecovery(
  input: RunBlogMediaUrlRecoveryInput,
): Promise<BlogMediaUrlRecoveryReport> {
  const migrationExecutionId = input.migrationExecutionId.trim();
  const durableStore: BlogDurableMediaRecoveryStore =
    input.durableMediaRecoveryStore ??
    new MongoBlogDurableMediaRecoveryStore(input.handles.destinationDb);
  const runStore: BlogRunRecoveryStore =
    input.runRecoveryStore ??
    new MongoBlogRunRecoveryStore(input.handles.destinationDb);

  const run = await runStore.get(migrationExecutionId);
  const gate = assertRecoveryIdentityGate({
    migrationExecutionId,
    run,
    sourceDatabase: input.handles.sourceDatabase,
    destinationDatabase: input.handles.destinationDatabase,
    execute: input.execute,
    confirm: input.confirm,
    allowTestIsolation: input.allowTestIsolation,
  });

  const notes: string[] = [];
  const blockers = [...gate.blockers];
  let plannedRepairs: BlogMediaUrlRepairPlanItem[] = [];
  let ownership: BlogMediaUrlRecoveryReport["ownership"] = {
    expectedCount: EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT,
    storageKeyCount: 0,
    mediaIdCount: 0,
    storageKeys: [],
    mediaIds: [],
  };
  let postVerify: BlogPostExecuteVerificationReport | null = null;
  let recoveryMarked = false;
  let mongoUrlUpdates = 0;
  const mediaExecutor =
    input.mediaExecutor ?? new DeferredBlogMediaCopyExecutor();

  const mutationProof = {
    r2Put: mediaExecutor.getWriteCount(),
    r2Delete: mediaExecutor.getDeleteCount(),
    emailSends: input.mutationCounters?.emailSends ?? 0,
    outboxWrites: input.mutationCounters?.outboxWrites ?? 0,
    subscriberChanges: input.mutationCounters?.subscriberChanges ?? 0,
    deliveryChanges: input.mutationCounters?.deliveryChanges ?? 0,
    mongoUrlUpdates: 0,
  };

  if (
    mutationProof.emailSends ||
    mutationProof.outboxWrites ||
    mutationProof.subscriberChanges ||
    mutationProof.deliveryChanges
  ) {
    blockers.push("Forbidden side-effect mutation detected during media URL recovery");
  }

  if (blockers.length === 0 && run) {
    const mediaRecords = await durableStore.listByExecutionId(migrationExecutionId);
    const owned = await resolveMigrationOwnedMediaSet({
      migrationExecutionId,
      run,
      mediaRecords,
      destinationDb: input.handles.destinationDb,
    });
    blockers.push(...owned.blockers);
    ownership = {
      expectedCount: EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT,
      storageKeyCount: owned.storageKeys.length,
      mediaIdCount: owned.mediaIds.length,
      storageKeys: owned.storageKeys,
      mediaIds: owned.mediaIds,
    };

    if (blockers.length === 0) {
      const plan = await planBlogMediaUrlRepairs({
        destinationDb: input.handles.destinationDb,
        mediaIdToStorageKey: owned.mediaIdToStorageKey,
        storageKeys: owned.storageKeys,
      });
      plannedRepairs = plan.plannedRepairs;
      blockers.push(...plan.blockers);
    }

    if (blockers.length === 0 && gate.mode === "execute") {
      const repairs = plannedRepairs.filter((p) => p.action === "repair");
      try {
        await withRequiredRecoveryTransaction({
          client: input.handles.destinationClient,
          destinationDatabase: input.handles.destinationDatabase,
          allowTestIsolation: input.allowTestIsolation,
          forceNonTransactional: input.forceNonTransactional,
          work: async (session) => {
            let updates = 0;
            for (const item of repairs) {
              if (item.collection === "media_upload_records") {
                const result = await input.handles.destinationDb
                  .collection(MONGO_COLLECTIONS.mediaUploadRecords)
                  .updateOne(
                    { mediaId: item.documentId },
                    { $set: { [item.field]: item.to } },
                    { session: session ?? undefined },
                  );
                if (result.matchedCount !== 1) {
                  throw new ProductionBlogMigrationError(
                    `Failed to update media_upload_records mediaId=${item.documentId}`,
                    "RECOVERY_UPDATE_MISMATCH",
                  );
                }
                updates += 1;
              } else if (item.field === "coverMedia.mediaUrl") {
                const result = await input.handles.destinationDb
                  .collection(MONGO_COLLECTIONS.blogPosts)
                  .updateOne(
                    { postId: item.documentId },
                    { $set: { "coverMedia.mediaUrl": item.to } },
                    { session: session ?? undefined },
                  );
                if (result.matchedCount !== 1) {
                  throw new ProductionBlogMigrationError(
                    `Failed to update coverMedia for postId=${item.documentId}`,
                    "RECOVERY_UPDATE_MISMATCH",
                  );
                }
                updates += 1;
              } else if (item.field === "optimization.socialImage.mediaUrl") {
                const result = await input.handles.destinationDb
                  .collection(MONGO_COLLECTIONS.blogPosts)
                  .updateOne(
                    { postId: item.documentId },
                    { $set: { "optimization.socialImage.mediaUrl": item.to } },
                    { session: session ?? undefined },
                  );
                if (result.matchedCount !== 1) {
                  throw new ProductionBlogMigrationError(
                    `Failed to update socialImage for postId=${item.documentId}`,
                    "RECOVERY_UPDATE_MISMATCH",
                  );
                }
                updates += 1;
              } else if (item.field === "content") {
                const post = await input.handles.destinationDb
                  .collection(MONGO_COLLECTIONS.blogPosts)
                  .findOne(
                    { postId: item.documentId },
                    { session: session ?? undefined },
                  );
                if (!post || typeof post.content !== "string") {
                  throw new ProductionBlogMigrationError(
                    `Missing post content for postId=${item.documentId}`,
                    "RECOVERY_UPDATE_MISMATCH",
                  );
                }
                const { next, blockers: htmlBlockers } = rewriteOwnedHtmlImgSrc(
                  post.content,
                  new Set(owned.storageKeys),
                  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
                );
                if (htmlBlockers.length) {
                  throw new ProductionBlogMigrationError(
                    htmlBlockers.join("; "),
                    "RECOVERY_HTML_BLOCKER",
                  );
                }
                const result = await input.handles.destinationDb
                  .collection(MONGO_COLLECTIONS.blogPosts)
                  .updateOne(
                    { postId: item.documentId },
                    { $set: { content: next } },
                    { session: session ?? undefined },
                  );
                if (result.matchedCount !== 1) {
                  throw new ProductionBlogMigrationError(
                    `Failed to update content for postId=${item.documentId}`,
                    "RECOVERY_UPDATE_MISMATCH",
                  );
                }
                updates += 1;
              }

              if (
                input.simulateFailureAfterUpdates != null &&
                updates >= input.simulateFailureAfterUpdates
              ) {
                throw new ProductionBlogMigrationError(
                  "Simulated recovery transaction failure",
                  "RECOVERY_SIMULATED_FAILURE",
                );
              }
            }
            mongoUrlUpdates = updates;
          },
        });
      } catch (error) {
        blockers.push(error instanceof Error ? error.message : String(error));
        mongoUrlUpdates = 0;
      }

      if (blockers.length === 0) {
        postVerify = await runPostExecuteBlogMigrationVerification({
          sourceDb: input.handles.sourceDb,
          destinationDb: input.handles.destinationDb,
          mediaExecutor,
          expectedStorageKeys: owned.storageKeys,
          migrationExecutionId,
        });
        if (postVerify.overallVerdict !== "PASS") {
          blockers.push(...postVerify.blockers);
        } else {
          // Mark recovery completion only after verifier PASS — do not erase history.
          await runStore.update({
            migrationId: migrationExecutionId,
            patch: {
              status: "verified",
              verificationStatus: "pass",
              phaseReached: "media_url_recovery",
              blockers: [],
            },
          });
          recoveryMarked = true;
          notes.push(
            "Recovery completion marked after verifier PASS; prior recovery_required history retained via updatedAt/status transition only",
          );
        }
      }
    } else if (blockers.length === 0 && gate.mode === "dry-run") {
      notes.push(
        "Dry-run only. Zero Mongo/R2/email/outbox mutations. Pass --execute with PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM=YES to apply.",
      );
    }
  }

  mutationProof.r2Put = mediaExecutor.getWriteCount();
  mutationProof.r2Delete = mediaExecutor.getDeleteCount();
  mutationProof.mongoUrlUpdates = mongoUrlUpdates;

  if (
    mutationProof.r2Put ||
    mutationProof.r2Delete ||
    mutationProof.emailSends ||
    mutationProof.outboxWrites ||
    mutationProof.subscriberChanges ||
    mutationProof.deliveryChanges
  ) {
    blockers.push("Forbidden side-effect mutation detected during media URL recovery");
  }

  const repairCounts = {
    planned: plannedRepairs.filter((p) => p.action === "repair").length,
    noOp: plannedRepairs.filter((p) => p.action === "no-op").length,
    preserved: plannedRepairs.filter((p) => p.action === "preserve").length,
  };

  let overallStatus: BlogMediaUrlRecoveryReport["overallStatus"];
  if (blockers.length > 0) {
    if (gate.mode === "dry-run" || gate.blockers.length > 0) {
      overallStatus =
        postVerify && postVerify.overallVerdict !== "PASS" ? "VERIFIER_FAIL" : "BLOCKED";
    } else if (postVerify && postVerify.overallVerdict !== "PASS") {
      overallStatus = "VERIFIER_FAIL";
    } else {
      overallStatus = "FAILED";
    }
  } else if (gate.mode === "dry-run") {
    overallStatus = "DRY_RUN_OK";
  } else if (repairCounts.planned === 0) {
    overallStatus = "NO_OP";
  } else {
    overallStatus = "REPAIRED";
  }

  const report: BlogMediaUrlRecoveryReport = {
    tool: "recover-production-blog-media-urls",
    mode: gate.mode,
    migrationExecutionId,
    sourceDatabase: input.handles.sourceDatabase,
    destinationDatabase: input.handles.destinationDatabase,
    overallStatus,
    gates: gate.gates,
    ownership,
    plannedRepairs,
    repairCounts,
    mutationProof,
    postExecuteVerification: postVerify,
    recoveryMarked,
    blockers: [...new Set(blockers)],
    notes,
  };

  const safe = stripForbiddenReportFields(report);
  assertNoSecretLeak(JSON.stringify(safe));
  return safe;
}

export function resolveBlogMediaUrlRecoveryMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  if (
    input.execute &&
    input.confirm === PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE
  ) {
    return "execute";
  }
  return "dry-run";
}

export function isBlogMediaUrlRecoveryExecuteRequested(
  argv: readonly string[] = process.argv,
): boolean {
  return isBlogExecuteModeRequested(argv);
}

/** Test-only empty stores for dry gate checks without destination wiring. */
export function createEmptyBlogMediaUrlRecoveryStores(): {
  durable: InMemoryBlogDurableMediaRecoveryStore;
  run: InMemoryBlogRunRecoveryStore;
} {
  return {
    durable: new InMemoryBlogDurableMediaRecoveryStore(),
    run: new InMemoryBlogRunRecoveryStore(),
  };
}
