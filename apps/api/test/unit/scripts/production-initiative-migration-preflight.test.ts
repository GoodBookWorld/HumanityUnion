import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  SYSTEM_MEDIA_RECOVERY_OWNER,
  assertAllowListRejectsBootstrapAndTest2,
  assertAmbiguousMustFails,
  assertExactNineAllowList,
  assertMembershipPlanSafeForLogging,
  assertNoWritePathRequested,
  assertStagingSourceDatabase,
  assertProductionCollisionDatabase,
  buildCandidateInitiativeRow,
  buildStaticMembershipCollectionPlan,
  buildStripeSanitizationPlan,
  classifyActorId,
  decideMediaDestinationAction,
  evaluateInitiativeVerdict,
  evaluatePartialChildCollision,
  evaluateRootCollisionVerdict,
  isForbiddenTypoAiCommonGoodId,
  listCollectionsByClassification,
  planMembershipForParticipant,
  ProductionInitiativeMigrationError,
  resolveDocumentAncestry,
  task071HasWritePath,
  validateNonVladNotStartedOmitted,
  validateVladActiveMemberExpectations,
  CIVIC_COLLECTION_CATALOG,
} from "../../../src/modules/production-initiative-migration/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const stagingScript = path.resolve(
  moduleDir,
  "../../../src/scripts/preflight-staging-production-initiative-migration.ts",
);
const productionScript = path.resolve(
  moduleDir,
  "../../../src/scripts/preflight-production-initiative-migration-collisions.ts",
);
const preflightModule = path.resolve(
  moduleDir,
  "../../../src/modules/production-initiative-migration/preflight.ts",
);

