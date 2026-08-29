import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_PRODUCTION_ADMIN,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  ProductionAdminBootstrapError,
  assertAdminBootstrapTargetDatabase,
  assertAdminBootstrapWriteGuards,
  isAllowedAdminBootstrapTargetDatabase,
  isExecuteModeRequested,
  loadSourceAdminManifestFromFile,
  maskEmail,
  parseSourceAdminManifest,
  prepareAdminDocuments,
  resolveAdminBootstrapMode,
  writeSourceAdminManifestFile,
  type SourceAdminIdentity,
  type SourceAdminManifest,
} from "../../../src/modules/production-admin-bootstrap/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(
  moduleDir,
  "../../../src/scripts/bootstrap-production-admin-identity.ts",
);
const exportScriptPath = path.resolve(
  moduleDir,
  "../../../src/scripts/export-staging-admin-bootstrap-manifest.ts",
);
const verifyScriptPath = path.resolve(
  moduleDir,
  "../../../src/scripts/verify-production-admin-identity.ts",
);

function buildManifest(overrides: Partial<SourceAdminIdentity> = {}): SourceAdminManifest {
  const identity: SourceAdminIdentity = {
    label: APPROVED_PRODUCTION_ADMIN.label,
    memberId: APPROVED_PRODUCTION_ADMIN.memberId,
    userId: APPROVED_PRODUCTION_ADMIN.userId,
    profileId: APPROVED_PRODUCTION_ADMIN.profileId,
    email: "volody-admin@example.test",
    displayName: APPROVED_PRODUCTION_ADMIN.displayName,
    publicName: APPROVED_PRODUCTION_ADMIN.publicName,
    uniqueName: APPROVED_PRODUCTION_ADMIN.uniqueName,
    authRole: "admin",
    languages: ["en"],
    sourcePasswordHash: "$2b$12$stagingHashMustNeverBeCopiedXXXX",
    profile: {
      memberNumber: "HU-VOLODY1",
      profileVisibility: "public",
      membershipPubliclyVisible: false,
    },
    ...overrides,
  };
  return { version: 1, identities: [identity] };
}

