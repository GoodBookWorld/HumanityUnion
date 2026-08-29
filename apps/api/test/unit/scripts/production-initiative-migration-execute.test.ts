import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_WRITE_COLLECTIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_MIGRATE_COLLECTIONS,
  FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionInitiativeMigrationError,
  assertAllowListRejectsBootstrapAndTest2,
  assertExactNineAllowList,
  assertInlineExecutionPreflightPass,
  assertMigrationDestinationDatabase,
  assertMigrationExecuteWriteGuards,
  assertMigrationSourceDatabase,
  assertMigrationWritableCollectionForTest,
  buildCandidateInitiativeRow,
  deduplicateMediaPlanItems,
  DeferredMediaCopyExecutor,
  executeMediaCopyPhase,
  isExecuteModeRequested,
  MigrationOwnershipLedger,
  resolveDocumentAncestry,
  resolveMigrationMode,
  rewritePublicMediaUrl,
  sanitizeBadgeApplicationForMigration,
  sanitizeInitiativeDocumentForMigration,
  sanitizeStripeOperationalFields,
  stripPrivateFieldsForReport,
} from "../../../src/modules/production-initiative-migration/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const executeScript = path.resolve(
  moduleDir,
  "../../../src/scripts/execute-production-initiative-migration.ts",
);
const executeModule = path.resolve(
  moduleDir,
  "../../../src/modules/production-initiative-migration/execute.ts",
);

