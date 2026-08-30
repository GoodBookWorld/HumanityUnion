import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document, MongoClient } from "mongodb";

import {
  BLOG_R2_OWNERSHIP_MARKER,
  BLOG_R2_OWNERSHIP_METADATA_KEYS,
  CRASH_SAFE_BLOG_EXECUTION_ORDER,
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  InMemoryBlogDurableMediaRecoveryStore,
  InMemoryBlogR2CopyExecutor,
  InMemoryBlogR2Inspector,
  InMemoryBlogRunRecoveryStore,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionBlogMigrationError,
  assertBlogMigrationExecuteWriteGuards,
  assertNoSecretLeak,
  blogFailureAllowsOwnedR2Rollback,
  buildBlogMigrationOwnershipMetadata,
  inspectBlogMigrationRecoveryState,
  isBlogExecuteModeRequested,
  reconcileBlogMediaCreateAttempted,
  resolveBlogMigrationMode,
  rewriteCanonicalBlogMediaUrl,
  rewriteCanonicalMediaUrlsInHtml,
  rollbackBlogMigrationOwnedMedia,
  runPostExecuteBlogMigrationVerification,
  runProductionBlogMigration,
  sanitizeBlogPostForMigration,
  sha256Hex,
} from "../../../src/modules/production-blog-migration/index.js";

type MemDoc = Document & { _id?: string };

function getPath(doc: MemDoc, path: string): unknown {
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, doc);
}

function matchesFilter(doc: MemDoc, filter: Document): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (key === "_id") {
      if (String(doc._id) !== String(value)) return false;
      continue;
    }
    const actual = getPath(doc, key);
    if (String(actual) !== String(value)) return false;
  }
  return true;
}

class MemoryCursor {
  constructor(private readonly docs: MemDoc[]) {}
  project(_p: Document) {
    return this;
  }
  sort(_s: Document) {
    return this;
  }
  async toArray() {
    return this.docs.map((d) => ({ ...d }));
  }
}

class MemoryCollection {
  constructor(
    private readonly store: Map<string, MemDoc[]>,
    private readonly name: string,
  ) {}
  private rows(): MemDoc[] {
    return this.store.get(this.name) ?? [];
  }
  async findOne(filter: Document) {
    return this.rows().find((doc) => matchesFilter(doc, filter)) ?? null;
  }
  find(filter: Document = {}) {
    return new MemoryCursor(this.rows().filter((doc) => matchesFilter(doc, filter)));
  }
  async countDocuments(filter: Document = {}) {
    return this.rows().filter((doc) => matchesFilter(doc, filter)).length;
  }
  async insertOne(doc: Document) {
    const rows = this.rows();
    const insertedId = (doc as MemDoc)._id ?? `oid-${this.name}-${rows.length}`;
    const stored = { ...(doc as MemDoc), _id: insertedId };
    rows.push(stored);
    this.store.set(this.name, rows);
    return { insertedId, acknowledged: true };
  }
  async deleteOne(filter: Document) {
    const rows = this.rows();
    const idx = rows.findIndex((doc) => matchesFilter(doc, filter));
    if (idx < 0) return { deletedCount: 0 };
    rows.splice(idx, 1);
    this.store.set(this.name, rows);
    return { deletedCount: 1 };
  }
  async updateOne() {
    return { matchedCount: 0, modifiedCount: 0 };
  }
}

class MemoryDb {
  readonly store = new Map<string, MemDoc[]>();
  collection(name: string) {
    if (!this.store.has(name)) this.store.set(name, []);
    return new MemoryCollection(this.store, name);
  }
  seed(name: string, docs: MemDoc[]) {
    this.store.set(
      name,
      docs.map((d) => ({ ...d })),
    );
  }
  asDb(): Db {
    return this as unknown as Db;
  }
}

const AUTHOR = "participant-author-1";
const ACTOR = "participant-actor-1";
const GRANTER = "participant-granter-1";
const DECIDER = "participant-decider-1";
const LINKED = "participant-linked-1";

