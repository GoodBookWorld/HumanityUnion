/**
 * Pack 01.1 — bootstrap Initiative cleanup gates (no Mongo required).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV,
  BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT,
  BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE,
  BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE,
  BOOTSTRAP_INITIATIVE_CLEANUP_ID,
  assertAllowListedBootstrapInitiativeId,
  assertBootstrapInitiativeCleanupGuards,
  buildCleanupFilter,
  isAllowedBootstrapInitiativeCleanupDatabase,
  BootstrapInitiativeCleanupValidationError,
} from "../../../src/modules/bootstrap-initiative-cleanup/index.js";
import { shouldSeedBootstrapInitiative } from "../../../src/modules/initiatives/initiative.store.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Bootstrap Initiative cleanup — allow-list and guards", () => {
  it("only allow-lists initiative-bootstrap-001 / Community Garden title", () => {
    assert.equal(BOOTSTRAP_INITIATIVE_CLEANUP_ID, "initiative-bootstrap-001");
    assert.equal(
      BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE,
      "Community Garden Initiative",
    );
    assert.equal(
      assertAllowListedBootstrapInitiativeId("initiative-bootstrap-001"),
      "initiative-bootstrap-001",
    );
    assert.throws(
      () => assertAllowListedBootstrapInitiativeId("initiative-1785693642422"),
      /exactly/,
    );
  });

  it("allows only staging DB or hu_test_* under NODE_TEST_ENV", () => {
    assert.equal(
      isAllowedBootstrapInitiativeCleanupDatabase(BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE),
      true,
    );
    assert.equal(isAllowedBootstrapInitiativeCleanupDatabase("humanity_union_dev"), false);
    assert.equal(isAllowedBootstrapInitiativeCleanupDatabase("humanity_union_production"), false);
    assert.equal(isAllowedBootstrapInitiativeCleanupDatabase("hu_test_pack011"), false);
    assert.equal(
      isAllowedBootstrapInitiativeCleanupDatabase("hu_test_pack011", { nodeTestEnv: true }),
      true,
    );
  });

  it("refuses production platform mode and execute without confirm", () => {
    assert.throws(
      () =>
        assertBootstrapInitiativeCleanupGuards({
          PLATFORM_MODE: "production",
          MONGODB_DATABASE: BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE,
        }),
      BootstrapInitiativeCleanupValidationError,
    );

    assert.throws(
      () =>
        assertBootstrapInitiativeCleanupGuards({
          PLATFORM_MODE: "staging",
          MONGODB_DATABASE: BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE,
          execute: true,
        }),
      BootstrapInitiativeCleanupValidationError,
    );

    assert.doesNotThrow(() =>
      assertBootstrapInitiativeCleanupGuards({
        PLATFORM_MODE: "staging",
        MONGODB_DATABASE: BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE,
        [BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV]: "YES",
        execute: true,
      }),
    );
  });

  it("cleanup contract covers initiatives root and builds exact-ID filters", () => {
    assert.ok(
      BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT.some(
        (entry) => entry.collection === "initiatives" && entry.kind === "root",
      ),
    );
    assert.deepEqual(buildCleanupFilter("initiativeId"), {
      initiativeId: "initiative-bootstrap-001",
    });
    assert.deepEqual(buildCleanupFilter("aggregateId"), {
      aggregateId: "initiative-bootstrap-001",
    });
  });

  it("operator script is dry-run by default and refuses production", () => {
    const script = readRepo("apps/api/src/scripts/cleanup-bootstrap-initiative.ts");
    assert.match(script, /Dry-run only/);
    assert.match(script, /BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM/);
    assert.match(script, /assertBootstrapInitiativeCleanupGuards/);
    assert.match(script, /planBootstrapInitiativeCleanup/);
    assert.match(script, /executeBootstrapInitiativeCleanup/);
  });
});

describe("Bootstrap Initiative seed gate", () => {
  it("does not auto-seed under PLATFORM_MODE staging or production", () => {
    assert.equal(
      shouldSeedBootstrapInitiative({ PLATFORM_MODE: "staging" } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      shouldSeedBootstrapInitiative({ PLATFORM_MODE: "production" } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      shouldSeedBootstrapInitiative({} as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      shouldSeedBootstrapInitiative({
        PLATFORM_MODE: "staging",
        INITIATIVE_BOOTSTRAP_SEED: "true",
      } as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      shouldSeedBootstrapInitiative({ INITIATIVE_BOOTSTRAP_SEED: "false" } as NodeJS.ProcessEnv),
      false,
    );
  });

  it("store wires shouldSeedBootstrapInitiative into ensureBootstrapSeed", () => {
    const store = readRepo("apps/api/src/modules/initiatives/initiative.store.ts");
    assert.match(store, /export function shouldSeedBootstrapInitiative/);
    assert.match(store, /if \(!shouldSeedBootstrapInitiative\(\)\)/);
  });
});
