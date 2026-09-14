import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  InMemoryDurableMediaRecoveryStore,
  InMemoryMediaCopyExecutor,
  assertNoSecretLeak,
  buildMigrationOwnershipMetadata,
  buildThirtyOneToThirteenMediaFixture,
  formatMediaR2PreflightReport,
  reconcileMediaPlanReferences,
  runMediaR2Preflight,
} from "../../../src/modules/production-initiative-migration/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(
  here,
  "../../../src/scripts/preflight-production-initiative-migration-media-r2.ts",
);

function plannedFromFixture() {
  return reconcileMediaPlanReferences(buildThirtyOneToThirteenMediaFixture()).uniquePublicCopies;
}

describe("Production Initiative migration media R2 preflight — Task 07.4", () => {
  it("all 13 source objects readable + destinations absent → PASS", async () => {
    const planned = plannedFromFixture();
    assert.equal(planned.length, 13);
    const reader = new InMemoryMediaCopyExecutor();
    const recovery = new InMemoryDurableMediaRecoveryStore();
    for (const row of planned) {
      reader.seedSource(row.storageKey, Buffer.from(`bytes-${row.storageKey}`));
    }
    const report = await runMediaR2Preflight({
      planned,
      reader,
      mutationCounters: {
        putObjectCalls: reader.getWriteCount(),
        deleteObjectCalls: reader.getDeleteCount(),
        mongoWrites: 0,
        recoveryStoreWrites: recovery.writeCount,
      },
    });
    assert.equal(report.verdict, "PASS");
    assert.equal(report.sourceObjectsExpected, 13);
    assert.equal(report.sourceObjectsReadable, 13);
    assert.equal(report.destinationAbsent, 13);
    assert.equal(report.destinationEquivalent, 0);
    assert.equal(report.destinationConflicts, 0);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.mutationProof.recoveryStoreWrites, 0);
    assert.equal(reader.writeCount, 0);
    assert.equal(reader.deleteCount, 0);
    assert.equal(recovery.writeCount, 0);
  });

  it("missing source → FAIL", async () => {
    const planned = plannedFromFixture();
    const reader = new InMemoryMediaCopyExecutor();
    for (const row of planned.slice(1)) {
      reader.seedSource(row.storageKey, Buffer.from("x"));
    }
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "FAIL");
    assert.equal(report.sourceObjectsReadable, 12);
    assert.ok(report.blockers.some((b) => /Source missing/.test(b)));
    assert.equal(reader.writeCount, 0);
  });

  it("unreadable source → FAIL", async () => {
    const planned = plannedFromFixture();
    const reader = new InMemoryMediaCopyExecutor();
    for (const row of planned) {
      reader.seedSource(row.storageKey, Buffer.from("x"));
    }
    reader.unreadableSources.add(planned[0]!.storageKey);
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Source unreadable/.test(b)));
    assert.equal(reader.writeCount, 0);
  });

  it("destination equivalent → PASS", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("same-bytes");
    reader.seedSource(planned[0]!.storageKey, body);
    reader.seedDestination(planned[0]!.storageKey, Buffer.from("same-bytes"));
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "PASS");
    assert.equal(report.destinationEquivalent, 1);
    assert.equal(report.keys[0]?.destinationStatus, "DESTINATION_EQUIVALENT");
    assert.equal(reader.writeCount, 0);
  });

  it("destination mismatch → FAIL", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    reader.seedSource(planned[0]!.storageKey, Buffer.from("source"));
    reader.seedDestination(planned[0]!.storageKey, Buffer.from("other!!"));
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "FAIL");
    assert.equal(report.destinationConflicts, 1);
    assert.equal(report.keys[0]?.destinationStatus, "DESTINATION_INTEGRITY_MISMATCH");
    assert.equal(reader.writeCount, 0);
  });

  it("foreign migration destination with equivalent content is safe (no overwrite)", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    const body = Buffer.from("foreign-eq");
    reader.seedSource(planned[0]!.storageKey, body);
    reader.seedDestination(
      planned[0]!.storageKey,
      Buffer.from("foreign-eq"),
      "image/png",
      buildMigrationOwnershipMetadata("mig_other"),
    );
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "PASS");
    assert.equal(report.keys[0]?.destinationStatus, "DESTINATION_FOREIGN_EQUIVALENT");
    assert.equal(report.destinationEquivalent, 1);
    assert.equal(reader.writeCount, 0);
  });

  it("foreign migration destination with mismatch fails closed", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    reader.seedSource(planned[0]!.storageKey, Buffer.from("source"));
    reader.seedDestination(
      planned[0]!.storageKey,
      Buffer.from("foreign-diff"),
      "image/png",
      buildMigrationOwnershipMetadata("mig_other"),
    );
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "FAIL");
    assert.equal(report.keys[0]?.destinationStatus, "DESTINATION_INTEGRITY_MISMATCH");
  });

  it("canonical public base mismatch → FAIL", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    reader.seedSource(planned[0]!.storageKey, Buffer.from("x"));
    const report = await runMediaR2Preflight({
      planned,
      reader,
      destinationPublicBaseUrl: "https://media-staging.huws.org",
    });
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => b.includes(PRODUCTION_MEDIA_PUBLIC_BASE_URL)));
  });

  it("zero writes in every preflight path", async () => {
    const planned = plannedFromFixture();
    const reader = new InMemoryMediaCopyExecutor();
    const recovery = new InMemoryDurableMediaRecoveryStore();
    for (const row of planned) {
      reader.seedSource(row.storageKey, Buffer.from("ok"));
    }
    // Mix: one equivalent, rest absent.
    reader.seedDestination(planned[0]!.storageKey, Buffer.from("ok"));
    const report = await runMediaR2Preflight({
      planned,
      reader,
      mutationCounters: {
        putObjectCalls: reader.writeCount,
        deleteObjectCalls: reader.deleteCount,
        mongoWrites: 0,
        recoveryStoreWrites: recovery.writeCount,
      },
    });
    assert.equal(report.verdict, "PASS");
    assert.equal(reader.writeCount, 0);
    assert.equal(reader.deleteCount, 0);
    assert.equal(recovery.writeCount, 0);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.mutationProof.recoveryStoreWrites, 0);
  });

  it("credentials redacted from errors/reports", async () => {
    const planned = plannedFromFixture().slice(0, 1);
    const reader = new InMemoryMediaCopyExecutor();
    reader.seedSource(planned[0]!.storageKey, Buffer.from("x"));
    const report = await runMediaR2Preflight({ planned, reader });
    const text = formatMediaR2PreflightReport(report);
    assert.doesNotMatch(text, /secretAccessKey|accessKeyId|accountId/i);
    assert.doesNotMatch(text, /SECRET|ACCESS_KEY/);
    assert.throws(
      () =>
        assertNoSecretLeak(
          JSON.stringify({ secretAccessKey: "abc", accessKeyId: "id", accountId: "acct" }),
        ),
    );
  });

  it("CLI script is read-only and never references PutObject/DeleteObject writes", () => {
    const script = readFileSync(scriptPath, "utf8");
    assert.match(script, /assertNoWritePathRequested/);
    assert.match(script, /runMediaR2Preflight/);
    assert.match(script, /read-only/);
    assert.doesNotMatch(script, /PutObjectCommand|DeleteObjectCommand/);
    assert.doesNotMatch(script, /destinationClient\.connect|DESTINATION_MONGODB_URI/);
  });

  it("planned destination URLs must use https://media.huws.org", async () => {
    const planned = [
      {
        ...plannedFromFixture()[0]!,
        destinationUrl: "https://evil.example/initiatives/x.png",
        storageKey: "initiatives/x.png",
      },
    ];
    const reader = new InMemoryMediaCopyExecutor();
    reader.seedSource("initiatives/x.png", Buffer.from("x"));
    const report = await runMediaR2Preflight({ planned, reader });
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /destinationUrl/.test(b)));
  });
});