function seedCategory(categoryId: string, extras: Partial<MemDoc> = {}): MemDoc {
  const slug =
    categoryId === "conscious_existence"
      ? "conscious-existence"
      : categoryId === "human_security"
        ? "human-security"
        : categoryId === "our_life"
          ? "our-life"
          : "human-potential";
  const name =
    categoryId === "conscious_existence"
      ? "Conscious Existence"
      : categoryId === "human_security"
        ? "Human Security"
        : categoryId === "our_life"
          ? "Our Life"
          : "Human Potential";
  return {
    _id: categoryId,
    categoryId,
    slug,
    name,
    status: "active",
    sortOrder: 1,
    ...extras,
  };
}

function seedPerfectSource(): { source: MemoryDb; dest: MemoryDb } {
  const source = new MemoryDb();
  const dest = new MemoryDb();

  const categories = [
    ...EXPECTED_SEED_CATEGORY_IDS.map((id, i) => seedCategory(id, { sortOrder: i + 1 })),
    seedCategory(EXPECTED_INSERT_CATEGORY_ID, { sortOrder: 4 }),
  ];
  source.seed("blog_categories", categories);
  dest.seed(
    "blog_categories",
    EXPECTED_SEED_CATEGORY_IDS.map((id, i) => seedCategory(id, { sortOrder: i + 1 })),
  );

  const posts: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts; i += 1) {
    const postId = `blog-post-${i}`;
    const mediaId = `media-${i}`;
    posts.push({
      _id: postId,
      postId,
      slug: `slug-${i}`,
      authorParticipantId: AUTHOR,
      categoryId: categories[i % categories.length]!.categoryId,
      status: "published",
      coverMedia: {
        mediaId,
        mediaUrl: `https://media-staging.huws.org/blog/${mediaId}.png`,
      },
      optimization: {
        socialImage: {
          mediaId,
          mediaUrl: `https://media-staging.huws.org/blog/${mediaId}.png`,
        },
      },
      content:
        i === 0
          ? `<p>Hello</p><img src="/api/v1/media/files/blog/${mediaId}.png" alt="x" /><img src="https://i0.wp.com/huws.org/wp-content/uploads/x.jpg" />`
          : `<p>Hello</p><img src="/api/v1/media/files/blog/${mediaId}.png" alt="x" />`,
    });
  }
  source.seed("blog_posts", posts);

  const mediaDocs = posts.map((p, i) => ({
    _id: `media-${i}`,
    mediaId: `media-${i}`,
    storageKey: `blog/media-${i}.png`,
    mediaUrl: `https://media-staging.huws.org/blog/media-${i}.png`,
    purpose: "blog-image",
    ownerParticipantId: AUTHOR,
  }));
  source.seed("media_upload_records", mediaDocs);
  dest.seed("media_upload_records", []);

  const subscribers: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers; i += 1) {
    subscribers.push({
      _id: `sub-${i}`,
      subscriberId: `sub-${i}`,
      emailNormalized: `user${i}@example.com`,
      emailDisplay: `user${i}@example.com`,
      subscriptionType: "blog_publications",
      status: i < 6 ? "not_confirmed" : "subscribed",
      confirmTokenHash: `hash-confirm-${i}`,
      confirmTokenExpiresAt: "2030-01-01T00:00:00.000Z",
      unsubscribeTokenHash: `hash-unsub-${i}`,
      emailsSent: i,
      ...(i >= 15 ? { participantId: LINKED } : {}),
    });
  }
  source.seed("blog_subscribers", subscribers);

  const deliveries: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_publication_deliveries; i += 1) {
    deliveries.push({
      _id: `del-${i}`,
      deliveryId: `del-${i}`,
      postId: posts[i % posts.length]!.postId,
      subscriberId: subscribers[i % subscribers.length]!.subscriberId,
      status: "sent",
    });
  }
  source.seed("blog_publication_deliveries", deliveries);

  source.seed("blog_reactions", [
    {
      _id: "rxn-0",
      reactionId: "rxn-0",
      postId: posts[0]!.postId,
      actorParticipantId: ACTOR,
      reaction: "helpful",
    },
    {
      _id: "rxn-1",
      reactionId: "rxn-1",
      postId: posts[1]!.postId,
      actorParticipantId: ACTOR,
      reaction: "helpful",
    },
    {
      _id: "rxn-2",
      reactionId: "rxn-2",
      postId: posts[2]!.postId,
      actorParticipantId: ACTOR,
      reaction: "not_helpful",
    },
  ]);

  source.seed("blog_capability_grants", [
    { _id: AUTHOR, participantId: AUTHOR, grantedByParticipantId: GRANTER },
    { _id: ACTOR, participantId: ACTOR, grantedByParticipantId: GRANTER },
    { _id: LINKED, participantId: LINKED, grantedByParticipantId: GRANTER },
  ]);

  source.seed("blog_author_applications", [
    {
      _id: "app-1",
      applicationId: "app-1",
      participantId: AUTHOR,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["conscious_existence"],
      status: "approved",
    },
    {
      _id: "app-2",
      applicationId: "app-2",
      participantId: ACTOR,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["human_potential"],
      status: "approved",
    },
    {
      _id: "app-3",
      applicationId: "app-3",
      participantId: LINKED,
      decidedByParticipantId: DECIDER,
      preferredCategoryIds: ["our_life"],
      status: "approved",
    },
  ]);

  for (const name of [
    "blog_subscription_settings",
    "blog_admin_subscriber_messages",
    "blog_admin_subscriber_message_deliveries",
    "blog_comments",
    "outbox",
    "processed_events",
  ] as const) {
    source.seed(name, []);
    dest.seed(name, []);
  }
  dest.seed("blog_posts", []);
  dest.seed("blog_subscribers", []);
  dest.seed("blog_publication_deliveries", []);
  dest.seed("blog_reactions", []);
  dest.seed("blog_capability_grants", []);
  dest.seed("blog_author_applications", []);

  for (const memberId of [AUTHOR, ACTOR, GRANTER, DECIDER, LINKED]) {
    const members = dest.store.get("members") ?? [];
    members.push({ _id: memberId, memberId });
    dest.store.set("members", members);
  }

  return { source, dest };
}

