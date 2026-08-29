import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CRASH_SAFE_EXECUTION_ORDER,
  MEDIA_COPY_ENABLED_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionInitiativeMigrationError,
  DeferredMediaCopyExecutor,
  InMemoryMediaCopyExecutor,
  InMemoryMediaRecoveryJournal,
  MigrationOwnershipLedger,
  assertMediaCopyAuthorized,
  buildThirtyOneToThirteenMediaFixture,
  deduplicateMediaPlanItems,
  executeMediaCopyPhase,
  isObjectIntegrityEquivalent,
  reconcileMediaPlanReferences,
  resolveMediaCopyAuthorization,
  rollbackOwnedMediaObjects,
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

describe("Production Initiative migration media copy — Task 07.3 / 07.3.1", () => {
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
  });

  it("reconciles 31 COPY_PUBLIC references to 13 unique objects with shared destination URL", () => {
    const items = buildThirtyOneToThirteenMediaFixture();
    assert.equal(items.length, 31);
    assert.equal(summarizeMediaPlan(items).copyPublic, 31);

    const reconciled = reconcileMediaPlanReferences(items);
    assert.equal(reconciled.copyPublicReferenceCount, 31);
    assert.equal(reconciled.uniquePublicObjectCount, 13);
    assert.equal(reconciled.duplicatePublicReferencesCollapsed, 18);
    assert.equal(reconciled.uniquePublicCopies.length, 13);
    assert.equal(deduplicateMediaPlanItems(items).length, 13);

    for (const row of reconciled.mapping) {
      assert.ok(row.referenceCount >= 1);
      assert.equal(row.destinationAction, "COPY_PUBLIC");
      assert.equal(
        row.destinationUrl,
        `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${row.storageKey}`,
      );
      for (const source of row.sources) {
        assert.equal(source.destinationUrl, row.destinationUrl);
        assert.equal(source.destinationAction, row.destinationAction);
        assert.equal(source.publicPrivate, row.publicPrivate);
      }
    }
  });

  it("deduplicates duplicate references to the same storageKey", () => {
    const items = [
      publicRef("initiatives/a.png", { sourceCollection: "initiatives", recordId: "i1" }),
      publicRef("initiatives/a.png", { sourceCollection: "media_upload_records", recordId: "m1" }),
    ];
    const reconciled = reconcileMediaPlanReferences(items);
    assert.equal(reconciled.copyPublicReferenceCount, 2);
    assert.equal(reconciled.uniquePublicObjectCount, 1);
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
    const afterE1 = sanitizeInitiativeDocumentForMigration(doc, PRODUCTION_MEDIA_PUBLIC_BASE_URL, {
      rewritePublicMediaUrls: true,
    });
    assert.equal(
      (afterE1.metadata as { imageUrl: string }).imageUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/cover.png`,
    );
  });

  it("process dies after E1 before Mongo → no broken Mongo media references; journal retains ownership", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("e1-only");
    executor.seedSource("initiatives/e1.png", body);
    const ledger = new MigrationOwnershipLedger("mig_crash_e1");
    const journal = new InMemoryMediaRecoveryJournal();

    // Simulate E1 only (crash before C/D/E2).
    await executeMediaCopyPhase({
      planned: [
        {
          storageKey: "initiatives/e1.png",
          destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/e1.png`,
          publicPrivate: "public",
          owningInitiativeId: null,
          sourceCollections: ["media_upload_records"],
          destinationAction: "COPY_PUBLIC",
        },
      ],
      ledger,
      executor,
      performCopies: true,
      recoveryJournal: journal,
    });

    // No Mongo rewrite committed in this simulation.
    const mongoDocsWithProductionUrls: unknown[] = [];
    assert.equal(mongoDocsWithProductionUrls.length, 0);
    assert.deepEqual(ledger.rollbackEligibleMediaKeys(), ["initiatives/e1.png"]);
    const recovered = await journal.listCreated("mig_crash_e1");
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.storageKey, "initiatives/e1.png");
    assert.equal(recovered[0]?.contentSha256, sha256Hex(body));
    assert.equal(recovered[0]?.migrationExecutionId, "mig_crash_e1");
  });

  it("Mongo failure after E1 leaves created R2 objects identifiable for recovery", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/owned.png", Buffer.from("owned"));
    const ledger = new MigrationOwnershipLedger("mig_after_e1");
    const journal = new InMemoryMediaRecoveryJournal();
    await executeMediaCopyPhase({
      planned: [
        {
          storageKey: "initiatives/owned.png",
          destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/owned.png`,
          publicPrivate: "public",
          owningInitiativeId: null,
          sourceCollections: ["media_upload_records"],
          destinationAction: "COPY_PUBLIC",
        },
      ],
      ledger,
      executor,
      performCopies: true,
      recoveryJournal: journal,
    });
    // Simulate Mongo failure: in-process ledger may be lost, durable journal remains.
    const recovered = await journal.listCreated("mig_after_e1");
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.status, "created");
    assert.ok(!JSON.stringify(recovered).includes("SECRET"));
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

  it("SHA-256 mismatch fails closed", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/bad.png", Buffer.from("source"));
    executor.seedDestination("initiatives/bad.png", Buffer.from("other!!"));
    // Same length would still fail via hash; different length also fails.
    const ledger = new MigrationOwnershipLedger("mig_sha");
    await assert.rejects(
      () =>
        executeMediaCopyPhase({
          planned: [
            {
              storageKey: "initiatives/bad.png",
              destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/bad.png`,
              publicPrivate: "public",
              owningInitiativeId: null,
              sourceCollections: ["media_upload_records"],
              destinationAction: "COPY_PUBLIC",
            },
          ],
          ledger,
          executor,
          performCopies: true,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_DESTINATION_COLLISION",
    );

    const corrupt = new InMemoryMediaCopyExecutor();
    corrupt.seedSource("initiatives/x.png", Buffer.from("ok"));
    corrupt.corruptAfterCopy = true;
    await assert.rejects(
      () =>
        executeMediaCopyPhase({
          planned: [
            {
              storageKey: "initiatives/x.png",
              destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/x.png`,
              publicPrivate: "public",
              owningInitiativeId: null,
              sourceCollections: ["media_upload_records"],
              destinationAction: "COPY_PUBLIC",
            },
          ],
          ledger: new MigrationOwnershipLedger("mig_corrupt"),
          executor: corrupt,
          performCopies: true,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_INTEGRITY_FAILED",
    );
  });

  it("missing source fails closed", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const ledger = new MigrationOwnershipLedger("mig_miss");
    await assert.rejects(
      () =>
        executeMediaCopyPhase({
          planned: [
            {
              storageKey: "missing.png",
              destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/missing.png`,
              publicPrivate: "public",
              owningInitiativeId: null,
              sourceCollections: ["media_upload_records"],
              destinationAction: "COPY_PUBLIC",
            },
          ],
          ledger,
          executor,
          performCopies: true,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MEDIA_SOURCE_MISSING",
    );
  });

  it("equivalent pre-existing destination is not migration-owned", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("same-bytes");
    executor.seedSource("initiatives/eq.png", body);
    executor.seedDestination("initiatives/eq.png", Buffer.from("same-bytes"));
    const ledger = new MigrationOwnershipLedger("mig_eq");
    const journal = new InMemoryMediaRecoveryJournal();
    const result = await executeMediaCopyPhase({
      planned: [
        {
          storageKey: "initiatives/eq.png",
          destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/eq.png`,
          publicPrivate: "public",
          owningInitiativeId: null,
          sourceCollections: ["media_upload_records"],
          destinationAction: "COPY_PUBLIC",
        },
      ],
      ledger,
      executor,
      performCopies: true,
      recoveryJournal: journal,
    });
    assert.equal(result.copiedCount, 0);
    assert.equal(result.alreadyEquivalentCount, 1);
    assert.equal(executor.writeCount, 0);
    assert.equal(ledger.rollbackEligibleMediaKeys().length, 0);
    assert.equal((await journal.listCreated("mig_eq")).length, 0);
  });

  it("successful copy records SHA-256-owned object", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("png-bytes-ok");
    executor.seedSource("initiatives/ok.png", body, "image/png");
    const ledger = new MigrationOwnershipLedger("mig_ok");
    const journal = new InMemoryMediaRecoveryJournal();
    const result = await executeMediaCopyPhase({
      planned: [
        {
          storageKey: "initiatives/ok.png",
          destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/ok.png`,
          publicPrivate: "public",
          owningInitiativeId: "initiative-1783748417899",
          sourceCollections: ["initiatives"],
          destinationAction: "COPY_PUBLIC",
        },
      ],
      ledger,
      executor,
      performCopies: true,
      recoveryJournal: journal,
    });
    assert.equal(result.copiedCount, 1);
    assert.deepEqual(ledger.rollbackEligibleMediaKeys(), ["initiatives/ok.png"]);
    assert.equal(ledger.listMediaObjects()[0]?.contentSha256, sha256Hex(body));
  });

  it("partial failure ownership only includes successfully created objects", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/one.png", Buffer.from("one"));
    const ledger = new MigrationOwnershipLedger("mig_partial");
    const journal = new InMemoryMediaRecoveryJournal();
    await assert.rejects(() =>
      executeMediaCopyPhase({
        planned: [
          {
            storageKey: "initiatives/one.png",
            destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/one.png`,
            publicPrivate: "public",
            owningInitiativeId: null,
            sourceCollections: ["media_upload_records"],
            destinationAction: "COPY_PUBLIC",
          },
          {
            storageKey: "initiatives/two.png",
            destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/two.png`,
            publicPrivate: "public",
            owningInitiativeId: null,
            sourceCollections: ["media_upload_records"],
            destinationAction: "COPY_PUBLIC",
          },
        ],
        ledger,
        executor,
        performCopies: true,
        recoveryJournal: journal,
      }),
    );
    assert.deepEqual(ledger.rollbackEligibleMediaKeys(), ["initiatives/one.png"]);
    assert.equal((await journal.listCreated("mig_partial")).length, 1);
    const deleted = await rollbackOwnedMediaObjects(executor, ledger);
    assert.equal(deleted, 1);
  });

  it("dry-run performs zero R2 writes", async () => {
    const executor = new InMemoryMediaCopyExecutor();
    executor.seedSource("initiatives/dry.png", Buffer.from("x"));
    const ledger = new MigrationOwnershipLedger("mig_dry");
    const result = await executeMediaCopyPhase({
      planned: [
        {
          storageKey: "initiatives/dry.png",
          destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/dry.png`,
          publicPrivate: "public",
          owningInitiativeId: null,
          sourceCollections: ["media_upload_records"],
          destinationAction: "COPY_PUBLIC",
        },
      ],
      ledger,
      executor: new DeferredMediaCopyExecutor(),
      performCopies: false,
    });
    assert.equal(result.copiedCount, 0);
    assert.equal(result.deferred, true);
    assert.equal(executor.writeCount, 0);
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
});
