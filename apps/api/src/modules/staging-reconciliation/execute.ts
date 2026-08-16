import type { Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { hydrateInitiativeMongoPersistence } from "../initiatives/persistence/initiative-mongo.persistence.js";
import {
  APPROVED_INITIATIVE_IDS,
  STAGING_ADMIN_MEMBER_ID,
  STAGING_ADMIN_USER_ID,
} from "./constants.js";
import { StagingReconciliationError, isBcryptHash } from "./guards.js";
import type { ReconciliationPlan } from "./plan.js";
import type { ReconciliationPortableBundle } from "./portable-bundle.js";

export interface ReconciliationWriteSummary {
  mode: "execute";
  authRestored: number;
  authSkipped: number;
  inserted: Record<string, number>;
  skipped: Record<string, number>;
  mediaAlreadyCanonical: number;
  mediaRewritten: number;
  stagingAdminUntouched: boolean;
  hydrateRequested: boolean;
  confirmation: string;
  loginReady: Record<string, boolean>;
}

function stripMongoId(record: Record<string, unknown>): Record<string, unknown> {
  const { _id: _unused, ...rest } = record;
  return rest;
}

export async function executeStagingReconciliation(input: {
  client: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  bundle: ReconciliationPortableBundle;
  plan: ReconciliationPlan;
}): Promise<ReconciliationWriteSummary> {
  if (input.plan.conflicts.length > 0) {
    throw new StagingReconciliationError(
      `Refusing execute: plan has ${input.plan.conflicts.length} conflict(s).`,
    );
  }

  const source = input.client.db(input.sourceDatabase);
  const target = input.client.db(input.targetDatabase);

  const adminBefore = await target.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });
  const adminHashBefore = String(adminBefore?.passwordHash ?? "");

  const summary: ReconciliationWriteSummary = {
    mode: "execute",
    authRestored: 0,
    authSkipped: 0,
    inserted: {
      comments: 0,
      commentReactions: 0,
      analysisReactions: 0,
      supportRegistered: 0,
      supportVisitor: 0,
      bookmarks: 0,
      views: 0,
    },
    skipped: {
      comments: 0,
      commentReactions: 0,
      analysisReactions: 0,
      supportRegistered: 0,
      supportVisitor: 0,
      bookmarks: 0,
      views: 0,
    },
    mediaAlreadyCanonical: 0,
    mediaRewritten: 0,
    stagingAdminUntouched: false,
    hydrateRequested: false,
    confirmation: "",
    loginReady: {},
  };

  for (const item of input.plan.auth) {
    if (item.action === "already_canonical") {
      summary.authSkipped += 1;
      summary.loginReady[item.key] = true;
      continue;
    }
    if (item.action !== "restore") {
      throw new StagingReconciliationError(`Cannot execute auth action ${item.action} for ${item.key}`);
    }

    const sourceAuth = await source.collection(MONGO_COLLECTIONS.authUsers).findOne({
      userId: item.userId,
    });
    if (!sourceAuth || !isBcryptHash(sourceAuth.passwordHash)) {
      throw new StagingReconciliationError(`Source hash missing for ${item.key}`);
    }
    if (item.userId === STAGING_ADMIN_USER_ID || item.memberId === STAGING_ADMIN_MEMBER_ID) {
      throw new StagingReconciliationError("Refusing to modify staging administrator.");
    }

    const meta = input.bundle.authRecovery.participants.find((entry) => entry.key === item.key);
    const emailVerificationStatus =
      meta?.sourceEmailVerificationStatus === "verified" ? "verified" : "verified";
    const emailVerifiedAt =
      typeof meta?.sourceEmailVerifiedAt === "string" && meta.sourceEmailVerifiedAt
        ? meta.sourceEmailVerifiedAt
        : new Date().toISOString();

    await target.collection(MONGO_COLLECTIONS.authUsers).updateOne(
      { userId: item.userId, memberId: item.memberId },
      {
        $set: {
          passwordHash: sourceAuth.passwordHash,
          emailVerificationStatus,
          emailVerifiedAt,
          status: "active",
          role: "member",
          updatedAt: new Date().toISOString(),
        },
        $unset: {
          refreshToken: "",
          refreshTokens: "",
          sessions: "",
          verificationToken: "",
          passwordResetToken: "",
        },
      },
    );
    summary.authRestored += 1;
    summary.loginReady[item.key] = true;
  }

  summary.inserted.comments = await insertManyById(
    target,
    MONGO_COLLECTIONS.initiativeComments,
    input.bundle.comments.records,
    "commentId",
    input.plan.comments,
  );
  summary.skipped.comments = input.plan.comments.filter((i) => i.action === "skip_existing").length;

  summary.inserted.commentReactions = await insertManyById(
    target,
    MONGO_COLLECTIONS.initiativeCommentReactions,
    input.bundle.commentReactions.records,
    "reactionId",
    input.plan.commentReactions,
  );
  summary.skipped.commentReactions = input.plan.commentReactions.filter(
    (i) => i.action === "skip_existing",
  ).length;

  summary.inserted.analysisReactions = await insertManyById(
    target,
    MONGO_COLLECTIONS.initiativeAnalysisReactions,
    input.bundle.analysisReactions.records,
    "reactionId",
    input.plan.analysisReactions,
  );
  summary.skipped.analysisReactions = input.plan.analysisReactions.filter(
    (i) => i.action === "skip_existing",
  ).length;

  summary.inserted.supportRegistered = await insertManyById(
    target,
    MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
    input.bundle.supportSignals.registered,
    "signalId",
    input.plan.supportRegistered,
  );
  summary.skipped.supportRegistered = input.plan.supportRegistered.filter(
    (i) => i.action === "skip_existing",
  ).length;

  summary.inserted.supportVisitor = await insertManyById(
    target,
    MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
    input.bundle.supportSignals.visitor,
    "signalId",
    input.plan.supportVisitor,
  );
  summary.skipped.supportVisitor = input.plan.supportVisitor.filter(
    (i) => i.action === "skip_existing",
  ).length;

  for (const item of input.plan.bookmarks) {
    if (item.action !== "create") {
      summary.skipped.bookmarks = (summary.skipped.bookmarks ?? 0) + 1;
      continue;
    }
    const record = input.bundle.bookmarks.records.find(
      (entry) => `${entry.initiativeId}:${entry.userId}` === item.id,
    );
    if (!record) continue;
    await target.collection(MONGO_COLLECTIONS.initiativeSupportBookmarks).insertOne(
      stripMongoId(record) as Document,
    );
    summary.inserted.bookmarks = (summary.inserted.bookmarks ?? 0) + 1;
  }

  for (const item of input.plan.views) {
    if (item.action !== "create") {
      summary.skipped.views = (summary.skipped.views ?? 0) + 1;
      continue;
    }
    const record = input.bundle.views.records.find(
      (entry) => `${entry.initiativeId}:${entry.viewerKey}` === item.id,
    );
    if (!record) continue;
    await target.collection(MONGO_COLLECTIONS.initiativeSupportViews).insertOne(
      stripMongoId(record) as Document,
    );
    summary.inserted.views = (summary.inserted.views ?? 0) + 1;
  }

  for (const item of input.plan.media) {
    if (item.action === "already_canonical") {
      summary.mediaAlreadyCanonical += 1;
      continue;
    }
    if (item.action === "restore") {
      const rewritten = await rewriteLocalhostInitiativeMedia(target, item.initiativeId);
      if (rewritten) summary.mediaRewritten += 1;
    }
  }

  try {
    await hydrateInitiativeMongoPersistence();
    summary.hydrateRequested = true;
  } catch {
    summary.hydrateRequested = false;
  }

  const adminAfter = await target.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });
  summary.stagingAdminUntouched =
    String(adminAfter?.userId ?? "") === STAGING_ADMIN_USER_ID &&
    String(adminAfter?.memberId ?? "") === STAGING_ADMIN_MEMBER_ID &&
    String(adminAfter?.role ?? "") === "admin" &&
    String(adminAfter?.passwordHash ?? "") === adminHashBefore;

  if (!summary.stagingAdminUntouched) {
    throw new StagingReconciliationError(
      "Post-reconciliation assertion failed: staging administrator changed.",
    );
  }

  summary.confirmation =
    "STAGING RECONCILIATION WRITE COMPLETE for approved auth recovery + Initiative-scoped engagement history. Media binaries not re-uploaded.";
  return summary;
}

