import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALLOWED_WRITE_COLLECTIONS,
  CRASH_SAFE_EXECUTION_ORDER,
  MEDIA_COPY_ENABLED_VALUE,
  MEDIA_RECOVERY_COLLECTION,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionInitiativeMigrationError,
  DeferredMediaCopyExecutor,
  InMemoryDurableMediaRecoveryStore,
  InMemoryMediaCopyExecutor,
  InMemoryMediaRecoveryJournal,
  MigrationOwnershipLedger,
  R2_MIGRATION_OWNERSHIP_MARKER,
  R2_MIGRATION_OWNERSHIP_METADATA_KEYS,
  assertMediaCopyAuthorized,
  buildMigrationOwnershipMetadata,
  buildThirtyOneToThirteenMediaFixture,
  deduplicateMediaPlanItems,
  executeMediaCopyPhase,
  inspectMediaRecoveryState,
  isObjectIntegrityEquivalent,
  reconcileMediaPlanReferences,
  resolveMediaCopyAuthorization,
  rollbackMigrationOwnedMedia,
  rewritePublicMediaUrl,
  sanitizeInitiativeDocumentForMigration,
  sha256Hex,
  summarizeMediaPlan,
} from "../../../src/modules/production-initiative-migration/index.js";
import type { MediaPlanItem } from "../../../src/modules/production-initiative-migration/types.js";

function publicRef(storageKey: string, extras: Partial<MediaPlanItem> = {}): MediaPlanItem {
  return {
    sourceStorageKey: storageKey,
    publicPrivate: "public",
    owningInitiativeId: "initiative-1783748417899",
    mediaUploadRecordPresent: true,
    sourceUrlHost: "media-staging.huws.org",
    hostClassification: "staging_r2",
    destinationAction: "COPY_PUBLIC",
    urlRewriteRequired: true,
    sourceCollection: "media_upload_records",
    recordId: `r-${storageKey}`,
    ownerIsSystemMediaRecovery: false,
    ...extras,
  };
}