describe("Production Admin bootstrap — guards & sanitization", () => {
  it("refuses wrong database names", () => {
    assert.equal(isAllowedAdminBootstrapTargetDatabase("humanity_union_staging"), false);
    assert.equal(isAllowedAdminBootstrapTargetDatabase("humanity_union_dev"), false);
    assert.equal(isAllowedAdminBootstrapTargetDatabase(PRODUCTION_ADMIN_BOOTSTRAP_DATABASE), true);
    assert.throws(
      () => assertAdminBootstrapTargetDatabase("humanity_union_staging"),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError && error.code === "WRONG_DATABASE",
    );
  });

  it("allows hu_test_* only with allowTestIsolation", () => {
    assert.equal(isAllowedAdminBootstrapTargetDatabase("hu_test_abc"), false);
    assert.equal(
      isAllowedAdminBootstrapTargetDatabase("hu_test_abc", { allowTestIsolation: true }),
      true,
    );
  });

  it("missing steward confirmation refuses write", () => {
    assert.throws(
      () =>
        assertAdminBootstrapWriteGuards({
          databaseName: PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
          execute: true,
          confirm: undefined,
          adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "MISSING_CONFIRMATION" &&
        error.message.includes(PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG),
    );
  });

  it("missing Admin confirmation refuses write", () => {
    assert.throws(
      () =>
        assertAdminBootstrapWriteGuards({
          databaseName: PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
          execute: true,
          confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
          adminConfirm: undefined,
        }),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "MISSING_ADMIN_CONFIRMATION" &&
        error.message.includes(PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG),
    );
  });

  it("dry-run is default without execute+dual confirm", () => {
    assert.equal(isExecuteModeRequested(["node", "script.ts"]), false);
    assert.equal(isExecuteModeRequested(["node", "script.ts", "--execute"]), true);
    assert.equal(
      resolveAdminBootstrapMode({
        execute: true,
        confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
        adminConfirm: "NO",
      }),
      "dry-run",
    );
    assert.equal(
      resolveAdminBootstrapMode({
        execute: true,
        confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
        adminConfirm: PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
      }),
      "execute",
    );
  });

  it("parses Volody allow-list manifest with explicit authRole admin", () => {
    const manifest = parseSourceAdminManifest(buildManifest());
    assert.equal(manifest.identities.length, 1);
    assert.equal(manifest.identities[0]?.authRole, "admin");
    assert.equal(manifest.identities[0]?.publicName, "@volody");
    assert.equal(manifest.identities[0]?.uniqueName, "vlad-6038da");
  });

  it("rejects wrong identity even with authRole admin", () => {
    const bad = buildManifest({
      memberId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    assert.throws(
      () => parseSourceAdminManifest(bad),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "ADMIN_ALLOWLIST_MISMATCH",
    );
  });

  it("rejects missing authRole admin (never infer from displayName)", () => {
    const raw = {
      version: 1,
      identities: [
        {
          label: "Volody",
          memberId: APPROVED_PRODUCTION_ADMIN.memberId,
          userId: APPROVED_PRODUCTION_ADMIN.userId,
          profileId: APPROVED_PRODUCTION_ADMIN.profileId,
          email: "volody@example.test",
          displayName: "Volody",
          publicName: "@volody",
          uniqueName: "vlad-6038da",
          // authRole omitted — must not infer admin
        },
      ],
    };
    assert.throws(
      () => parseSourceAdminManifest(raw),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError && error.code === "INVALID_ADMIN_ROLE",
    );
  });

  it("rejects displayName lookalike with wrong IDs", () => {
    const bad = buildManifest({
      memberId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      profileId: "33333333-3333-3333-3333-333333333333",
      displayName: "Volody",
      publicName: "@volody",
      uniqueName: "vlad-6038da",
    });
    assert.throws(
      () => parseSourceAdminManifest(bad),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "ADMIN_ALLOWLIST_MISMATCH",
    );
  });

  it("refuses world-readable manifest files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-admin-manifest-"));
    const filePath = path.join(dir, "manifest.json");
    writeSourceAdminManifestFile(filePath, buildManifest());
    fs.chmodSync(filePath, 0o644);
    assert.throws(
      () => loadSourceAdminManifestFromFile(filePath),
      (error: unknown) =>
        error instanceof ProductionAdminBootstrapError &&
        error.code === "INSECURE_MANIFEST_PERMISSIONS",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prepares sanitized docs: role=admin, members.roles=[member], fresh hash, pending verification", async () => {
    const prepared = await prepareAdminDocuments(buildManifest().identities[0]!);
    assert.equal(prepared.auth.role, "admin");
    assert.equal(prepared.auth.status, "active");
    assert.equal(prepared.auth.emailVerificationStatus, "pending");
    assert.equal("emailVerifiedAt" in prepared.auth, false);
    assert.equal("lastLoginAt" in prepared.auth, false);
    assert.equal("pendingEmail" in prepared.auth, false);
    assert.deepEqual(prepared.member.roles, ["member"]);
    assert.equal(prepared.member.identityId, APPROVED_PRODUCTION_ADMIN.userId);
    assert.equal(prepared.member.uniqueName, "vlad-6038da");
    assert.equal(prepared.profile.publicName, "@volody");
    assert.equal(prepared.profile.displayName, "Volody");
    assert.equal(prepared.auth.displayName, "Volody");
    assert.ok(prepared.auth.passwordHash.startsWith("$2"));
    assert.notEqual(prepared.auth.passwordHash, prepared.discardedSourcePasswordHash);
    assert.equal(prepared.discardedSourcePasswordHash, "$2b$12$stagingHashMustNeverBeCopiedXXXX");
    assert.ok(prepared.emailMasked.includes("***"));
    assert.notEqual(prepared.emailMasked, "volody-admin@example.test");
    assert.equal(maskEmail("volody-admin@example.test"), "vo***@example.test");
  });

  it("scripts default to dry-run and never log URI/password material", () => {
    const bootstrap = fs.readFileSync(scriptPath, "utf8");
    const exportSrc = fs.readFileSync(exportScriptPath, "utf8");
    const verifySrc = fs.readFileSync(verifyScriptPath, "utf8");
    assert.match(bootstrap, /DRY-RUN|dry-run/);
    assert.match(bootstrap, /PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM/);
    assert.match(bootstrap, /assertNoSecretLeak/);
    assert.match(exportSrc, /sourcePasswordHashExported: false/);
    assert.match(verifySrc, /NON_IDENTITY/);
    assert.doesNotMatch(bootstrap, /mongodb(\+srv)?:\/\//i);
  });
});
