import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/scripts/staging-data-migration-inspect.ts",
);

describe("Staging Data Migration Pack 01 — dry-run inspector contracts", () => {
  it("is dry-run only and never prints connection strings", () => {
    const source = readFileSync(scriptPath, "utf8");
    assert.match(source, /DRY RUN|dry-run/);
    assert.match(source, /--write|--execute/);
    assert.match(source, /credentials=redacted/);
    assert.doesNotMatch(source, /console\.log\([^)]*MONGODB_URI/);
    assert.doesNotMatch(source, /console\.log\([^)]*config\.uri/);
    assert.doesNotMatch(source, /\.dropDatabase\(/);
    assert.doesNotMatch(source, /\.deleteMany\(/);
    assert.doesNotMatch(source, /\.updateMany\(/);
    assert.doesNotMatch(source, /\.insertMany\(/);
    assert.doesNotMatch(source, /\.replaceOne\(/);
  });

  it("inventories both identity and Initiative collections safely", () => {
    const source = readFileSync(scriptPath, "utf8");
    assert.match(source, /authUsers|auth_users/);
    assert.match(source, /initiatives/);
    assert.match(source, /activities/);
    assert.match(source, /LEGACY_DO_NOT_MIGRATE_DIRECTLY|excludedLegacyRecords/);
    assert.match(source, /maskEmail|emailFingerprint/);
  });
});
