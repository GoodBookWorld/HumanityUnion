import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_INITIATIVE_IDS,
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH,
  STAGING_RECONCILIATION_FLAG,
  StagingReconciliationError,
  assertStagingReconciliationDatabasePair,
  assertStagingReconciliationExecuteGuards,
  isBcryptHash,
  isExecuteModeRequested,
  loadAndValidateReconciliationBundle,
  resolveRepoRoot,
  formatStagingVerificationSummary,
} from "../../../src/modules/staging-reconciliation/index.js";
import type { StagingVerificationSummary } from "../../../src/modules/staging-reconciliation/verify.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(path.resolve(moduleDir, "../../.."));

describe("Staging Reconciliation Pack 04 — guards & portable bundle", () => {
  it("requires execute flag + allow flag + staging production env", () => {
    assert.throws(
      () =>
        assertStagingReconciliationExecuteGuards({
          NODE_ENV: "production",
          PLATFORM_MODE: "staging",
          ALLOW_STAGING_RECONCILIATION: "true",
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: APPROVED_TARGET_DATABASE,
          execute: false,
        }),
      StagingReconciliationError,
    );

    assert.throws(
      () =>
        assertStagingReconciliationExecuteGuards({
          NODE_ENV: "production",
          PLATFORM_MODE: "staging",
          ALLOW_STAGING_RECONCILIATION: "false",
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: APPROVED_TARGET_DATABASE,
          execute: true,
        }),
      /ALLOW_STAGING_RECONCILIATION/,
    );

    assert.doesNotThrow(() =>
      assertStagingReconciliationExecuteGuards({
        NODE_ENV: "production",
        PLATFORM_MODE: "staging",
        ALLOW_STAGING_RECONCILIATION: "true",
        sourceDatabase: APPROVED_SOURCE_DATABASE,
        targetDatabase: APPROVED_TARGET_DATABASE,
        execute: true,
      }),
    );
  });

  it("rejects identical source/target and forbidden targets", () => {
    assert.throws(
      () =>
        assertStagingReconciliationDatabasePair({
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: APPROVED_SOURCE_DATABASE,
        }),
      /must not equal/,
    );
    assert.throws(
      () =>
        assertStagingReconciliationDatabasePair({
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: "humanity_union_production",
        }),
      StagingReconciliationError,
    );
  });

  it("detects bcrypt hashes without printing them", () => {
    assert.equal(isBcryptHash("$2b$12$abcdefghijklmnopqrstuv"), true);
    assert.equal(isBcryptHash("plaintext"), false);
    assert.equal(isExecuteModeRequested(["node", "script", "--execute"]), true);
    assert.equal(STAGING_RECONCILIATION_FLAG, "ALLOW_STAGING_RECONCILIATION");
  });

  it("loads checksum-validated portable reconciliation bundle without password hashes", () => {
    const bundleDir = path.join(repoRoot, PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH);
    const bundle = loadAndValidateReconciliationBundle(bundleDir);
    assert.equal(bundle.comments.records.length, 10);
    assert.equal(bundle.commentReactions.records.length, 12);
    assert.equal(bundle.analysisReactions.records.length, 1);
    assert.equal(bundle.supportSignals.registered.length, 9);
    assert.equal(bundle.supportSignals.visitor.length, 15);
    assert.equal(bundle.bookmarks.records.length, 1);
    assert.equal(bundle.views.records.length, 196);
    assert.equal(bundle.participantActions.records.length, 0);
    assert.equal(bundle.authRecovery.participants.length, 4);

    for (const participant of bundle.authRecovery.participants) {
      assert.equal("passwordHash" in participant, false);
    }

    for (const record of bundle.comments.records) {
      assert.ok(
        APPROVED_INITIATIVE_IDS.includes(
          String(record.initiativeId) as (typeof APPROVED_INITIATIVE_IDS)[number],
        ),
      );
    }

    const authText = fs.readFileSync(path.join(bundleDir, "auth-recovery.json"), "utf8");
    assert.equal(authText.includes("passwordHash"), false);
  });

  it("formats verify:staging summary contract", () => {
    const summary: StagingVerificationSummary = {
      result: "WARN",
      participants: 5,
      loginReady: 1,
      initiativesPublic: 5,
      initiativesTotal: 6,
      comments: 0,
      commentReactions: 0,
      supportSignals: 4,
      bookmarks: 0,
      views: 9,
      proposals: 3,
      proposalsPublicCounted: 0,
      brokenStewards: 0,
      brokenInitiativeAncestry: 0,
      brokenMediaUrls: 0,
      unreachableMedia: 0,
      authIntegrityIssues: 0,
      reconciliationConflicts: 0,
      webInitiativeImages: "PASS",
      participantAvatars: "PASS",
      loginReadyByKey: {
        historical_vlad_gmail: false,
        michael: false,
        derek: false,
        isabella: false,
      },
      warnings: ["historical accounts pending reconcile"],
      failures: [],
    };
    const text = formatStagingVerificationSummary(summary);
    assert.match(text, /STAGING VERIFICATION/);
    assert.match(text, /result: WARN/);
    assert.match(text, /proposals: 3/);
    assert.match(text, /historical_vlad_login_ready: no/);
    assert.equal(text.includes("@"), false);
  });

  it("Mind-Safe has comments; CSS has zero comments in portable inventory", () => {
    const bundle = loadAndValidateReconciliationBundle(
      path.join(repoRoot, PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH),
    );
    const css = bundle.comments.records.filter(
      (record) => record.initiativeId === "initiative-1783748417899",
    );
    const mindSafe = bundle.comments.records.filter(
      (record) => record.initiativeId === "initiative-1784349613932",
    );
    assert.equal(css.length, 0);
    assert.equal(mindSafe.length, 6);
  });
});
