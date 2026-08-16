import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH,
  loadAndValidateReconciliationBundle,
  resolveRepoRoot,
} from "../../../src/modules/staging-reconciliation/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(path.resolve(moduleDir, "../../.."));

describe("Staging Feature Reconciliation Pack 05 — allies + RSS bundle", () => {
  it("loads allies and collaboration channel records for approved Initiatives only", () => {
    const bundle = loadAndValidateReconciliationBundle(
      path.join(repoRoot, PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH),
    );
    assert.equal(bundle.allies.records.length, 6);
    assert.equal(
      bundle.allies.records.filter((record) => record.status === "active").length,
      5,
    );
    assert.equal(bundle.collaborationMessages.records.length, 4);
    assert.equal(bundle.collaborationReads.records.length, 8);
    assert.equal(bundle.rssSources.strategy, "re_ingest_from_configured_sources");
    assert.ok(bundle.rssSources.sources.length >= 1);

    const mindSafe = bundle.allies.records.filter(
      (record) => record.initiativeId === "initiative-1784349613932",
    );
    const isabella = bundle.allies.records.filter(
      (record) => record.initiativeId === "initiative-1785948978037",
    );
    assert.equal(mindSafe.length, 3);
    assert.equal(isabella.length, 3);
  });

  it("does not treat Active Allies as a stored entity — status active only", () => {
    const bundle = loadAndValidateReconciliationBundle(
      path.join(repoRoot, PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH),
    );
    for (const record of bundle.allies.records) {
      assert.ok(["interest_pending", "invitation_pending", "active", "declined"].includes(String(record.status)));
      assert.ok(record.participantId);
      assert.ok(record.initiativeId);
    }
  });
});
