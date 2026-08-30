/**
 * Staging Historical Outbox Recovery — unit gates (no Mongo required).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertOutboxRecordEligibleForFailedRetry,
  assertSingleOutboxId,
  OutboxRecoveryNotFailedError,
  OutboxRecoveryValidationError,
} from "../../../src/infrastructure/outbox/outbox-recovery.errors.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Staging Historical Outbox Recovery — fail-closed gates", () => {
  it("accepts exactly one UUID outboxId and rejects bulk/ambiguous input", () => {
    const id = "7605b880-3484-4068-8a88-ce6d552e569d";
    assert.equal(assertSingleOutboxId(id), id);
    assert.throws(() => assertSingleOutboxId(""), OutboxRecoveryValidationError);
    assert.throws(() => assertSingleOutboxId("not-a-uuid"), OutboxRecoveryValidationError);
    assert.throws(
      () => assertSingleOutboxId(`${id},${id}`),
      OutboxRecoveryValidationError,
    );
    assert.throws(
      () => assertSingleOutboxId(`${id} ${id}`),
      OutboxRecoveryValidationError,
    );
  });

  it("allows only failed status; pending/published cannot be reset accidentally", () => {
    assert.doesNotThrow(() =>
      assertOutboxRecordEligibleForFailedRetry({
        outboxId: "7605b880-3484-4068-8a88-ce6d552e569d",
        status: "failed",
      }),
    );
    assert.throws(
      () =>
        assertOutboxRecordEligibleForFailedRetry({
          outboxId: "7605b880-3484-4068-8a88-ce6d552e569d",
          status: "pending",
        }),
      OutboxRecoveryNotFailedError,
    );
    assert.throws(
      () =>
        assertOutboxRecordEligibleForFailedRetry({
          outboxId: "7605b880-3484-4068-8a88-ce6d552e569d",
          status: "published",
        }),
      OutboxRecoveryNotFailedError,
    );
  });

  it("recovery uses canonical dispatcher path and refuses production", () => {
    const service = readRepo(
      "apps/api/src/infrastructure/outbox/outbox-recovery.service.ts",
    );
    const script = readRepo("apps/api/src/scripts/retry-failed-outbox-record.ts");
    const repository = readRepo("apps/api/src/infrastructure/outbox/outbox.repository.ts");
    const requeueBlock = repository.slice(
      repository.indexOf("export async function requeueFailedOutboxRecordById"),
      repository.indexOf("export async function deleteOutboxRecordsByEventIdPrefix"),
    );

    assert.match(service, /dispatchOutboxBatch/);
    assert.match(service, /requeueFailedOutboxRecordById/);
    assert.doesNotMatch(service, /markOutboxRecordPublished/);
    assert.match(requeueBlock, /status:\s*"failed"/);
    assert.match(requeueBlock, /status:\s*"pending"/);
    assert.doesNotMatch(requeueBlock, /deleteOne|deleteMany|markOutboxRecordPublished/);
    assert.match(script, /OUTBOX_RETRY_CONFIRM/);
    assert.match(script, /PLATFORM_MODE=production/);
    assert.match(script, /envelope omitted|safe metadata/);
    assert.doesNotMatch(script, /existing\.envelope/);
  });
});
