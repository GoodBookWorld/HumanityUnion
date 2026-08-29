import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID,
  InMemoryDurableMediaRecoveryStore,
  InMemoryMediaCopyExecutor,
  MEDIA_RECOVERY_COLLECTION,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionInitiativeMigrationError,
  R2_MIGRATION_OWNERSHIP_MARKER,
  R2_MIGRATION_OWNERSHIP_METADATA_KEYS,
  VLAD_SHAPRAN_USER_ID,
  assertRecoveryRollbackReconcileWriteCollection,
  assertValidMigrationExecutionId,
  reconcileProductionInitiativeMigrationRecoveryRollbackState,
  runFailedExecutionResidualAudit,
} from "../../../src/modules/production-initiative-migration/index.js";

type MemDoc = Document & { _id?: string };

const FAILED_EXEC = FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID;
const VLAD_PROFILE_ID = APPROVED_PRODUCTION_PARTICIPANTS[0]!.profileId;

function getPath(doc: MemDoc, path: string): unknown {
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, doc);
}

function matchesFilter(doc: MemDoc, filter: Document): boolean {
  if (filter.$or && Array.isArray(filter.$or)) {
    return (filter.$or as Document[]).some((part) => matchesFilter(doc, part));
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$or") continue;
    const actual = getPath(doc, key);
    if (value && typeof value === "object" && !Array.isArray(value) && "$in" in (value as object)) {
      const list = (value as { $in: unknown[] }).$in;
      if (!list.some((candidate) => String(candidate) === String(actual))) return false;
      continue;
    }
    if (String(actual) !== String(value)) return false;
  }
  return true;
}