function plannedCopy(storageKey: string) {
  return {
    storageKey,
    destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey}`,
    publicPrivate: "public" as const,
    owningInitiativeId: null,
    sourceCollections: ["media_upload_records"],
    destinationAction: "COPY_PUBLIC" as const,
  };
}

describe("Production Initiative migration media copy — Task 07.3 / 07.3.1 / 07.3.3 / 07.3.4", () => {
  it("documents crash-safe execution order A>B>E1>C>D>E2>F", () => {
    assert.deepEqual([...CRASH_SAFE_EXECUTION_ORDER], [
      "A_identity",
      "B_membership",
      "E1_r2_copy_verify",
      "C_initiative_roots",
      "D_civic_artifacts",
      "E2_media_upload_records",
      "F_projections",
    ]);
    assert.ok(ALLOWED_WRITE_COLLECTIONS.includes(MEDIA_RECOVERY_COLLECTION));
  });

  it("reconciles 31 COPY_PUBLIC references to 13 unique objects with shared destination URL", () => {
    const items = buildThirtyOneToThirteenMediaFixture();
    assert.equal(items.length, 31);
    assert.equal(summarizeMediaPlan(items).copyPublic, 31);
    const reconciled = reconcileMediaPlanReferences(items);
    assert.equal(reconciled.copyPublicReferenceCount, 31);
    assert.equal(reconciled.uniquePublicObjectCount, 13);
    assert.equal(deduplicateMediaPlanItems(items).length, 13);
  });

  it("deduplicates duplicate references to the same storageKey", () => {
    const items = [
      publicRef("initiatives/a.png", { sourceCollection: "initiatives", recordId: "i1" }),
      publicRef("initiatives/a.png", { sourceCollection: "media_upload_records", recordId: "m1" }),
    ];
    assert.equal(reconcileMediaPlanReferences(items).uniquePublicObjectCount, 1);
  });

  it("hard-fails incompatible same-key collapse", () => {
    const items: MediaPlanItem[] = [
      publicRef("initiatives/clash.png"),
      {
        ...publicRef("initiatives/clash.png"),
        publicPrivate: "private",
        destinationAction: "COPY_PRIVATE",
        sourceCollection: "shared_documents",
      },
    ];
    assert.throws(
      () => reconcileMediaPlanReferences(items),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  });

  it("does not rewrite Mongo initiative media URLs before E1 verification", () => {
    const doc = {
      initiativeId: "initiative-1783748417899",
      metadata: {
        imageUrl: "https://media-staging.huws.org/initiatives/cover.png",
      },
    };
    const beforeE1 = sanitizeInitiativeDocumentForMigration(doc, PRODUCTION_MEDIA_PUBLIC_BASE_URL, {
      rewritePublicMediaUrls: false,
    });
    assert.equal(
      (beforeE1.metadata as { imageUrl: string }).imageUrl,
      "https://media-staging.huws.org/initiatives/cover.png",
    );
  });

  it("A: PLANNED then die before R2 write → recovery sees object absent safely", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("never-written");
    executor.seedSource("initiatives/a.png", body);
    const prepared = await executor.prepareSourceObject("initiatives/a.png");
    await store.upsertPlanned({
      migrationExecutionId: "mig_a",
      storageKey: "initiatives/a.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/a.png`,
      expectedContentSha256: prepared.checksumSHA256,
      expectedContentLength: prepared.contentLength,
      expectedContentType: prepared.contentType,
    });
    const report = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_a",
    });
    assert.equal(report.rows[0]?.classification, "object_absent");
    assert.equal(report.rows[0]?.rollbackEligible, false);
    assert.equal(report.rows[0]?.ownershipProven, false);
  });

  it("B: crash after Put with ownership metadata → owned_created_recovered / rollback eligible", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("put-ok");
    executor.seedSource("initiatives/b.png", body);
    const prepared = await executor.prepareSourceObject("initiatives/b.png");
    await store.upsertPlanned({
      migrationExecutionId: "mig_b",
      storageKey: "initiatives/b.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/b.png`,
      expectedContentSha256: prepared.checksumSHA256,
      expectedContentLength: prepared.contentLength,
      expectedContentType: prepared.contentType,
    });
    await store.markCopying("mig_b", "initiatives/b.png");
    await executor.copyPublicObject({
      storageKey: "initiatives/b.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/b.png`,
      preparedSource: prepared,
      migrationExecutionId: "mig_b",
    });
    const dest = executor.destination.get("initiatives/b.png");
    assert.equal(
      dest?.metadata[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId],
      "mig_b",
    );
    assert.equal(
      dest?.metadata[R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker],
      R2_MIGRATION_OWNERSHIP_MARKER,
    );

    const report = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_b",
    });
    assert.equal(report.rows[0]?.durableStatus, "copying");
    assert.equal(report.rows[0]?.classification, "owned_created_recovered");
    assert.equal(report.rows[0]?.rollbackEligible, true);
    assert.equal(report.rows[0]?.ownershipProven, true);
    assert.equal(report.rows[0]?.observedContentSha256, sha256Hex(body));
  });

  it("equivalent object with no migration metadata is NOT rollback eligible", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("equiv-no-meta");
    executor.seedSource("initiatives/u.png", body);
    executor.seedDestination("initiatives/u.png", Buffer.from("equiv-no-meta"));
    const prepared = await executor.prepareSourceObject("initiatives/u.png");
    await store.upsertPlanned({
      migrationExecutionId: "mig_u",
      storageKey: "initiatives/u.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/u.png`,
      expectedContentSha256: prepared.checksumSHA256,
      expectedContentLength: prepared.contentLength,
      expectedContentType: prepared.contentType,
    });
    await store.markCopying("mig_u", "initiatives/u.png");

    const report = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_u",
    });
    assert.equal(report.rows[0]?.classification, "equivalent_ownership_unproven");
    assert.equal(report.rows[0]?.rollbackEligible, false);
    assert.equal(report.rows[0]?.ownershipProven, false);

    const rolled = await rollbackMigrationOwnedMedia({
      store,
      executor,
      migrationExecutionId: "mig_u",
      confirm: "YES",
    });
    assert.equal(rolled.deleted, 0);
    assert.ok(executor.destination.has("initiatives/u.png"));
  });

  it("equivalent object owned by another migrationExecutionId is NOT overwritten or deleted", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("foreign-owned");
    executor.seedSource("initiatives/f.png", body);
    executor.seedDestination(
      "initiatives/f.png",
      Buffer.from("foreign-owned"),
      "image/png",
      buildMigrationOwnershipMetadata("mig_other"),
    );
    const store = new InMemoryDurableMediaRecoveryStore();
    const result = await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/f.png")],
      ledger: new MigrationOwnershipLedger("mig_f"),
      executor,
      performCopies: true,
      durableRecoveryStore: store,
    });
    assert.equal(result.alreadyEquivalentCount, 1);
    assert.equal(executor.writeCount, 0);
    assert.equal(
      executor.destination.get("initiatives/f.png")?.metadata[
        R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId
      ],
      "mig_other",
    );

    const prepared = await executor.prepareSourceObject("initiatives/f.png");
    const crashStore = new InMemoryDurableMediaRecoveryStore();
    await crashStore.upsertPlanned({
      migrationExecutionId: "mig_f2",
      storageKey: "initiatives/f.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/f.png`,
      expectedContentSha256: prepared.checksumSHA256,
      expectedContentLength: prepared.contentLength,
      expectedContentType: prepared.contentType,
    });
    const report = await inspectMediaRecoveryState({
      store: crashStore,
      executor,
      migrationExecutionId: "mig_f2",
    });
    assert.equal(report.rows[0]?.classification, "foreign_migration_object");
    assert.equal(report.rows[0]?.rollbackEligible, false);

    await assert.rejects(
      () => executor.deleteOwnedObject("initiatives/f.png", "mig_f2"),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_OWNERSHIP_UNPROVEN",
    );
    assert.ok(executor.destination.has("initiatives/f.png"));
  });

  it("C: pre-existing equivalent → PREEXISTING_EQUIVALENT never rollback-owned", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("same-bytes");
    executor.seedSource("initiatives/eq.png", body);
    executor.seedDestination("initiatives/eq.png", Buffer.from("same-bytes"));
    const ledger = new MigrationOwnershipLedger("mig_eq");
    const store = new InMemoryDurableMediaRecoveryStore();
    const result = await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/eq.png")],
      ledger,
      executor,
      performCopies: true,
      durableRecoveryStore: store,
    });
    assert.equal(result.alreadyEquivalentCount, 1);
    assert.equal(ledger.rollbackEligibleMediaKeys().length, 0);
    const rec = await store.get("mig_eq", "initiatives/eq.png");
    assert.equal(rec?.status, "preexisting_equivalent");
    assert.deepEqual(executor.destination.get("initiatives/eq.png")?.metadata, {});
  });

  it("D: created_verified with ownership metadata → rollback eligible; re-verifies before delete", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("owned");
    executor.seedSource("initiatives/d.png", body);
    const ledger = new MigrationOwnershipLedger("mig_d");
    const store = new InMemoryDurableMediaRecoveryStore();
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/d.png")],
      ledger,
      executor,
      performCopies: true,
      durableRecoveryStore: store,
    });
    assert.deepEqual(ledger.rollbackEligibleMediaKeys(), ["initiatives/d.png"]);
    const rec = await store.get("mig_d", "initiatives/d.png");
    assert.equal(rec?.status, "created_verified");
    assert.equal(
      executor.destination.get("initiatives/d.png")?.metadata[
        R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId
      ],
      "mig_d",
    );

    const inspection = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_d",
    });
    assert.equal(inspection.rows[0]?.classification, "owned_created_verified");
    assert.equal(inspection.rows[0]?.rollbackEligible, true);
    assert.equal(inspection.rows[0]?.ownershipProven, true);

    const rolled = await rollbackMigrationOwnedMedia({
      store,
      executor,
      migrationExecutionId: "mig_d",
      confirm: "YES",
    });
    assert.equal(rolled.deleted, 1);
    assert.equal((await store.get("mig_d", "initiatives/d.png"))?.status, "rollback_deleted");
  });

  it("created_verified but ownership metadata later absent → rollback fails closed", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/lost.png", Buffer.from("lost-meta"));
    const store = new InMemoryDurableMediaRecoveryStore();
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/lost.png")],
      ledger: new MigrationOwnershipLedger("mig_lost"),
      executor,
      performCopies: true,
      durableRecoveryStore: store,
    });
    const dest = executor.destination.get("initiatives/lost.png");
    assert.ok(dest);
    dest.metadata = {};

    const inspection = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_lost",
    });
    assert.equal(inspection.rows[0]?.classification, "equivalent_ownership_unproven");
    assert.equal(inspection.rows[0]?.rollbackEligible, false);

    const rolled = await rollbackMigrationOwnedMedia({
      store,
      executor,
      migrationExecutionId: "mig_lost",
      confirm: "YES",
    });
    assert.equal(rolled.deleted, 0);
    assert.ok(executor.destination.has("initiatives/lost.png"));
  });

  it("SHA mismatch still fails closed", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("expected");
    executor.seedSource("initiatives/mm.png", body);
    executor.seedDestination("initiatives/mm.png", Buffer.from("different!!"));
    const prepared = await executor.prepareSourceObject("initiatives/mm.png");
    await store.upsertPlanned({
      migrationExecutionId: "mig_mm",
      storageKey: "initiatives/mm.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/mm.png`,
      expectedContentSha256: prepared.checksumSHA256,
      expectedContentLength: prepared.contentLength,
      expectedContentType: prepared.contentType,
    });
    const report = await inspectMediaRecoveryState({
      store,
      executor,
      migrationExecutionId: "mig_mm",
    });
    assert.equal(report.rows[0]?.classification, "integrity_mismatch");
    assert.equal(report.rows[0]?.rollbackEligible, false);
  });

  it("E: ephemeral JSONL unavailable → durable Mongo recovery still works", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/e.png", Buffer.from("durable-only"));
    const ledger = new MigrationOwnershipLedger("mig_e");
    const store = new InMemoryDurableMediaRecoveryStore();
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/e.png")],
      ledger,
      executor,
      performCopies: true,
      durableRecoveryStore: store,
      recoveryJournal: null,
    });
    assert.equal((await store.get("mig_e", "initiatives/e.png"))?.status, "created_verified");
  });

  it("F: dry-run → zero durable recovery writes and no ownership metadata Put", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/dry.png", Buffer.from("x"));
    const ledger = new MigrationOwnershipLedger("mig_dry");
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/dry.png")],
      ledger,
      executor: new DeferredMediaCopyExecutor(),
      performCopies: false,
      durableRecoveryStore: store,
    });
    assert.equal(store.writeCount, 0);
    assert.equal(executor.writeCount, 0);
    assert.equal(executor.destination.size, 0);
    assert.equal((await store.listByExecutionId("mig_dry")).length, 0);
  });

  it("G: credentials / private data never appear in recovery records or reports", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    await store.upsertPlanned({
      migrationExecutionId: "mig_g",
      storageKey: "initiatives/g.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/g.png`,
      expectedContentSha256: sha256Hex(Buffer.from("g")),
      expectedContentLength: 1,
      expectedContentType: "image/png",
    });
    const text = JSON.stringify(await store.listByExecutionId("mig_g"));
    assert.doesNotMatch(text, /SECRET|ACCESS_KEY|shippingAddress|password/i);
    const meta = JSON.stringify(buildMigrationOwnershipMetadata("mig_g"));
    assert.doesNotMatch(meta, /SECRET|ACCESS_KEY|shippingAddress|password|participant/i);
  });

  it("ETag alone is insufficient for equivalence", () => {
    assert.equal(
      isObjectIntegrityEquivalent(
        {
          contentLength: 10,
          etag: "same-etag",
          contentType: "image/png",
          checksumSHA256: null,
        },
        {
          contentLength: 10,
          etag: "same-etag",
          contentType: "image/png",
          checksumSHA256: null,
        },
      ),
      false,
    );
  });

  it("destination collision SHA mismatch fails closed on execute", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/bad.png", Buffer.from("source"));
    executor.seedDestination("initiatives/bad.png", Buffer.from("other!!"));
    const ledger = new MigrationOwnershipLedger("mig_sha");
    const store = new InMemoryDurableMediaRecoveryStore();
    await assert.rejects(
      () =>
        executeMediaCopyPhase({
          planned: [plannedCopy("initiatives/bad.png")],
          ledger,
          executor,
          performCopies: true,
          durableRecoveryStore: store,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_DESTINATION_COLLISION",
    );
  });

  it("missing source fails closed", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const ledger = new MigrationOwnershipLedger("mig_miss");
    const store = new InMemoryDurableMediaRecoveryStore();
    await assert.rejects(
      () =>
        executeMediaCopyPhase({
          planned: [plannedCopy("missing.png")],
          ledger,
          executor,
          performCopies: true,
          durableRecoveryStore: store,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_SOURCE_MISSING",
    );
  });

  it("partial failure durable ownership only includes successfully created objects", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/one.png", Buffer.from("one"));
    const ledger = new MigrationOwnershipLedger("mig_partial");
    const store = new InMemoryDurableMediaRecoveryStore();
    await assert.rejects(() =>
      executeMediaCopyPhase({
        planned: [plannedCopy("initiatives/one.png"), plannedCopy("initiatives/two.png")],
        ledger,
        executor,
        performCopies: true,
        durableRecoveryStore: store,
      }),
    );
    assert.equal((await store.get("mig_partial", "initiatives/one.png"))?.status, "created_verified");
    assert.equal(await store.get("mig_partial", "initiatives/two.png"), null);
  });

  it("rollback requires explicit confirm and never auto-deletes on inspection", async () => {
    const store = new InMemoryDurableMediaRecoveryStore();
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/r.png", Buffer.from("r"));
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/r.png")],
      ledger: new MigrationOwnershipLedger("mig_r"),
      executor,
      performCopies: true,
      durableRecoveryStore: store,
    });
    await assert.rejects(
      () =>
        rollbackMigrationOwnedMedia({
          store,
          executor,
          migrationExecutionId: "mig_r",
          confirm: "NO",
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_CONFIRMATION",
    );
    assert.ok(executor.destination.has("initiatives/r.png"));
  });

  it("production confirmation gate: performMediaCopies alone is insufficient", () => {
    assert.equal(
      resolveMediaCopyAuthorization({
        mode: "execute",
        confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
        performMediaCopies: true,
        mediaCopyEnvValue: "NO",
      }).authorized,
      false,
    );
    assert.throws(
      () =>
        assertMediaCopyAuthorized({
          mode: "dry-run",
          confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
          performMediaCopies: true,
          mediaCopyEnvValue: MEDIA_COPY_ENABLED_VALUE,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_COPY_NOT_AUTHORIZED",
    );
  });

  it("canonical https://media.huws.org rewrite", () => {
    assert.equal(
      rewritePublicMediaUrl("https://media-staging.huws.org/initiatives/x.png"),
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/x.png`,
    );
  });

  it("optional JSONL mirror may still record without being required", async () => {
    const journal = new InMemoryMediaRecoveryJournal();
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/j.png", Buffer.from("j"));
    await executeMediaCopyPhase({
      planned: [plannedCopy("initiatives/j.png")],
      ledger: new MigrationOwnershipLedger("mig_j"),
      executor,
      performCopies: true,
      durableRecoveryStore: new InMemoryDurableMediaRecoveryStore(),
      recoveryJournal: journal,
    });
    assert.equal((await journal.listCreated("mig_j")).length, 1);
  });
});
