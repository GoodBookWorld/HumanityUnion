import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT,
  EXPECTED_TARGET_PARTICIPANT_COUNT,
  LEGACY_EXCLUDED_COLLECTIONS,
  STAGING_DATA_MIGRATION_FLAG,
  assertStagingDataMigrationDatabasePair,
  assertStagingDataMigrationExecuteGuards,
  buildMigrationPlan,
  isAllowedMigrationTargetDatabase,
  isExecuteModeRequested,
  shouldMergeByDisplayName,
  StagingDataMigrationError,
  validatePack01Manifest,
  resolveRepoRoot,
} from "../../../src/modules/staging-data-migration/index.js";
import type { MigrationSourceBundle } from "../../../src/modules/staging-data-migration/plan.js";
import type { SafeAuthShell } from "../../../src/modules/staging-data-migration/types.js";
import { listForbiddenWriteMarkers } from "../../../src/modules/staging-data-migration/execute.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(moduleDir, "../../../src/scripts/migrate-staging-historical-data.ts");
const executePath = path.resolve(
  moduleDir,
  "../../../src/modules/staging-data-migration/execute.ts",
);

function shell(partial: Partial<SafeAuthShell> & Pick<SafeAuthShell, "userId" | "memberId" | "email">): SafeAuthShell {
  return {
    displayName: partial.displayName ?? "User",
    role: partial.role ?? "member",
    status: partial.status ?? "active",
    emailVerificationStatus: partial.emailVerificationStatus ?? "pending",
    ...partial,
  };
}

function emptyBundle(overrides: Partial<MigrationSourceBundle> = {}): MigrationSourceBundle {
  return {
    sourceDatabase: APPROVED_SOURCE_DATABASE,
    targetDatabase: APPROVED_TARGET_DATABASE,
    fileRuntimePath: "apps/api/.runtime",
    sourceAuthByMemberId: new Map(),
    sourceMembersById: new Map(),
    sourceProfilesByUserId: new Map(),
    sourceMembershipsByMemberId: new Map(),
    targetAuthByUserId: new Map(),
    targetAuthByEmail: new Map(),
    targetAuthByMemberId: new Map(),
    targetMembersById: new Map(),
    targetProfilesByUserId: new Map(),
    targetMembershipsByMemberId: new Map(),
    targetInitiativesById: new Map(),
    fileInitiativesById: new Map(),
    relatedCountsByInitiativeId: new Map(),
    stagingAdmin: null,
    ...overrides,
  };
}