async function insertManyById(
  target: Db,
  collectionName: string,
  records: Array<Record<string, unknown>>,
  idField: string,
  planItems: Array<{ id: string; action: string }>,
): Promise<number> {
  let inserted = 0;
  const createIds = new Set(
    planItems.filter((item) => item.action === "create").map((item) => item.id),
  );
  for (const record of records) {
    const id = String(record[idField] ?? "");
    if (!createIds.has(id)) continue;
    const initiativeId = String(record.initiativeId ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      throw new StagingReconciliationError(`Refusing insert outside approved Initiatives: ${initiativeId}`);
    }
    await target.collection(collectionName).insertOne(stripMongoId(record) as Document);
    inserted += 1;
  }
  return inserted;
}

async function rewriteLocalhostInitiativeMedia(
  target: Db,
  initiativeId: string,
): Promise<boolean> {
  const initiative = await target.collection(MONGO_COLLECTIONS.initiatives).findOne({
    _id: initiativeId,
  } as Document);
  if (!initiative) return false;

  const metadata = (initiative.metadata ?? {}) as {
    imageUrl?: string;
    coverMedia?: { url?: string; verificationStatus?: string; type?: string; createdAt?: string };
  };
  const current = metadata.coverMedia?.url || metadata.imageUrl || "";
  if (!/localhost|127\.0\.0\.1/i.test(current)) return false;

  const mediaDocs = await target
    .collection(MONGO_COLLECTIONS.mediaUploadRecords)
    .find({
      $or: [{ initiativeId }, { storageKey: { $regex: "initiatives/historical-recovery/" } }],
    })
    .toArray();

  const canonical = mediaDocs.find((doc) => {
    const url = String(doc.mediaUrl ?? "");
    return url.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(url);
  });
  if (!canonical?.mediaUrl) return false;

  const mediaUrl = String(canonical.mediaUrl);
  await target.collection(MONGO_COLLECTIONS.initiatives).updateOne(
    { _id: initiativeId } as Document,
    {
      $set: {
        "metadata.imageUrl": mediaUrl,
        "metadata.coverMedia": {
          type: "image",
          url: mediaUrl,
          verificationStatus: "approved",
          createdAt: metadata.coverMedia?.createdAt ?? new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
    },
  );
  return true;
}