class MemoryCursor {
  constructor(private readonly docs: MemDoc[]) {}
  project(_p: Document) {
    return this;
  }
  limit(n: number) {
    return new MemoryCursor(this.docs.slice(0, n));
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
  find(filter: Document) {
    return new MemoryCursor(this.rows().filter((doc) => matchesFilter(doc, filter)));
  }
  async countDocuments(filter: Document = {}) {
    return this.rows().filter((doc) => matchesFilter(doc, filter)).length;
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

function seedSourceMediaPlan(source: MemoryDb, media: InMemoryMediaCopyExecutor): string[] {
  const keys: string[] = [];
  const mediaDocs: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS; i += 1) {
    const storageKey = `initiatives/reconcile-${i}.png`;
    keys.push(storageKey);
    media.seedSource(storageKey, Buffer.from(`reconcile-media-${i}`));
    const initiativeId =
      CANONICAL_PRODUCTION_INITIATIVE_IDS[i % CANONICAL_PRODUCTION_INITIATIVE_IDS.length]!;
    mediaDocs.push({
      _id: `media-${i}`,
      mediaId: `media-${i}`,
      storageKey,
      mediaUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey}`,
      purpose: "initiative-image",
      initiativeId,
      ownerParticipantId: "system-media-recovery",
      visibility: "public",
    });
  }
  source.seed(
    "initiatives",
    CANONICAL_PRODUCTION_INITIATIVE_IDS.map((initiativeId) => ({
      _id: initiativeId,
      initiativeId,
      title: initiativeId,
    })),
  );
  source.seed("media_upload_records", mediaDocs);
  source.seed("shared_documents", []);
  source.seed("member_profiles", [
    {
      _id: VLAD_PROFILE_ID,
      profileId: VLAD_PROFILE_ID,
      userId: VLAD_SHAPRAN_USER_ID,
      membershipPubliclyVisible: false,
    },
  ]);
  return keys;
}

async function seedStaleRecovery(
  store: InMemoryDurableMediaRecoveryStore,
  keys: string[],
  status: "created_verified" | "rollback_deleted" | "preexisting_equivalent" | "rollback_failed" =
    "created_verified",
): Promise<void> {
  for (const storageKey of keys) {
    await store.upsertPlanned({
      migrationExecutionId: FAILED_EXEC,
      storageKey,
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey}`,
      expectedContentSha256: "a".repeat(64),
      expectedContentLength: 10,
      expectedContentType: "image/png",
    });
    if (status === "created_verified") {
      await store.markCopying(FAILED_EXEC, storageKey);
      await store.markCreatedVerified(FAILED_EXEC, storageKey);
    } else if (status === "rollback_failed") {
      await store.markCopying(FAILED_EXEC, storageKey);
      await store.markCreatedVerified(FAILED_EXEC, storageKey);
      await store.markRollbackFailed(FAILED_EXEC, storageKey);
    } else if (status === "rollback_deleted") {
      await store.markCopying(FAILED_EXEC, storageKey);
      await store.markCreatedVerified(FAILED_EXEC, storageKey);
      await store.markRollbackDeleted(FAILED_EXEC, storageKey);
    } else {
      await store.markPreexistingEquivalent(FAILED_EXEC, storageKey);
    }
  }
}

describe("Recovery rollback-state reconciler — Task 07.7.9", () => {
  it("created_verified + R2 absent → dry-run would reconcile", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const keys = ["initiatives/a.png", "initiatives/b.png"];
    for (const key of keys) media.seedSource(key, Buffer.from(key));
    await seedStaleRecovery(store, keys, "created_verified");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      durableRecoveryStore: store,
    });
    assert.equal(report.verdict, "DRY_RUN_READY");
    assert.equal(report.rowsScanned, 2);
    assert.equal(report.absentCreatedVerified, 2);
    assert.equal(report.presentBlocked, 0);
    assert.equal(report.rowsUpdated, 0);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.ok(report.rows.every((r) => r.action === "would_mark_rollback_deleted"));
  });

  it("execute updates only recovery status to rollback_deleted", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const keys = ["initiatives/a.png"];
    media.seedSource(keys[0]!, Buffer.from("a"));
    await seedStaleRecovery(store, keys, "created_verified");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(report.verdict, "RECONCILED");
    assert.equal(report.rowsUpdated, 1);
    assert.equal((await store.get(FAILED_EXEC, keys[0]!))?.status, "rollback_deleted");
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(media.getDeleteCount(), 0);
    assert.equal(media.getWriteCount(), 0);
  });

  it("created_verified + R2 present → BLOCKED, no write", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const key = "initiatives/present.png";
    media.seedSource(key, Buffer.from("present"));
    media.seedDestination(key, Buffer.from("present"), "image/png", {
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId]: FAILED_EXEC,
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker]: R2_MIGRATION_OWNERSHIP_MARKER,
    });
    await seedStaleRecovery(store, [key], "created_verified");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(report.verdict, "BLOCKED");
    assert.equal(report.presentBlocked, 1);
    assert.equal(report.rowsUpdated, 0);
    assert.equal((await store.get(FAILED_EXEC, key))?.status, "created_verified");
  });

  it("rollback_deleted + absent → no-op", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const key = "initiatives/done.png";
    media.seedSource(key, Buffer.from("done"));
    await seedStaleRecovery(store, [key], "rollback_deleted");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(report.verdict, "RECONCILED");
    assert.equal(report.alreadyRollbackDeleted, 1);
    assert.equal(report.rowsUpdated, 0);
    assert.equal(report.rows[0]?.action, "already_rollback_deleted");
  });

  it("preexisting_equivalent → untouched", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const key = "initiatives/pe.png";
    media.seedSource(key, Buffer.from("pe"));
    await seedStaleRecovery(store, [key], "preexisting_equivalent");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(report.preexistingEquivalentUntouched, 1);
    assert.equal(report.rowsUpdated, 0);
    assert.equal((await store.get(FAILED_EXEC, key))?.status, "preexisting_equivalent");
  });

  it("mixed rows → fail closed for unsafe rows (no writes)", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const absent = "initiatives/absent.png";
    const present = "initiatives/still-there.png";
    media.seedSource(absent, Buffer.from("absent"));
    media.seedSource(present, Buffer.from("present"));
    media.seedDestination(present, Buffer.from("present"), "image/png", {
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId]: FAILED_EXEC,
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker]: R2_MIGRATION_OWNERSHIP_MARKER,
    });
    await seedStaleRecovery(store, [absent, present], "created_verified");

    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(report.verdict, "BLOCKED");
    assert.equal(report.rowsUpdated, 0);
    assert.equal((await store.get(FAILED_EXEC, absent))?.status, "created_verified");
    assert.equal((await store.get(FAILED_EXEC, present))?.status, "created_verified");
  });

  it("wrong execution ID → rejected", async () => {
    await assert.rejects(
      () =>
        reconcileProductionInitiativeMigrationRecoveryRollbackState({
          destinationDb: new MemoryDb().asDb(),
          mediaReader: new InMemoryMediaCopyExecutor(),
          migrationExecutionId: "all",
          destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        (error.code === "BROAD_EXECUTION_ID_FORBIDDEN" ||
          error.code === "INVALID_EXECUTION_ID"),
    );
    assert.throws(
      () => assertValidMigrationExecutionId("not-a-mig"),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "INVALID_EXECUTION_ID",
    );
  });

  it("non-production destination → rejected", async () => {
    await assert.rejects(
      () =>
        reconcileProductionInitiativeMigrationRecoveryRollbackState({
          destinationDb: new MemoryDb().asDb(),
          mediaReader: new InMemoryMediaCopyExecutor(),
          migrationExecutionId: FAILED_EXEC,
          destinationDatabase: "humanity_union_staging",
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "WRONG_DESTINATION_DATABASE",
    );
  });

  it("--execute without confirmation → rejected", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    await seedStaleRecovery(store, ["initiatives/x.png"], "created_verified");
    await assert.rejects(
      () =>
        reconcileProductionInitiativeMigrationRecoveryRollbackState({
          destinationDb: new MemoryDb().asDb(),
          mediaReader: new InMemoryMediaCopyExecutor(),
          migrationExecutionId: FAILED_EXEC,
          destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
          execute: true,
          confirm: "NO",
          durableRecoveryStore: store,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_CONFIRMATION",
    );
  });

  it("writes only recovery collection; second execute is idempotent", async () => {
    assert.throws(
      () => assertRecoveryRollbackReconcileWriteCollection("initiatives"),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "RECOVERY_RECONCILE_WRITE_FORBIDDEN",
    );
    assert.doesNotThrow(() =>
      assertRecoveryRollbackReconcileWriteCollection(MEDIA_RECOVERY_COLLECTION),
    );

    const store = new InMemoryDurableMediaRecoveryStore();
    const media = new InMemoryMediaCopyExecutor();
    const key = "initiatives/idem.png";
    media.seedSource(key, Buffer.from("idem"));
    await seedStaleRecovery(store, [key], "created_verified");

    const first = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(first.rowsUpdated, 1);

    const second = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: new MemoryDb().asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(second.verdict, "RECONCILED");
    assert.equal(second.alreadyRollbackDeleted, 1);
    assert.equal(second.rowsUpdated, 0);
    assert.equal(media.getWriteCount(), 0);
    assert.equal(media.getDeleteCount(), 0);
  });

  it("residual auditor before reconcile → INDETERMINATE; after → CLEAN", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    dest.seed("initiatives", []);
    dest.seed("memberships", []);
    dest.seed("membership_contributions", []);
    dest.seed("member_badge_applications", []);
    dest.seed("media_upload_records", []);
    dest.seed("shared_documents", []);
    dest.seed("initiative_analyses", []);
    dest.seed("member_profiles", [
      {
        _id: VLAD_PROFILE_ID,
        profileId: VLAD_PROFILE_ID,
        userId: VLAD_SHAPRAN_USER_ID,
        membershipPubliclyVisible: false,
      },
    ]);

    const store = new InMemoryDurableMediaRecoveryStore();
    await seedStaleRecovery(store, keys, "created_verified");
    // Mirror store into destination collection for residual audit Mongo reads.
    dest.seed(
      MEDIA_RECOVERY_COLLECTION,
      (await store.listByExecutionId(FAILED_EXEC)).map((row, i) => ({
        _id: `rec-${i}`,
        ...row,
      })),
    );

    const before = await runFailedExecutionResidualAudit({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      baselineMembershipPubliclyVisible: false,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        recoveryStoreWrites: 0,
      },
    });
    assert.equal(before.verdict, "AUDIT_INDETERMINATE");

    const reconcile = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: dest.asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      execute: true,
      confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      durableRecoveryStore: store,
    });
    assert.equal(reconcile.verdict, "RECONCILED");
    assert.equal(reconcile.rowsUpdated, EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS);

    dest.seed(
      MEDIA_RECOVERY_COLLECTION,
      (await store.listByExecutionId(FAILED_EXEC)).map((row, i) => ({
        _id: `rec-${i}`,
        ...row,
      })),
    );

    const after = await runFailedExecutionResidualAudit({
      sourceDb: source.asDb(),
      destinationDb: dest.asDb(),
      mediaReader: media,
      migrationExecutionId: FAILED_EXEC,
      baselineMembershipPubliclyVisible: false,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        recoveryStoreWrites: 0,
      },
    });
    assert.equal(after.verdict, "CLEAN_FOR_FRESH_DRY_RUN");
    assert.equal(after.durableRecovery.activeOwnershipClaims, 0);
    assert.equal(media.getWriteCount(), 0);
    assert.equal(media.getDeleteCount(), 0);
  });
});
