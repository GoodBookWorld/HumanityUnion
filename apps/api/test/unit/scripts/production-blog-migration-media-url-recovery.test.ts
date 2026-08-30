import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document, MongoClient } from "mongodb";

import {
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  InMemoryBlogDurableMediaRecoveryStore,
  InMemoryBlogR2CopyExecutor,
  InMemoryBlogRunRecoveryStore,
  PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  SUPPORTED_BLOG_MEDIA_URL_RECOVERY_MIGRATION_ID,
  assessOwnedMediaUrlRepair,
  buildBlogMigrationOwnershipMetadata,
  resolveBlogMediaUrlRecoveryMode,
  runBlogMediaUrlRecovery,
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

function setPath(doc: MemDoc, path: string, value: unknown): void {
  if (!path.includes(".")) {
    doc[path] = value;
    return;
  }
  const parts = path.split(".");
  let cur: Record<string, unknown> = doc as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const next = cur[part];
    if (next == null || typeof next !== "object") {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
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
  async findOne(filter: Document, _options?: Document) {
    const found = this.rows().find((doc) => matchesFilter(doc, filter));
    return found ? { ...found } : null;
  }
  find(filter: Document = {}) {
    return new MemoryCursor(this.rows().filter((doc) => matchesFilter(doc, filter)));
  }
  async countDocuments(filter: Document = {}) {
    return this.rows().filter((doc) => matchesFilter(doc, filter)).length;
  }
  async updateOne(filter: Document, update: Document, _options?: Document) {
    const rows = this.rows();
    const idx = rows.findIndex((doc) => matchesFilter(doc, filter));
    if (idx < 0) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
    const doc = { ...rows[idx]! };
    const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
    for (const [path, value] of Object.entries(set)) {
      setPath(doc, path, value);
    }
    rows[idx] = doc;
    this.store.set(this.name, rows);
    return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
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
  cloneStore(): Map<string, MemDoc[]> {
    const next = new Map<string, MemDoc[]>();
    for (const [k, rows] of this.store) {
      next.set(
        k,
        rows.map((d) => structuredClone(d)),
      );
    }
    return next;
  }
  restoreStore(snapshot: Map<string, MemDoc[]>) {
    this.store.clear();
    for (const [k, rows] of snapshot) {
      this.store.set(
        k,
        rows.map((d) => structuredClone(d)),
      );
    }
  }
  asDb(): Db {
    return this as unknown as Db;
  }
}

const AUTHOR = "participant-author-1";
const R2_HOST = "https://pub-staging-example.r2.dev";
const MIGRATION_ID = SUPPORTED_BLOG_MEDIA_URL_RECOVERY_MIGRATION_ID;

function seedCategory(categoryId: string, extras: Partial<MemDoc> = {}): MemDoc {
  return {
    _id: categoryId,
    categoryId,
    slug: categoryId.replace(/_/g, "-"),
    name: categoryId,
    status: "active",
    sortOrder: 1,
    ...extras,
  };
}

function storageKey(i: number): string {
  return `blog/media-${i}.png`;
}

function mediaId(i: number): string {
  return `media-${i}`;
}

function r2Url(i: number): string {
  return `${R2_HOST}/${storageKey(i)}`;
}

function productionUrl(i: number): string {
  return `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey(i)}`;
}

async function seedCommittedBrokenDestination(input?: {
  mediaUrlOverride?: (i: number) => string;
  skipMediaRecovery?: boolean;
  runStatus?: "recovery_required" | "mongo_committed" | "verified";
  mongoCommitted?: boolean;
}): Promise<{
  source: MemoryDb;
  dest: MemoryDb;
  media: InMemoryBlogR2CopyExecutor;
  durable: InMemoryBlogDurableMediaRecoveryStore;
  runStore: InMemoryBlogRunRecoveryStore;
  keys: string[];
}> {
  const source = new MemoryDb();
  const dest = new MemoryDb();
  const media = new InMemoryBlogR2CopyExecutor();
  const durable = new InMemoryBlogDurableMediaRecoveryStore();
  const runStore = new InMemoryBlogRunRecoveryStore();
  const urlFor = input?.mediaUrlOverride ?? r2Url;

  const categories = [
    ...EXPECTED_SEED_CATEGORY_IDS.map((id, i) => seedCategory(id, { sortOrder: i + 1 })),
    seedCategory(EXPECTED_INSERT_CATEGORY_ID, { sortOrder: 4 }),
  ];
  source.seed("blog_categories", categories);
  dest.seed("blog_categories", categories);

  const keys: string[] = [];
  const posts: MemDoc[] = [];
  const mediaDocs: MemDoc[] = [];

  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_posts; i += 1) {
    const key = storageKey(i);
    keys.push(key);
    const body = Buffer.from(`blog-media-body-${i}`);
    media.seedSource(key, body, "image/png");
    media.seedDestination(
      key,
      body,
      "image/png",
      buildBlogMigrationOwnershipMetadata(MIGRATION_ID),
    );

    const postId = `blog-post-${i}`;
    posts.push({
      _id: postId,
      postId,
      slug: `slug-${i}`,
      authorParticipantId: AUTHOR,
      categoryId: categories[i % categories.length]!.categoryId,
      status: "published",
      coverMedia: {
        mediaId: mediaId(i),
        mediaUrl: urlFor(i),
      },
      optimization: {
        socialImage: {
          mediaId: mediaId(i),
          mediaUrl: urlFor(i),
        },
      },
      content:
        i === 0
          ? `<p>Hello</p><img src="${urlFor(i)}" alt="x" /><img src="https://i0.wp.com/huws.org/wp-content/uploads/x.jpg" />`
          : `<p>Hello</p><img src="${urlFor(i)}" alt="x" />`,
    });
    mediaDocs.push({
      _id: mediaId(i),
      mediaId: mediaId(i),
      storageKey: key,
      mediaUrl: urlFor(i),
      purpose: "blog-image",
      ownerParticipantId: AUTHOR,
    });
  }

  source.seed("blog_posts", posts);
  dest.seed("blog_posts", posts.map((p) => ({ ...p })));
  source.seed("media_upload_records", mediaDocs);
  dest.seed(
    "media_upload_records",
    mediaDocs.map((m) => ({ ...m })),
  );

  const subscribers: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_BLOG_COLLECTION_COUNTS.blog_subscribers; i += 1) {
    subscribers.push({
      _id: `sub-${i}`,
      subscriberId: `sub-${i}`,
      emailNormalized: `user${i}@example.com`,
      emailDisplay: `user${i}@example.com`,
      subscriptionType: "blog_publications",
      status: "subscribed",
      confirmTokenHash: `hash-confirm-${i}`,
      unsubscribeTokenHash: `hash-unsub-${i}`,
    });
  }
  source.seed("blog_subscribers", subscribers);
  dest.seed(
    "blog_subscribers",
    subscribers.map((s) => ({ ...s })),
  );

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
  dest.seed(
    "blog_publication_deliveries",
    deliveries.map((d) => ({ ...d })),
  );

  dest.seed("blog_reactions", [
    { _id: "rxn-0", reactionId: "rxn-0", postId: "blog-post-0", actorParticipantId: AUTHOR },
    { _id: "rxn-1", reactionId: "rxn-1", postId: "blog-post-1", actorParticipantId: AUTHOR },
    { _id: "rxn-2", reactionId: "rxn-2", postId: "blog-post-2", actorParticipantId: AUTHOR },
  ]);
  source.seed("blog_reactions", dest.store.get("blog_reactions")!);

  dest.seed("blog_capability_grants", [
    { _id: AUTHOR, participantId: AUTHOR },
    { _id: "p2", participantId: "p2" },
    { _id: "p3", participantId: "p3" },
  ]);
  source.seed("blog_capability_grants", dest.store.get("blog_capability_grants")!);

  dest.seed("blog_author_applications", [
    { _id: "app-1", applicationId: "app-1", participantId: AUTHOR },
    { _id: "app-2", applicationId: "app-2", participantId: "p2" },
    { _id: "app-3", applicationId: "app-3", participantId: "p3" },
  ]);
  source.seed("blog_author_applications", dest.store.get("blog_author_applications")!);

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

  for (const memberId of [AUTHOR, "p2", "p3"]) {
    const members = dest.store.get("members") ?? [];
    members.push({ _id: memberId, memberId });
    dest.store.set("members", members);
  }

  await runStore.createPlanned({ migrationId: MIGRATION_ID, expectedStorageKeys: keys });
  await runStore.update({
    migrationId: MIGRATION_ID,
    patch: {
      status: input?.runStatus ?? "recovery_required",
      mongoTransactionStatus: input?.mongoCommitted === false ? "aborted" : "committed",
      verificationStatus: "fail",
      phaseReached: "P11_verification",
      blockers: ["Canonical media URLs must use production media base"],
      createdStorageKeys: keys,
      preCopyAbsentKeys: keys,
      equivalentSkippedKeys: [],
    },
  });

  if (!input?.skipMediaRecovery) {
    for (const key of keys) {
      const body = Buffer.from(`blog-media-body-${keys.indexOf(key)}`);
      await durable.upsertPlanned({
        migrationExecutionId: MIGRATION_ID,
        storageKey: key,
        destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${key}`,
        expectedContentSha256: sha256Hex(body),
        expectedContentLength: body.byteLength,
        expectedContentType: "image/png",
        preCopyDestinationState: "ABSENT",
      });
      await durable.markCreatedVerified(MIGRATION_ID, key);
    }
  }

  return { source, dest, media, durable, runStore, keys };
}

function transactionalClient(dest: MemoryDb): MongoClient {
  return {
    startSession: () => {
      let snapshot: Map<string, MemDoc[]> | null = null;
      const session = {
        async withTransaction(fn: () => Promise<void>) {
          snapshot = dest.cloneStore();
          try {
            await fn();
          } catch (error) {
            if (snapshot) dest.restoreStore(snapshot);
            throw error;
          }
        },
        async endSession() {},
      };
      return session;
    },
  } as unknown as MongoClient;
}

function stubClient(): MongoClient {
  return {
    startSession: () => {
      throw new Error("session unused under forceNonTransactional");
    },
  } as unknown as MongoClient;
}

async function runRecovery(input: {
  source: MemoryDb;
  dest: MemoryDb;
  media: InMemoryBlogR2CopyExecutor;
  durable: InMemoryBlogDurableMediaRecoveryStore;
  runStore: InMemoryBlogRunRecoveryStore;
  execute: boolean;
  confirm?: string;
  migrationExecutionId?: string;
  forceNonTransactional?: boolean;
  useTransactionalClient?: boolean;
  simulateFailureAfterUpdates?: number;
  mutationCounters?: {
    emailSends?: number;
    outboxWrites?: number;
    subscriberChanges?: number;
    deliveryChanges?: number;
  };
}) {
  const destinationClient = input.useTransactionalClient
    ? transactionalClient(input.dest)
    : stubClient();
  return runBlogMediaUrlRecovery({
    handles: {
      sourceClient: stubClient(),
      sourceDb: input.source.asDb(),
      sourceDatabase: "hu_test_blog_src",
      destinationClient,
      destinationDb: input.dest.asDb(),
      destinationDatabase: "hu_test_blog_dst",
    },
    migrationExecutionId: input.migrationExecutionId ?? MIGRATION_ID,
    execute: input.execute,
    confirm: input.confirm,
    allowTestIsolation: true,
    forceNonTransactional: input.useTransactionalClient
      ? false
      : (input.forceNonTransactional ?? true),
    durableMediaRecoveryStore: input.durable,
    runRecoveryStore: input.runStore,
    mediaExecutor: input.media,
    simulateFailureAfterUpdates: input.simulateFailureAfterUpdates,
    mutationCounters: input.mutationCounters,
  });
}

describe("Production Blog media URL recovery — Task 04.4", () => {
  it("mode gate: dry-run default; dedicated CONFIRM required", () => {
    assert.equal(resolveBlogMediaUrlRecoveryMode({ execute: true, confirm: "NO" }), "dry-run");
    assert.equal(
      resolveBlogMediaUrlRecoveryMode({
        execute: true,
        confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
      }),
      "execute",
    );
  });

  it("assessOwnedMediaUrlRepair: r2.dev -> media.huws.org; mismatch/unknown rejected", () => {
    const key = "blog/media-0.png";
    const ok = assessOwnedMediaUrlRepair(`${R2_HOST}/${key}`, key);
    assert.equal(ok.action, "repair");
    assert.equal(ok.to, productionUrl(0));
    assert.equal(ok.blocker, undefined);

    const already = assessOwnedMediaUrlRepair(productionUrl(0), key);
    assert.equal(already.action, "no-op");

    const mismatch = assessOwnedMediaUrlRepair(`${R2_HOST}/blog/other.png`, key);
    assert.ok(mismatch.blocker);

    const unknown = assessOwnedMediaUrlRepair("https://evil.example/x.png", key);
    assert.ok(unknown.blocker);
  });

  it("dry-run: zero mutations; plans r2.dev repairs; preserves i0.wp.com", async () => {
    const seeded = await seedCommittedBrokenDestination();
    const beforePosts = JSON.stringify(seeded.dest.store.get("blog_posts"));
    const beforeMedia = JSON.stringify(seeded.dest.store.get("media_upload_records"));
    const putBefore = seeded.media.getWriteCount();
    const delBefore = seeded.media.getDeleteCount();

    const report = await runRecovery({
      ...seeded,
      execute: false,
    });

    assert.equal(report.mode, "dry-run");
    assert.equal(report.overallStatus, "DRY_RUN_OK");
    assert.equal(report.mutationProof.r2Put, putBefore);
    assert.equal(report.mutationProof.r2Delete, delBefore);
    assert.equal(report.mutationProof.mongoUrlUpdates, 0);
    assert.equal(report.mutationProof.emailSends, 0);
    assert.equal(report.mutationProof.outboxWrites, 0);
    assert.equal(report.mutationProof.subscriberChanges, 0);
    assert.equal(report.mutationProof.deliveryChanges, 0);
    assert.ok(report.repairCounts.planned > 0);
    assert.ok(
      report.plannedRepairs.some(
        (r) =>
          r.action === "repair" &&
          r.from?.includes("r2.dev") &&
          r.to?.startsWith(PRODUCTION_MEDIA_PUBLIC_BASE_URL),
      ),
    );
    assert.ok(
      report.plannedRepairs.some((r) => r.action === "preserve" && r.from === "i0.wp.com"),
    );
    assert.equal(JSON.stringify(seeded.dest.store.get("blog_posts")), beforePosts);
    assert.equal(JSON.stringify(seeded.dest.store.get("media_upload_records")), beforeMedia);
    assert.equal(seeded.dest.store.get("blog_subscribers")!.length, 17);
    assert.equal(seeded.dest.store.get("blog_publication_deliveries")!.length, 18);
  });

  it("missing/uncommitted migration run rejected", async () => {
    const seeded = await seedCommittedBrokenDestination({ mongoCommitted: false });
    const report = await runRecovery({
      ...seeded,
      execute: false,
    });
    assert.equal(report.overallStatus, "BLOCKED");
    assert.ok(report.blockers.some((b) => /committed/i.test(b)));

    const missing = await runRecovery({
      source: seeded.source,
      dest: seeded.dest,
      media: seeded.media,
      durable: new InMemoryBlogDurableMediaRecoveryStore(),
      runStore: new InMemoryBlogRunRecoveryStore(),
      execute: false,
      migrationExecutionId: "mig_unknown-run-id",
    });
    assert.equal(missing.overallStatus, "BLOCKED");
  });

  it("execute repairs r2.dev -> media.huws.org; verifier PASS; no side effects", async () => {
    const seeded = await seedCommittedBrokenDestination();
    const report = await runRecovery({
      ...seeded,
      execute: true,
      confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
    });

    assert.equal(report.overallStatus, "REPAIRED");
    assert.equal(report.recoveryMarked, true);
    assert.equal(report.postExecuteVerification?.overallVerdict, "PASS");
    assert.equal(report.postExecuteVerification?.media.productionBaseUrlOk, true);
    assert.equal(report.postExecuteVerification?.media.r2Equivalent, 14);
    assert.equal(report.postExecuteVerification?.posts.externalHttpsPreserveIntact, true);
    assert.equal(report.mutationProof.r2Put, 0);
    assert.equal(report.mutationProof.r2Delete, 0);
    assert.equal(report.mutationProof.emailSends, 0);
    assert.equal(report.mutationProof.outboxWrites, 0);
    assert.equal(report.mutationProof.subscriberChanges, 0);
    assert.equal(report.mutationProof.deliveryChanges, 0);
    assert.equal(report.ownership.storageKeyCount, EXPECTED_BLOG_MIGRATION_MEDIA_OBJECT_COUNT);

    const media0 = seeded.dest.store.get("media_upload_records")![0]!;
    assert.equal(media0.mediaUrl, productionUrl(0));
    const post0 = seeded.dest.store.get("blog_posts")![0]!;
    assert.equal(
      (post0.coverMedia as { mediaUrl: string }).mediaUrl,
      productionUrl(0),
    );
    assert.match(String(post0.content), /i0\.wp\.com/);
    assert.match(String(post0.content), new RegExp(PRODUCTION_MEDIA_PUBLIC_BASE_URL));
    assert.equal((await seeded.runStore.get(MIGRATION_ID))?.status, "verified");
    assert.equal((await seeded.runStore.get(MIGRATION_ID))?.verificationStatus, "pass");
  });

  it("already-correct URLs succeed as no-op", async () => {
    const seeded = await seedCommittedBrokenDestination({
      mediaUrlOverride: productionUrl,
    });
    const before = JSON.stringify(seeded.dest.store.get("media_upload_records"));
    const report = await runRecovery({
      ...seeded,
      execute: true,
      confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
    });
    assert.equal(report.overallStatus, "NO_OP");
    assert.equal(report.repairCounts.planned, 0);
    assert.equal(report.mutationProof.mongoUrlUpdates, 0);
    assert.equal(JSON.stringify(seeded.dest.store.get("media_upload_records")), before);
    assert.equal(report.postExecuteVerification?.overallVerdict, "PASS");
  });

  it("storageKey mismatch / unknown URL rejected (fail closed)", async () => {
    const seeded = await seedCommittedBrokenDestination();
    const rows = seeded.dest.store.get("media_upload_records")!;
    rows[0]!.mediaUrl = `${R2_HOST}/blog/totally-other.png`;
    seeded.dest.store.set("media_upload_records", rows);

    const report = await runRecovery({
      ...seeded,
      execute: true,
      confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
    });
    assert.ok(report.overallStatus === "BLOCKED" || report.overallStatus === "FAILED");
    assert.ok(report.blockers.length > 0);
    assert.equal(report.recoveryMarked, false);
  });

  it("transaction failure is atomic — no partial repair", async () => {
    const seeded = await seedCommittedBrokenDestination();
    const beforeMedia = JSON.stringify(seeded.dest.store.get("media_upload_records"));
    const beforePosts = JSON.stringify(seeded.dest.store.get("blog_posts"));

    const report = await runRecovery({
      ...seeded,
      execute: true,
      confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
      useTransactionalClient: true,
      simulateFailureAfterUpdates: 1,
    });

    assert.equal(report.overallStatus, "FAILED");
    assert.ok(report.blockers.some((b) => /Simulated recovery transaction failure/i.test(b)));
    assert.equal(JSON.stringify(seeded.dest.store.get("media_upload_records")), beforeMedia);
    assert.equal(JSON.stringify(seeded.dest.store.get("blog_posts")), beforePosts);
    assert.equal(report.recoveryMarked, false);
  });

  it("refuses forbidden side-effect counters", async () => {
    const seeded = await seedCommittedBrokenDestination({
      mediaUrlOverride: productionUrl,
    });
    const report = await runRecovery({
      ...seeded,
      execute: true,
      confirm: PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
      mutationCounters: { emailSends: 1 },
    });
    assert.ok(report.blockers.some((b) => /side-effect/i.test(b)));
  });

  it("missing ownership set fails closed", async () => {
    const seeded = await seedCommittedBrokenDestination({ skipMediaRecovery: true });
    const report = await runRecovery({
      ...seeded,
      execute: false,
    });
    assert.equal(report.overallStatus, "BLOCKED");
    assert.ok(report.blockers.some((b) => /owned media recovery records/i.test(b)));
  });
});