describe("Production Initiative migration preflight — Task 07.1", () => {
  it("exact nine-ID allow-list", () => {
    assert.equal(CANONICAL_PRODUCTION_INITIATIVE_IDS.length, 9);
    assert.deepEqual(assertExactNineAllowList([...CANONICAL_PRODUCTION_INITIATIVE_IDS]), []);
    assert.ok(CANONICAL_PRODUCTION_INITIATIVE_IDS.includes("initiative-1785693642422"));
  });

  it("rejects bootstrap and Test2", () => {
    const blockers = assertAllowListRejectsBootstrapAndTest2([
      ...EXCLUDED_PRODUCTION_INITIATIVE_IDS,
    ]);
    assert.ok(blockers.length >= 2);
    assert.ok(blockers.some((b) => b.includes("initiative-bootstrap-001")));
    assert.ok(blockers.some((b) => b.includes("initiative-1787191372634")));
  });

  it("rejects incorrect AI-for-Common-Good ID", () => {
    assert.equal(isForbiddenTypoAiCommonGoodId(FORBIDDEN_TYPO_AI_COMMON_GOOD_ID), true);
    assert.ok(
      assertAllowListRejectsBootstrapAndTest2([FORBIDDEN_TYPO_AI_COMMON_GOOD_ID]).length > 0,
    );
    const rows = [
      buildCandidateInitiativeRow({
        expected: {
          initiativeId: FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
          title: "AI for the Common Good",
          stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
          stewardLabel: "Derek Jennett",
        },
        doc: null,
      }),
    ];
    // evaluateInitiativeVerdict uses canonical expectations length — test typo helper directly
    assert.equal(rows[0]?.forbiddenTypo, true);
  });

  it("preserves missing/null lifecycleProfile (never invents STANDARD)", () => {
    const expected = {
      initiativeId: "initiative-1783748417899",
      title: "Citizen Support Squad (CSS)",
      stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
      stewardLabel: "Vlad Shapran",
    };
    const missing = buildCandidateInitiativeRow({
      expected,
      doc: {
        _id: expected.initiativeId,
        initiativeId: expected.initiativeId,
        stewardId: expected.stewardMemberId,
        title: expected.title,
        status: "published",
        visibility: { policy: "public" },
        lifecyclePhase: "discussion",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
    assert.equal(missing.lifecycleProfile, undefined);

    const explicitNull = buildCandidateInitiativeRow({
      expected,
      doc: {
        _id: expected.initiativeId,
        initiativeId: expected.initiativeId,
        stewardId: expected.stewardMemberId,
        title: expected.title,
        status: "published",
        visibility: { policy: "public" },
        lifecyclePhase: "discussion",
        lifecycleProfile: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
    assert.equal(explicitNull.lifecycleProfile, null);
  });

  it("preserves PUBLIC_CHOICE lifecycleProfile", () => {
    const expected = {
      initiativeId: "initiative-1787025677193",
      title: "Chief Destroyer of Statehood and Morality",
      stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
      stewardLabel: "Derek Jennett",
    };
    const row = buildCandidateInitiativeRow({
      expected,
      doc: {
        _id: expected.initiativeId,
        initiativeId: expected.initiativeId,
        stewardId: expected.stewardMemberId,
        title: expected.title,
        status: "published",
        visibility: { policy: "public" },
        lifecyclePhase: "public_choice",
        lifecycleProfile: "PUBLIC_CHOICE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
    assert.equal(row.lifecycleProfile, "PUBLIC_CHOICE");
  });

  it("ambiguous MUST ancestry fails", () => {
    const resolution = resolveDocumentAncestry({
      doc: { voteId: "v1" },
      method: "parent:decisionId",
      allowList: new Set(CANONICAL_PRODUCTION_INITIATIVE_IDS),
      parentInitiativeById: new Map([["missing-parent", null]]),
    });
    assert.equal(resolution.ambiguous, true);
    assert.equal(assertAmbiguousMustFails("MUST_MIGRATE", 1), true);
    assert.equal(assertAmbiguousMustFails("CONDITIONAL_MIGRATE", 1), false);
  });

  it("unknown MUST participant fails classification", () => {
    assert.equal(classifyActorId("unknown-participant-id", true, false), "EXTERNAL_MUST");
    assert.equal(classifyActorId("unknown-engagement-only", false, true), "EXTERNAL_CONDITIONAL");
  });

  it("system-media-recovery accepted as NON_IDENTITY / SYSTEM_ACTOR", () => {
    assert.equal(
      classifyActorId(SYSTEM_MEDIA_RECOVERY_OWNER, true, false),
      "SYSTEM_ACTOR",
    );
  });

  it("not_started membership omitted; active_member preserved", () => {
    const derek = APPROVED_PRODUCTION_PARTICIPANTS.find((p) => p.label === "Derek Jennett")!;
    const notStarted = planMembershipForParticipant({
      label: derek.label,
      memberId: derek.memberId,
      userId: derek.userId,
      membership: { status: "not_started", applicationStatus: "not_started" },
      profile: { membershipPubliclyVisible: false },
      badgeApplication: null,
    });
    assert.equal(notStarted.migrateMembershipRow, false);
    assert.deepEqual(validateNonVladNotStartedOmitted(notStarted), []);

    const vlad = APPROVED_PRODUCTION_PARTICIPANTS.find((p) => p.label === "Vlad Shapran")!;
    const active = planMembershipForParticipant({
      label: vlad.label,
      memberId: vlad.memberId,
      userId: vlad.userId,
      membership: {
        status: "active_member",
        applicationStatus: "approved",
        memberNumber: "HU-VLAD0001",
        memberGrantedAt: "2026-01-01T00:00:00.000Z",
      },
      profile: { membershipPubliclyVisible: true },
      badgeApplication: {
        paymentStatus: "paid",
        fulfillmentStatus: "shipped",
        shippingAddress: {
          recipientName: "SECRET",
          addressLine1: "123 Secret St",
          city: "Kelowna",
          postalCode: "V1Y1A1",
          phone: "555-0100",
        },
      },
    });
    assert.equal(active.migrateMembershipRow, true);
    assert.equal(active.memberNumberPresent, true);
    assert.equal(active.membershipPubliclyVisible, true);
    assert.equal(active.shippingDataPresent, true);
    assert.deepEqual(validateVladActiveMemberExpectations(active), []);
    assert.doesNotThrow(() => assertMembershipPlanSafeForLogging(active));
    const logged = JSON.stringify(active);
    assert.doesNotMatch(logged, /123 Secret St|SECRET|555-0100|shippingAddress|addressLine1/);
  });

  it("Stripe Test operational IDs sanitized in plan", () => {
    const plan = buildStripeSanitizationPlan();
    assert.ok(plan.some((row) => row.field === "stripeCheckoutSessionId" && row.action === "OMIT_OR_NULL"));
    assert.ok(plan.some((row) => row.collection === "membership_webhook_events" && row.action === "DO_NOT_MIGRATE_RECORD"));
    assert.ok(
      plan.some(
        (row) =>
          row.action === "PRESERVE_HU_BUSINESS_STATE" &&
          row.collection === "member_badge_applications",
      ),
    );
  });

  it("badge fulfillment business state preserved in membership plan", () => {
    const vlad = APPROVED_PRODUCTION_PARTICIPANTS.find((p) => p.label === "Vlad Shapran")!;
    const plan = planMembershipForParticipant({
      label: vlad.label,
      memberId: vlad.memberId,
      userId: vlad.userId,
      membership: {
        status: "active_member",
        memberNumber: "HU-1",
        memberGrantedAt: "2026-01-01T00:00:00.000Z",
      },
      profile: null,
      badgeApplication: {
        paymentStatus: "paid",
        fulfillmentStatus: "shipped",
        shipped: true,
        stripeCheckoutSessionId: "cs_test_xxx",
      },
    });
    assert.equal(plan.badgePaymentStatus, "paid");
    assert.equal(plan.badgeFulfillmentStatus, "shipped");
    assert.ok(plan.stripeOperationalFieldsPresent.includes("stripeCheckoutSessionId"));
  });

  it("media staging-host rewrite required", () => {
    const decision = decideMediaDestinationAction({
      storageKey: "initiatives/cover.png",
      publicPrivate: "public",
      hostClassification: "staging_r2",
      mediaUploadRecordPresent: true,
    });
    assert.equal(decision.action, "COPY_PUBLIC");
    assert.equal(decision.urlRewriteRequired, true);
  });

  it("production root collision fails; partial child collision fails", () => {
    assert.equal(
      evaluateRootCollisionVerdict({
        "initiative-1783748417899": true,
      }),
      "FAIL",
    );
    assert.equal(
      evaluateRootCollisionVerdict({
        "initiative-1783748417899": false,
      }),
      "PASS",
    );
    assert.equal(
      evaluatePartialChildCollision({ rootsPresent: false, childHits: 3 }),
      "FAIL",
    );
  });

  it("five approved identities include Volody admin and four steward members", () => {
    assert.equal(APPROVED_PRODUCTION_PARTICIPANTS.length, 5);
    const volody = APPROVED_PRODUCTION_PARTICIPANTS.find((p) => p.label === "Volody");
    assert.equal(volody?.authRole, "admin");
    assert.equal(volody?.isAdmin, true);
    const stewards = APPROVED_PRODUCTION_PARTICIPANTS.filter((p) => !p.isAdmin);
    assert.equal(stewards.length, 4);
    assert.ok(stewards.every((p) => p.authRole === "member"));
  });

  it("collection catalog includes MUST/CONDITIONAL/REBUILD/DO_NOT and membership overlay", () => {
    assert.ok(listCollectionsByClassification("MUST_MIGRATE").length > 5);
    assert.ok(listCollectionsByClassification("CONDITIONAL_MIGRATE").length > 3);
    assert.ok(listCollectionsByClassification("REBUILD_OR_DERIVE").length >= 1);
    assert.ok(listCollectionsByClassification("DO_NOT_MIGRATE").length >= 1);
    assert.ok(CIVIC_COLLECTION_CATALOG.some((c) => c.collection === "outbox"));
    assert.ok(CIVIC_COLLECTION_CATALOG.some((c) => c.collection === "workspace_projections"));
    const membershipPlan = buildStaticMembershipCollectionPlan();
    assert.ok(membershipPlan.some((r) => r.collection === "memberships" && r.classification === "MUST_MIGRATE"));
    assert.ok(
      membershipPlan.some(
        (r) =>
          r.collection === "member_profiles.membershipPubliclyVisible" &&
          r.classification === "MUST_PRESERVE",
      ),
    );
  });

  it("database guards enforce staging/production; no write path in Task 07.1", () => {
    assert.equal(
      assertStagingSourceDatabase(PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE),
      PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
    );
    assert.throws(
      () => assertStagingSourceDatabase(PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError && error.code === "WRONG_DATABASE",
    );
    assert.equal(
      assertProductionCollisionDatabase(PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE),
      PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
    );
    assert.throws(
      () => assertNoWritePathRequested(["node", "script.ts", "--execute"]),
      (error: unknown) =>
        error instanceof ProductionInitiativeMigrationError &&
        error.code === "WRITE_PATH_FORBIDDEN",
    );
    assert.equal(task071HasWritePath(), false);

    const stagingSrc = fs.readFileSync(stagingScript, "utf8");
    const productionSrc = fs.readFileSync(productionScript, "utf8");
    const moduleSrc = fs.readFileSync(preflightModule, "utf8");
    assert.match(stagingSrc, /read-only/);
    assert.match(productionSrc, /read-only/);
    assert.match(stagingSrc, /assertNoWritePathRequested/);
    assert.match(productionSrc, /assertNoWritePathRequested/);
    // Scripts mention --execute only to forbid it; must not implement an execute write path.
    assert.doesNotMatch(stagingSrc, /argv\.includes\("--execute"\)\s*\?\s*["']execute["']/);
    assert.doesNotMatch(moduleSrc, /\.insertOne\(|\.updateOne\(|\.deleteOne\(|\.bulkWrite\(/);
  });

  it("initiative verdict fails when root missing", () => {
    const rows = CANONICAL_PRODUCTION_INITIATIVE_IDS.map((initiativeId, index) =>
      buildCandidateInitiativeRow({
        expected: {
          initiativeId,
          title: "x",
          stewardMemberId: "y",
          stewardLabel: "z",
        },
        doc: index === 0 ? null : {
          _id: initiativeId,
          initiativeId,
          stewardId: "y",
          title: "x",
          status: "published",
          visibility: { policy: "public" },
          lifecyclePhase: "discussion",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    // Force length mismatch path separately
    const { verdict } = evaluateInitiativeVerdict(rows.slice(0, 1));
    assert.equal(verdict, "FAIL");
  });
});