function seedR2(
  inspector: InMemoryBlogR2Inspector,
  media: InMemoryBlogR2CopyExecutor,
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts; i += 1) {
    const key = `blog/media-${i}.png`;
    const body = Buffer.from(`blog-media-body-${i}`);
    keys.push(key);
    inspector.seedSource(key, { body, contentType: "image/png" });
    media.seedSource(key, body, "image/png");
  }
  return keys;
}

function stubClient(): MongoClient {
  return {
    startSession: () => {
      throw new Error("session should not be used under forceNonTransactional");
    },
  } as unknown as MongoClient;
}

async function runExecute(input: {
  source: MemoryDb;
  dest: MemoryDb;
  execute: boolean;
  confirm?: string;
  media: InMemoryBlogR2CopyExecutor;
  inspector: InMemoryBlogR2Inspector;
  durable?: InMemoryBlogDurableMediaRecoveryStore;
  runStore?: InMemoryBlogRunRecoveryStore;
  crashAfterR2Copy?: boolean;
  crashAfterMongoCommit?: boolean;
  crashAfterPutBeforeLedger?: boolean;
}) {
  return runProductionBlogMigration({
    handles: {
      sourceClient: stubClient(),
      sourceDb: input.source.asDb(),
      sourceDatabase: "hu_test_blog_src",
      destinationClient: stubClient(),
      destinationDb: input.dest.asDb(),
      destinationDatabase: "hu_test_blog_dst",
    },
    execute: input.execute,
    confirm: input.confirm,
    allowTestIsolation: true,
    forceNonTransactional: true,
    r2Configured: true,
    r2Inspector: input.inspector,
    mediaExecutor: input.media,
    durableMediaRecoveryStore: input.durable ?? new InMemoryBlogDurableMediaRecoveryStore(),
    runRecoveryStore: input.runStore ?? new InMemoryBlogRunRecoveryStore(),
    crashAfterR2Copy: input.crashAfterR2Copy,
    crashAfterMongoCommit: input.crashAfterMongoCommit,
    crashAfterPutBeforeLedger: input.crashAfterPutBeforeLedger,
    mutationCounters: { emailSends: 0, outboxWrites: 0 },
  });
}