describe("Staging Data Migration Pack 02 — guards & contracts", () => {
  const validExecute = {
    NODE_ENV: "production",
    PLATFORM_MODE: "staging",
    ALLOW_STAGING_DATA_MIGRATION: "true",
    sourceDatabase: APPROVED_SOURCE_DATABASE,
    targetDatabase: APPROVED_TARGET_DATABASE,
    execute: true,
  };

  it("dry-run default: execute flag required for writes", () => {
    assert.equal(isExecuteModeRequested(["node", "script.ts"]), false);
    assert.equal(isExecuteModeRequested(["node", "script.ts", "--execute"]), true);
    assert.throws(
      () => assertStagingDataMigrationExecuteGuards({ ...validExecute, execute: false }),
      StagingDataMigrationError,
    );
  });

  it("requires ALLOW_STAGING_DATA_MIGRATION=true for execute", () => {
    assert.throws(
      () =>
        assertStagingDataMigrationExecuteGuards({
          ...validExecute,
          ALLOW_STAGING_DATA_MIGRATION: undefined,
        }),
      (error: unknown) =>
        error instanceof StagingDataMigrationError &&
        error.message.includes(STAGING_DATA_MIGRATION_FLAG),
    );
  });

  it("requires staging platform guards", () => {
    assert.throws(
      () => assertStagingDataMigrationExecuteGuards({ ...validExecute, NODE_ENV: "development" }),
      StagingDataMigrationError,
    );
    assert.throws(
      () => assertStagingDataMigrationExecuteGuards({ ...validExecute, PLATFORM_MODE: "production" }),
      StagingDataMigrationError,
    );
  });

  it("rejects wrong target DB and source=target", () => {
    assert.equal(isAllowedMigrationTargetDatabase("humanity_union_dev"), false);
    assert.equal(isAllowedMigrationTargetDatabase("unknown_db"), false);
    assert.equal(isAllowedMigrationTargetDatabase(APPROVED_TARGET_DATABASE), true);
    assert.throws(
      () =>
        assertStagingDataMigrationDatabasePair({
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: APPROVED_SOURCE_DATABASE,
        }),
      /source database must not equal target/,
    );
    assert.throws(
      () =>
        assertStagingDataMigrationDatabasePair({
          sourceDatabase: APPROVED_SOURCE_DATABASE,
          targetDatabase: "humanity_union_production",
        }),
      StagingDataMigrationError,
    );
  });

  it("allows hu_test_* targets only under NODE_TEST_ENV", () => {
    assert.equal(isAllowedMigrationTargetDatabase("hu_test_pack02"), false);
    assert.equal(
      isAllowedMigrationTargetDatabase("hu_test_pack02", { nodeTestEnv: true }),
      true,
    );
  });

  it("script defaults to dry-run and never logs connection strings", () => {
    const source = readFileSync(scriptPath, "utf8");
    assert.match(source, /dry-run|DRY RUN/);
    assert.match(source, /ALLOW_STAGING_DATA_MIGRATION/);
    assert.match(source, /--execute/);
    assert.match(source, /credentials.*redacted/i);
    assert.doesNotMatch(source, /console\.log\([^)]*MONGODB_URI/);
    assert.doesNotMatch(source, /console\.log\([^)]*config\.uri/);
  });

  it("execute path avoids forbidden bulk mutators", () => {
    const source = readFileSync(executePath, "utf8");
    for (const marker of listForbiddenWriteMarkers()) {
      if (marker === "drop(") {
        assert.doesNotMatch(source, /\.drop\(/);
        continue;
      }
      assert.doesNotMatch(source, new RegExp(`\\.${marker}\\(`));
    }
    assert.doesNotMatch(source, /MONGO_COLLECTIONS\.authSessions/);
    assert.doesNotMatch(source, /collection\(["']auth_sessions["']\)/);
    assert.match(source, /migration-reset-required/);
  });
});

describe("Staging Data Migration Pack 02 — identity & initiative planning", () => {
  it("protects staging admin and keeps historical Vlad separate", () => {
    const admin = shell({
      userId: "admin-user",
      memberId: "admin-member",
      email: "sh***@huws.org".replace("***", "admin"),
      displayName: "Vlad",
      role: "admin",
    });
    // Use a realistic masked-unrelated email for the test shell
    admin.email = "admin@huws.org";

    const historicalVlad = shell({
      userId: "hist-vlad-user",
      memberId: APPROVED_HISTORICAL_PARTICIPANTS[0].memberId,
      email: "historical.vlad@gmail.com",
      displayName: "Vlad",
      role: "member",
    });

    assert.equal(
      shouldMergeByDisplayName("Vlad", "Vlad", admin.email, historicalVlad.email),
      false,
    );

    const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
    const sourceMembersById = new Map();
    const sourceProfilesByUserId = new Map();
    const fileInitiativesById = new Map();
    const relatedCountsByInitiativeId = new Map();

    for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
      const auth =
        participant.key === "historical_vlad_gmail"
          ? historicalVlad
          : shell({
              userId: `${participant.key}-user`,
              memberId: participant.memberId,
              email: `${participant.key}@gmail.com`,
              displayName: participant.displayName,
            });
      sourceAuthByMemberId.set(participant.memberId, auth);
      sourceMembersById.set(participant.memberId, { memberId: participant.memberId });
      sourceProfilesByUserId.set(auth.userId, {
        profileId: `${participant.key}-profile`,
        userId: auth.userId,
        displayName: auth.displayName,
      });
    }

    for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
      fileInitiativesById.set(initiative.initiativeId, {
        initiativeId: initiative.initiativeId,
        title: initiative.title,
        stewardId: initiative.stewardMemberId,
      });
      relatedCountsByInitiativeId.set(initiative.initiativeId, {
        analyses: initiative.initiativeId === "initiative-1783748417899" ? 2 : 0,
        proposals: initiative.initiativeId === "initiative-1783748417899" ? 3 : 0,
        revisions: 1,
        petitionDrafts: initiative.initiativeId === "initiative-1784349613932" ? 1 : 0,
      });
    }

    const plan = buildMigrationPlan(
      emptyBundle({
        stagingAdmin: admin,
        targetAuthByUserId: new Map([[admin.userId, admin]]),
        targetAuthByEmail: new Map([[admin.email, admin]]),
        targetAuthByMemberId: new Map([[admin.memberId, admin]]),
        sourceAuthByMemberId,
        sourceMembersById,
        sourceProfilesByUserId,
        fileInitiativesById,
        relatedCountsByInitiativeId,
        targetInitiativesById: new Map([
          [
            "initiative-bootstrap-001",
            {
              initiativeId: "initiative-bootstrap-001",
              title: "Community Garden Initiative",
              stewardId: "member-bootstrap-001",
            },
          ],
        ]),
      }),
    );

    assert.equal(plan.stagingAdmin.protected, true);
    assert.equal(plan.participants.length, 4);
    assert.equal(plan.initiatives.length, 5);
    assert.equal(EXPECTED_TARGET_PARTICIPANT_COUNT, 5);
    assert.equal(EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT, 5);

    const histVlad = plan.participants.find((p) => p.key === "historical_vlad_gmail");
    assert.ok(histVlad);
    assert.equal(histVlad.classification, "SEPARATE_PARTICIPANT");
    assert.notEqual(histVlad.action, "conflict");

    const isabellaInitiative = plan.initiatives.find(
      (i) => i.initiativeId === "initiative-1785948978037",
    );
    assert.ok(isabellaInitiative);
    assert.equal(isabellaInitiative.action, "transform");
    assert.equal(isabellaInitiative.stewardMemberId, APPROVED_HISTORICAL_PARTICIPANTS[3].memberId);

    for (const initiative of plan.initiatives) {
      if (initiative.title.includes("CSS") || initiative.title.includes("Mind-Safe")) {
        assert.equal(initiative.stewardMemberId, historicalVlad.memberId);
        assert.notEqual(initiative.stewardMemberId, admin.memberId);
      }
    }

    assert.deepEqual([...LEGACY_EXCLUDED_COLLECTIONS], [
      "activities",
      "discussions",
      "proposals",
      "decisions",
    ]);
    assert.equal(plan.excludedLegacy.activities, true);
    assert.equal(plan.conflicts.length, 0);
  });

  it("fails safely on partial target inconsistency (same email different userId)", () => {
    const admin = shell({
      userId: "admin-user",
      memberId: "admin-member",
      email: "admin@huws.org",
      displayName: "Vlad",
      role: "admin",
    });
    const source = shell({
      userId: "hist-user",
      memberId: APPROVED_HISTORICAL_PARTICIPANTS[1].memberId,
      email: "michael@gmail.com",
      displayName: "Michael",
    });
    const colliding = shell({
      userId: "other-user",
      memberId: "other-member",
      email: "michael@gmail.com",
      displayName: "Michael",
    });

    const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
    const sourceMembersById = new Map();
    const fileInitiativesById = new Map();
    for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
      const auth =
        participant.key === "michael"
          ? source
          : shell({
              userId: `${participant.key}-user`,
              memberId: participant.memberId,
              email: `${participant.key}@gmail.com`,
              displayName: participant.displayName,
            });
      sourceAuthByMemberId.set(participant.memberId, auth);
      sourceMembersById.set(participant.memberId, { memberId: participant.memberId });
    }
    for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
      fileInitiativesById.set(initiative.initiativeId, {
        initiativeId: initiative.initiativeId,
        title: initiative.title,
        stewardId: initiative.stewardMemberId,
      });
    }

    const plan = buildMigrationPlan(
      emptyBundle({
        stagingAdmin: admin,
        sourceAuthByMemberId,
        sourceMembersById,
        fileInitiativesById,
        targetAuthByEmail: new Map([["michael@gmail.com", colliding]]),
        targetAuthByUserId: new Map([[colliding.userId, colliding]]),
        targetAuthByMemberId: new Map([[colliding.memberId, colliding]]),
      }),
    );

    const michael = plan.participants.find((p) => p.key === "michael");
    assert.equal(michael?.action, "conflict");
    assert.ok(plan.conflicts.length > 0);
  });

  it("skips duplicate Initiative IDs safely when steward/title match", () => {
    const admin = shell({
      userId: "admin-user",
      memberId: "admin-member",
      email: "admin@huws.org",
      role: "admin",
      displayName: "Admin",
    });
    const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
    const sourceMembersById = new Map();
    const fileInitiativesById = new Map();
    const targetInitiativesById = new Map();

    for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
      const auth = shell({
        userId: `${participant.key}-user`,
        memberId: participant.memberId,
        email: `${participant.key}@gmail.com`,
        displayName: participant.displayName,
      });
      sourceAuthByMemberId.set(participant.memberId, auth);
      sourceMembersById.set(participant.memberId, { memberId: participant.memberId });
    }
    for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
      const record = {
        initiativeId: initiative.initiativeId,
        title: initiative.title,
        stewardId: initiative.stewardMemberId,
      };
      fileInitiativesById.set(initiative.initiativeId, record);
      targetInitiativesById.set(initiative.initiativeId, record);
    }

    const plan = buildMigrationPlan(
      emptyBundle({
        stagingAdmin: admin,
        sourceAuthByMemberId,
        sourceMembersById,
        fileInitiativesById,
        targetInitiativesById,
      }),
    );

    assert.ok(plan.initiatives.every((i) => i.action === "skip_existing"));
  });

  it("synthesizes Member when source auth exists without member row", () => {
    const admin = shell({
      userId: "admin-user",
      memberId: "admin-member",
      email: "admin@huws.org",
      displayName: "Vlad",
      role: "admin",
    });
    const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
    const sourceMembersById = new Map();
    const fileInitiativesById = new Map();

    for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
      const auth = shell({
        userId: `${participant.key}-user`,
        memberId: participant.memberId,
        email: `${participant.key}@gmail.com`,
        displayName: participant.displayName,
      });
      sourceAuthByMemberId.set(participant.memberId, auth);
      // Intentionally omit members for historical Vlad + Michael
      if (participant.key === "derek" || participant.key === "isabella") {
        sourceMembersById.set(participant.memberId, { memberId: participant.memberId });
      }
    }
    for (const initiative of APPROVED_HISTORICAL_INITIATIVES) {
      fileInitiativesById.set(initiative.initiativeId, {
        initiativeId: initiative.initiativeId,
        title: initiative.title,
        stewardId: initiative.stewardMemberId,
      });
    }

    const plan = buildMigrationPlan(
      emptyBundle({
        stagingAdmin: admin,
        sourceAuthByMemberId,
        sourceMembersById,
        fileInitiativesById,
      }),
    );

    const histVlad = plan.participants.find((p) => p.key === "historical_vlad_gmail");
    const michael = plan.participants.find((p) => p.key === "michael");
    assert.equal(histVlad?.memberAction, "transform");
    assert.equal(michael?.memberAction, "transform");
    assert.equal(plan.conflicts.length, 0);
  });

  it("validates Pack 01 manifest with Pack 02 decisions", () => {
    const repoRoot = resolveRepoRoot(moduleDir);
    const result = validatePack01Manifest(repoRoot);
    assert.equal(result.ok, true);
    assert.equal(result.pack02DecisionsPresent, true);
  });
});