describe("Production Initiative migration execute path — Task 07.2 / 07.2.1", () => {
  it("exact 9-ID allow-list; excludes bootstrap/Test2 and typo ID", () => {
    assert.equal(CANONICAL_PRODUCTION_INITIATIVE_IDS.length, 9);
    assert.deepEqual(assertExactNineAllowList([...CANONICAL_PRODUCTION_INITIATIVE_IDS]), []);
    assert.ok(
      assertAllowListRejectsBootstrapAndTest2([
        ...EXCLUDED_PRODUCTION_INITIATIVE_IDS,
        FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
      ]).length >= 3,
    );
  });

  it("preserves lifecycleProfile including null/absent; never invents STANDARD", () => {
    const expected = {
      initiativeId: "initiative-1783748417899",
      title: "Citizen Support Squad (CSS)",
      stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
      stewardLabel: "Vlad Shapran",
    };
    const absent = buildCandidateInitiativeRow({
      expected,
      doc: {
        _id: expected.initiativeId,
        initiativeId: expected.initiativeId,
        stewardId: expected.stewardMemberId,
        title: expected.title,
        status: "published",
        visibility: { policy: "public" },
        lifecyclePhase: "discussion",
      },
    });
    assert.equal(absent.lifecycleProfile, undefined);

    const sanitized = sanitizeInitiativeDocumentForMigration({
      _id: expected.initiativeId,
      initiativeId: expected.initiativeId,
      stewardId: expected.stewardMemberId,
      title: expected.title,
      lifecycleProfile: null,
      metadata: {
        imageUrl: "https://staging.example/r2/initiatives/cover.png",
      },
    });
    assert.equal(sanitized.lifecycleProfile, null);
    assert.equal(
      sanitized.metadata.imageUrl,
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/r2/initiatives/cover.png`,
    );
  });

  it("collision and ancestry fail closed", () => {
    assert.throws(
      () =>
        assertMigrationExecuteWriteGuards({
          sourceDatabase: PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
          destinationDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
          execute: true,
          confirm: undefined,
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "MISSING_CONFIRMATION",
    );

    const ancestry = resolveDocumentAncestry({
      doc: { voteId: "v1" },
      method: "parent:decisionId",
      allowList: new Set(CANONICAL_PRODUCTION_INITIATIVE_IDS),
      parentInitiativeById: new Map([["d1", null]]),
    });
    assert.equal(ancestry.ambiguous, true);
  });

  it("Stripe Test fields sanitized; never invent Live IDs", () => {
    const sanitized = sanitizeStripeOperationalFields({
      contributionId: "c1",
      status: "paid",
      paidAt: "2026-01-01T00:00:00.000Z",
      stripeCheckoutSessionId: "cs_test_abc",
      stripePaymentIntentId: "pi_test_abc",
      stripeCustomerId: "cus_test_abc",
    });
    assert.equal(sanitized.status, "paid");
    assert.equal(sanitized.paidAt, "2026-01-01T00:00:00.000Z");
    assert.equal(sanitized.stripeCheckoutSessionId, null);
    assert.equal(sanitized.stripePaymentIntentId, null);
    assert.equal(sanitized.stripeCustomerId, null);
  });

  it("active Member fields preserved; badge shipping retained on doc only", () => {
    assert.ok(FORBIDDEN_MIGRATE_COLLECTIONS.includes("membership_webhook_events"));
    const badge = sanitizeBadgeApplicationForMigration({
      applicationId: "a1",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      stripeCheckoutSessionId: "cs_test_x",
      shippingAddress: {
        recipientName: "Secret Person",
        addressLine1: "123 Hidden Rd",
        phone: "555-9999",
      },
    });
    assert.equal(badge.paymentStatus, "paid");
    assert.equal(badge.fulfillmentStatus, "shipped");
    assert.equal(badge.stripeCheckoutSessionId, null);
    assert.ok(badge.shippingAddress);
  });

  it("private shipping never appears in sanitized reports", () => {
    const report = stripPrivateFieldsForReport({
      applicationId: "a1",
      shippingAddress: {
        recipientName: "Secret",
        addressLine1: "123 Hidden",
        phone: "555",
      },
      paymentStatus: "paid",
    });
    const text = JSON.stringify(report);
    assert.doesNotMatch(text, /Secret|123 Hidden|555|shippingAddress|addressLine1/);
    assert.match(text, /shippingDataPresent/);
  });

  it("media deduplication and deferred R2 copy status", async () => {
    const planned = deduplicateMediaPlanItems([
      {
        sourceStorageKey: "initiatives/a.png",
        publicPrivate: "public",
        owningInitiativeId: "initiative-1783748417899",
        mediaUploadRecordPresent: true,
        sourceUrlHost: "staging.example",
        hostClassification: "staging_r2",
        destinationAction: "COPY_PUBLIC",
        urlRewriteRequired: true,
        sourceCollection: "initiatives",
        recordId: "initiative-1783748417899",
        ownerIsSystemMediaRecovery: false,
      },
      {
        sourceStorageKey: "initiatives/a.png",
        publicPrivate: "public",
        owningInitiativeId: "initiative-1783748417899",
        mediaUploadRecordPresent: true,
        sourceUrlHost: "staging.example",
        hostClassification: "staging_r2",
        destinationAction: "COPY_PUBLIC",
        urlRewriteRequired: true,
        sourceCollection: "media_upload_records",
        recordId: "m1",
        ownerIsSystemMediaRecovery: false,
      },
    ]);
    assert.equal(planned.length, 1);
    assert.equal(planned[0]?.destinationUrl, `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/a.png`);

    const ledger = new MigrationOwnershipLedger("mig_test");
    const result = await executeMediaCopyPhase({
      planned,
      ledger,
      executor: new DeferredMediaCopyExecutor(),
      performCopies: false,
    });
    assert.equal(result.copiedCount, 0);
    assert.equal(result.deferred, true);
    assert.equal(ledger.rollbackEligibleMediaKeys().length, 0);
    assert.equal(ledger.listMediaObjects().length, 1);
  });

  it("rollback ownership requires insertedId; never deletes by initiativeId alone", () => {
    const ledger = new MigrationOwnershipLedger("mig_own");
    ledger.recordMongoInsert({
      collection: "initiatives",
      insertedId: null,
      primaryFilter: { initiativeId: "initiative-1783748417899" },
      phase: "C_initiative_roots",
    });
    assert.equal(ledger.rollbackEligibleMongoInserts().length, 0);

    ledger.recordMongoInsert({
      collection: "initiatives",
      insertedId: "oid_this_run",
      primaryFilter: { initiativeId: "initiative-1783748417899" },
      phase: "C_initiative_roots",
    });
    const eligible = ledger.rollbackEligibleMongoInserts();
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]?.insertedId, "oid_this_run");
    assert.equal(eligible[0]?.migrationExecutionId, "mig_own");

    assert.throws(
      () =>
        ledger.recordMongoInsert({
          collection: "member_badge_applications",
          insertedId: "x",
          primaryFilter: { shippingAddress: "leak" },
          phase: "B_membership",
        }),
      /refuses private filter key/,
    );

    ledger.recordMediaObject({
      storageKey: "initiatives/a.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/a.png`,
      copied: false,
      migrationExecutionId: "mig_own",
    });
    ledger.recordMediaObject({
      storageKey: "initiatives/b.png",
      destinationUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/initiatives/b.png`,
      copied: true,
      migrationExecutionId: "mig_own",
    });
    assert.deepEqual(ledger.rollbackEligibleMediaKeys(), ["initiatives/b.png"]);
  });

  it("execution confirmation gates and dual DB guards; dry-run default", () => {
    assert.equal(isExecuteModeRequested(["node", "script.ts"]), false);
    assert.equal(isExecuteModeRequested(["node", "script.ts", "--execute"]), true);
    assert.equal(resolveMigrationMode({ execute: true, confirm: "NO" }), "dry-run");
    assert.equal(
      resolveMigrationMode({
        execute: true,
        confirm: PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
      }),
      "execute",
    );

    assert.equal(
      assertMigrationSourceDatabase(PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE),
      PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
    );
    assert.equal(
      assertMigrationDestinationDatabase(PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE),
      PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
    );
    assert.throws(
      () => assertMigrationSourceDatabase(PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "WRONG_SOURCE_DATABASE",
    );
  });

  it("forbidden collections and write allow-list refuse dynamic writes", () => {
    for (const name of [
      "outbox",
      "processed_events",
      "auth_sessions",
      "email_verification_tokens",
      "email_confirmation_codes",
      "member_notifications",
      "membership_webhook_events",
    ]) {
      assert.ok((FORBIDDEN_MIGRATE_COLLECTIONS as readonly string[]).includes(name));
      assert.throws(
        () => assertMigrationWritableCollectionForTest(name),
        (error: unknown) =>
          error instanceof ProductionInitiativeMigrationError &&
          error.code === "FORBIDDEN_COLLECTION",
      );
    }
    assert.throws(
      () => assertMigrationWritableCollectionForTest("workspace_projections"),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "COLLECTION_NOT_ALLOWLISTED",
    );
    assert.ok(ALLOWED_WRITE_COLLECTIONS.includes("initiatives"));
    assert.ok(ALLOWED_WRITE_COLLECTIONS.includes("memberships"));
    assert.ok(!ALLOWED_WRITE_COLLECTIONS.includes("auth_users"));
    assert.ok(!ALLOWED_WRITE_COLLECTIONS.includes("members"));
    assert.ok(!ALLOWED_WRITE_COLLECTIONS.includes("member_profiles"));
  });

  it("inline preflight fail-closed without PASS verdict", () => {
    assert.throws(
      () =>
        assertInlineExecutionPreflightPass({
          sourceDatabase: "humanity_union_staging",
          destinationDatabase: "humanity_union_production",
          allowList: [...CANONICAL_PRODUCTION_INITIATIVE_IDS],
          sourceRootsPresent: 8,
          destinationRootsAbsent: 9,
          identityGraphsOk: 5,
          destinationMembershipCollisions: 0,
          verdict: "FAIL",
          blockers: ["Source missing Initiative root initiative-x"],
          checkedAt: new Date().toISOString(),
        }),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "INLINE_PREFLIGHT_FAIL",
    );
  });

  it("URL rewrite targets media.huws.org", () => {
    assert.equal(
      rewritePublicMediaUrl("https://staging.example/path/initiatives/x.png"),
      `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/path/initiatives/x.png`,
    );
  });

  it("execute script uses inline preflight; no env-only fresh-preflight gate; defers media", () => {
    const src = fs.readFileSync(executeScript, "utf8");
    const mod = fs.readFileSync(executeModule, "utf8");
    assert.match(src, /DRY-RUN|dry-run/);
    assert.match(src, /performMediaCopies: false/);
    assert.match(src, /PRODUCTION_INITIATIVE_MIGRATION_CONFIRM/);
    assert.match(src, /resolveDualMongoEnv/);
    assert.match(src, /inlineExecutionPreflight/);
    assert.doesNotMatch(src, /FRESH_PREFLIGHT_PASS/);
    assert.match(mod, /runInlineExecutionPreflight/);
    assert.match(mod, /TRANSACTION_REQUIRED/);
    assert.match(mod, /No sequential fallback/);
    assert.match(mod, /rollbackOwnedMongoInserts/);
    assert.match(mod, /insertedId/);
    assert.match(mod, /mediaPlan\.status=|status: mediaPlanStatus|DEFERRED/);
    assert.match(mod, /withRequiredTransaction/);
  });

  it("execute module refuses production forceNonTransactional and requires session", () => {
    const mod = fs.readFileSync(executeModule, "utf8");
    assert.match(mod, /TRANSACTION_BYPASS_FORBIDDEN/);
    assert.match(mod, /humanity_union_production/);
    assert.match(mod, /Execute inserts require a Mongo session/);
  });
});