describe("Production Blog migration execute — Task 04", () => {
  it("execution gate: dry-run default; CONFIRM required", () => {
    assert.equal(isBlogExecuteModeRequested(["node", "x.ts"]), false);
    assert.equal(isBlogExecuteModeRequested(["node", "x.ts", "--execute"]), true);
    assert.equal(resolveBlogMigrationMode({ execute: true, confirm: "NO" }), "dry-run");
    assert.equal(
      resolveBlogMigrationMode({
        execute: true,
        confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      }),
      "execute",
    );
    assert.throws(
      () =>
        assertBlogMigrationExecuteWriteGuards({
          sourceDatabase: "humanity_union_staging",
          destinationDatabase: "humanity_union_production",
          execute: true,
          confirm: undefined,
        }),
      (error: unknown) =>
        error instanceof ProductionBlogMigrationError &&
        error.code === "MISSING_CONFIRMATION",
    );
  });

  it("documents crash-safe order with R2 before Mongo URL commits", () => {
    assert.ok(CRASH_SAFE_BLOG_EXECUTION_ORDER.indexOf("P2a_r2_objects") < CRASH_SAFE_BLOG_EXECUTION_ORDER.indexOf("P1_categories"));
    assert.ok(CRASH_SAFE_BLOG_EXECUTION_ORDER.indexOf("P2a_r2_objects") < CRASH_SAFE_BLOG_EXECUTION_ORDER.indexOf("P5_posts"));
  });

  it("zero PUT/DELETE in dry-run", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);
    const report = await runExecute({
      source,
      dest,
      execute: false,
      media,
      inspector,
    });
    assert.equal(report.mode, "dry-run");
    assert.equal(report.overallStatus, "DRY_RUN");
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(media.writeCount, 0);
    assert.equal(dest.store.get("blog_posts")!.length, 0);
  });

  it("fresh successful migration + category insert + URL rewrite + external preserve", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });

    assert.equal(report.overallStatus, "SUCCESS");
    assert.equal(report.media.copied, 14);
    assert.equal(dest.store.get("blog_posts")!.length, 14);
    assert.equal(dest.store.get("blog_subscribers")!.length, 17);
    assert.equal(dest.store.get("blog_publication_deliveries")!.length, 18);
    assert.equal(dest.store.get("blog_categories")!.length, 4);
    assert.ok(
      dest.store.get("blog_categories")!.some((c) => c.categoryId === EXPECTED_INSERT_CATEGORY_ID),
    );
    assert.equal(dest.store.get("media_upload_records")!.length, 14);

    const post0 = dest.store.get("blog_posts")!.find((p) => p.postId === "blog-post-0")!;
    assert.match(String(post0.content), /i0\.wp\.com/);
    assert.match(String(post0.content), new RegExp(PRODUCTION_MEDIA_PUBLIC_BASE_URL));
    assert.equal(
      (post0.coverMedia as { mediaUrl: string }).mediaUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/media-0.png`,
    );

    const sub = dest.store.get("blog_subscribers")!.find((s) => s.subscriberId === "sub-0")!;
    assert.equal(sub.confirmTokenHash, "hash-confirm-0");
    assert.equal(sub.unsubscribeTokenHash, "hash-unsub-0");
    assert.equal(sub.status, "not_confirmed");

    const text = JSON.stringify(report);
    assert.equal(text.includes("user0@example.com"), false);
    assert.equal(text.includes("hash-confirm-0"), false);
    assert.equal(report.mutationProof.emailSends, 0);
    assert.equal(report.mutationProof.outboxWrites, 0);
    assert.equal(report.postExecuteVerification?.overallVerdict, "PASS");
    assertNoSecretLeak(text);
  });

  it("subscriber token-state preserved without report leakage", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);
    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });
    const migrated = dest.store.get("blog_subscribers")!;
    assert.equal(migrated.length, 17);
    assert.ok(migrated.every((s) => typeof s.confirmTokenHash === "string"));
    assert.ok(migrated.every((s) => typeof s.unsubscribeTokenHash === "string"));
    const text = JSON.stringify(report);
    assert.equal(text.includes("confirmTokenHash"), false);
    assert.equal(text.includes("emailNormalized"), false);
  });

  it("historical deliveries do not resend / no email outbox", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);
    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });
    const deliveries = dest.store.get("blog_publication_deliveries")!;
    assert.equal(deliveries.length, 18);
    assert.ok(deliveries.every((d) => d.status === "sent"));
    assert.equal(dest.store.get("outbox")!.length, 0);
    assert.equal(report.mutationProof.emailSends, 0);
    const deliveryPhase = report.phases.find((p) => p.phase === "P8_publication_deliveries");
    assert.equal(deliveryPhase?.counts.resends, 0);
  });

  it("R2 copy ownership + destination collision fail closed", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);
    media.seedDestination("blog/media-0.png", Buffer.from("foreign-bytes"), "image/png");

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });
    assert.equal(report.overallStatus, "FAILED");
    assert.ok(report.blockers.some((b) => /collision/i.test(b)));
    assert.equal(dest.store.get("blog_posts")!.length, 0);
  });

  it("failure before Mongo commit rolls back owned R2 only", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      durable,
      runStore,
      crashAfterR2Copy: true,
    });

    assert.equal(report.overallStatus, "FAILED");
    assert.equal(dest.store.get("blog_posts")!.length, 0);
    assert.equal(media.destination.size, 0);
    assert.ok(report.rollback.mediaKeysDeleted > 0);
  });

  it("crash between R2 copy and Mongo commit is recoverable", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      durable,
      runStore,
      crashAfterR2Copy: true,
    });

    const inspected = await inspectBlogMigrationRecoveryState({
      migrationId: report.migrationExecutionId,
      durableMediaStore: durable,
      runStore,
      mediaExecutor: media,
    });
    assert.equal(inspected.runStatus, "failed_before_mongo_commit");
    assert.equal(inspected.mongoTransactionStatus, "aborted");
  });

  it("failure after Mongo commit enters recovery_required (no blind mongo rollback)", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      runStore,
      crashAfterMongoCommit: true,
    });

    assert.equal(report.overallStatus, "RECOVERY_REQUIRED");
    assert.equal(dest.store.get("blog_posts")!.length, 14);
    assert.equal(report.rollback.mongoInsertsRolledBack, 0);
    assert.match(report.rollback.strategy, /no-blind-mongo-rollback/);
    // Commit marker must already be durable before post-commit failure handling.
    const run = await runStore.get(report.migrationExecutionId);
    assert.equal(run?.mongoTransactionStatus, "committed");
  });

  it("mongo commit marker is durable inside txn — refuse R2 rollback if posts present without committed flag", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      durable,
      runStore,
    });
    assert.equal(report.overallStatus, "SUCCESS");
    const run = await runStore.get(report.migrationExecutionId);
    assert.equal(run?.mongoTransactionStatus, "committed");
    assert.equal(run?.status, "verified");

    assert.equal(
      blogFailureAllowsOwnedR2Rollback({
        mongoTransactionStatus: "committed",
        destinationBlogPostCount: 14,
      }),
      false,
    );
    assert.equal(
      blogFailureAllowsOwnedR2Rollback({
        mongoTransactionStatus: "in_progress",
        destinationBlogPostCount: 14,
      }),
      false,
      "lagging commit marker with live posts must refuse R2 compensating delete",
    );
    assert.equal(
      blogFailureAllowsOwnedR2Rollback({
        mongoTransactionStatus: "in_progress",
        destinationBlogPostCount: 0,
      }),
      true,
    );
    assert.equal(media.destination.size, 14);
    assert.equal(dest.store.get("blog_posts")!.length, 14);
  });

  it("recovery/resume owned media rollback", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    // Force fail after put on first object by crashing after all copies via crashAfterR2
    // First succeed a partial owned state manually:
    const migrationId = "mig_recovery_test";
    await runStore.createPlanned({
      migrationId,
      expectedStorageKeys: ["blog/media-0.png"],
    });
    const body = Buffer.from("blog-media-body-0");
    await durable.upsertPlanned({
      migrationExecutionId: migrationId,
      storageKey: "blog/media-0.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/media-0.png`,
      expectedContentSha256: "a".repeat(64),
      expectedContentLength: body.byteLength,
      expectedContentType: "image/png",
      preCopyDestinationState: "ABSENT",
    });
    media.seedSource("blog/media-0.png", body);
    await media.copyPublicObject({
      storageKey: "blog/media-0.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/media-0.png`,
      migrationExecutionId: migrationId,
    });
    await durable.markCreatedVerified(migrationId, "blog/media-0.png");

    const result = await rollbackBlogMigrationOwnedMedia({
      migrationId,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      durableMediaStore: durable,
      runStore,
      mediaExecutor: media,
    });
    assert.ok(result.deleted.includes("blog/media-0.png"));
    assert.equal(media.destination.has("blog/media-0.png"), false);
    // silence unused
    assert.ok(source && dest && inspector);
  });

  it("rerun/idempotency after success does not duplicate", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    seedR2(inspector, media);

    const first = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });
    assert.equal(first.overallStatus, "SUCCESS");

    const inspector2 = new InMemoryBlogR2Inspector();
    const media2 = new InMemoryBlogR2CopyExecutor();
    // Destination already has objects; seed source for preflight R2 PASS with equivalents
    for (let i = 0; i < 14; i += 1) {
      const key = `blog/media-${i}.png`;
      const body = Buffer.from(`blog-media-body-${i}`);
      inspector2.seedSource(key, { body, contentType: "image/png" });
      media2.seedSource(key, body);
      // Dest objects exist from first run — copy them into media2 destination for equivalence
      const existing = media.destination.get(key);
      if (existing) {
        media2.seedDestination(key, existing.body, existing.contentType, existing.metadata);
        inspector2.seedDestination(key, {
          contentLength: existing.body.byteLength,
          contentType: existing.contentType,
          checksumSHA256: null,
        });
      }
    }

    // Preflight will see destination mediaId collisions and R2 collisions → should refuse execute
    await assert.rejects(
      () =>
        runExecute({
          source,
          dest,
          execute: true,
          confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
          media: media2,
          inspector: inspector2,
        }),
      (error: unknown) =>
        error instanceof ProductionBlogMigrationError &&
        (error.code === "PREFLIGHT_NOT_PASS" ||
          error.code === "MEDIA_COPY_NOT_READY" ||
          error.code === "R2_PREFLIGHT_NOT_PASS"),
    );

    // If destination counts already complete, ALREADY_COMPLETE path:
    // Simulate by only checking destinationAlreadyComplete when preflight would pass —
    // After success, dest has collisions so preflight blocks. That's fail-closed (correct).
    assert.equal(dest.store.get("blog_posts")!.length, 14);
  });

  it("canonical media URL rewrite helpers", () => {
    assert.equal(
      rewriteCanonicalBlogMediaUrl("https://media-staging.huws.org/blog/a.png"),
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/a.png`,
    );
    assert.equal(
      rewriteCanonicalBlogMediaUrl("https://i0.wp.com/huws.org/x.jpg"),
      "https://i0.wp.com/huws.org/x.jpg",
    );
    const html = rewriteCanonicalMediaUrlsInHtml(
      `<img src="/api/v1/media/files/blog/a.png" /><img src="https://i0.wp.com/x.jpg" />`,
    );
    assert.match(String(html), new RegExp(PRODUCTION_MEDIA_PUBLIC_BASE_URL));
    assert.match(String(html), /i0\.wp\.com/);
    const post = sanitizeBlogPostForMigration({
      postId: "p1",
      content: `<img src="https://i0.wp.com/x.jpg" />`,
      coverMedia: {
        mediaId: "m1",
        mediaUrl: "https://media-staging.huws.org/blog/m1.png",
      },
    });
    assert.match(String(post.content), /i0\.wp\.com/);
    assert.equal(
      (post.coverMedia as { mediaUrl: string }).mediaUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/m1.png`,
    );
  });

  it("future migration rewrites structured *.r2.dev media via storageKey map (recurrence fix)", () => {
    const mediaIdToStorageKey = new Map([["m1", "blog/m1.png"]]);
    const r2Dev =
      "https://pub-abc123.r2.dev/blog/m1.png";
    const post = sanitizeBlogPostForMigration(
      {
        postId: "p1",
        content: `<img src="${r2Dev}" /><img src="https://i0.wp.com/huws.org/x.jpg" />`,
        coverMedia: { mediaId: "m1", mediaUrl: r2Dev },
        optimization: {
          socialImage: { mediaId: "m1", mediaUrl: r2Dev },
        },
      },
      PRODUCTION_MEDIA_PUBLIC_BASE_URL,
      mediaIdToStorageKey,
    );
    assert.equal(
      (post.coverMedia as { mediaUrl: string }).mediaUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/m1.png`,
    );
    assert.equal(
      (post.optimization as { socialImage: { mediaUrl: string } }).socialImage.mediaUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/m1.png`,
    );
    assert.match(String(post.content), new RegExp(PRODUCTION_MEDIA_PUBLIC_BASE_URL));
    assert.match(String(post.content), /i0\.wp\.com/);
    assert.equal(
      rewriteCanonicalBlogMediaUrl(r2Dev, PRODUCTION_MEDIA_PUBLIC_BASE_URL, new Set(["blog/m1.png"])),
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/blog/m1.png`,
    );
    // Without ownership map, hostname alone must not decide rewrite of r2.dev:
    assert.equal(rewriteCanonicalBlogMediaUrl(r2Dev), r2Dev);
  });

  it("post-execute verification PASS after successful migrate", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const keys = seedR2(inspector, media);
    await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
    });
    const verify = await runPostExecuteBlogMigrationVerification({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      mediaExecutor: media,
      expectedStorageKeys: keys,
    });
    assert.equal(verify.overallVerdict, "PASS");
    assert.equal(verify.posts.externalHttpsPreserveIntact, true);
    assert.equal(verify.media.r2Equivalent, 14);
  });

  it("TOCTOU: destination appears between HEAD and conditional PUT — fail closed, no overwrite", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    seedR2(inspector, media);
    media.raceAppearBeforeConditionalPut.add("blog/media-0.png");
    const foreign = Buffer.from(media.raceForeignBody);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      durable,
    });

    assert.equal(report.overallStatus, "FAILED");
    assert.ok(report.blockers.some((b) => /TOCTOU race|MEDIA_DESTINATION_RACE/i.test(b)));
    assert.equal(dest.store.get("blog_posts")!.length, 0);
    // Foreign object must remain unchanged (never overwritten with migration body).
    const raced = media.destination.get("blog/media-0.png");
    assert.ok(raced);
    assert.deepEqual(raced.body, foreign);
    assert.equal(raced.metadata[BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId], undefined);
    const row = await durable.get(report.migrationExecutionId, "blog/media-0.png");
    assert.equal(row?.status, "create_rejected_race");
    assert.equal(
      durable
        .records.get(`${report.migrationExecutionId}::blog/media-0.png`)
        ?.status,
      "create_rejected_race",
    );
  });

  it("crash after successful PUT before ledger — reconcile ownership then rollback owned only", async () => {
    const { source, dest } = seedPerfectSource();
    const inspector = new InMemoryBlogR2Inspector();
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    seedR2(inspector, media);

    const report = await runExecute({
      source,
      dest,
      execute: true,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      media,
      inspector,
      durable,
      runStore,
      crashAfterPutBeforeLedger: true,
    });

    assert.equal(report.overallStatus, "FAILED");
    assert.ok(report.rollback.mediaKeysDeleted >= 1);
    assert.equal(dest.store.get("blog_posts")!.length, 0);
    // Owned object from crashed PUT must be cleaned up; no orphan migration-owned keys.
    for (const [key, obj] of media.destination) {
      assert.notEqual(
        obj.metadata[BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId],
        report.migrationExecutionId,
        `orphaned owned key ${key}`,
      );
    }
  });

  it("reconcile create_attempted via R2 ownership metadata after crash", async () => {
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const migrationId = "mig_reconcile_toctou";
    const key = "blog/media-0.png";
    const body = Buffer.from("blog-media-body-0");
    media.seedSource(key, body);
    await durable.upsertPlanned({
      migrationExecutionId: migrationId,
      storageKey: key,
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${key}`,
      expectedContentSha256: sha256Hex(body),
      expectedContentLength: body.byteLength,
      expectedContentType: "image/png",
      preCopyDestinationState: "ABSENT",
    });
    await durable.markCreateAttempted(migrationId, key);
    // Simulate PUT success without ledger created_verified:
    media.seedDestination(
      key,
      body,
      "image/png",
      buildBlogMigrationOwnershipMetadata(migrationId),
    );

    const result = await reconcileBlogMediaCreateAttempted({
      migrationId,
      durableMediaStore: durable,
      mediaExecutor: media,
    });
    assert.deepEqual(result.ownedKeys, [key]);
    assert.equal((await durable.get(migrationId, key))?.status, "created_verified");
  });

  it("rollback refuses deletion when ownership marker/runId differs", async () => {
    const media = new InMemoryBlogR2CopyExecutor();
    const durable = new InMemoryBlogDurableMediaRecoveryStore();
    const runStore = new InMemoryBlogRunRecoveryStore();
    const migrationId = "mig_rollback_refuse";
    const key = "blog/media-0.png";
    const body = Buffer.from("blog-media-body-0");
    await runStore.createPlanned({ migrationId, expectedStorageKeys: [key] });
    await durable.upsertPlanned({
      migrationExecutionId: migrationId,
      storageKey: key,
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${key}`,
      expectedContentSha256: sha256Hex(body),
      expectedContentLength: body.byteLength,
      expectedContentType: "image/png",
      preCopyDestinationState: "ABSENT",
    });
    await durable.markCreatedVerified(migrationId, key);
    // Foreign ownership marker (different runId)
    media.seedDestination(key, body, "image/png", {
      [BLOG_R2_OWNERSHIP_METADATA_KEYS.executionId]: "mig_other_run",
      [BLOG_R2_OWNERSHIP_METADATA_KEYS.marker]: BLOG_R2_OWNERSHIP_MARKER,
    });

    const result = await rollbackBlogMigrationOwnedMedia({
      migrationId,
      confirm: PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
      durableMediaStore: durable,
      runStore,
      mediaExecutor: media,
    });
    assert.ok(result.skipped.includes(key));
    assert.equal(result.deleted.includes(key), false);
    assert.ok(media.destination.has(key));
  });
});
