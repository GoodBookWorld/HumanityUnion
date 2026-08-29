import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_PRODUCTION_STEWARDS,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
  ProductionStewardBootstrapError,
  assertBootstrapTargetDatabase,
  assertBootstrapWriteGuards,
  isAllowedBootstrapTargetDatabase,
  isExecuteModeRequested,
  loadSourceStewardManifestFromFile,
  maskEmail,
  parseSourceStewardManifest,
  prepareStewardDocuments,
  resolveBootstrapMode,
  writeSourceStewardManifestFile,
  type SourceStewardIdentity,
  type SourceStewardManifest,
} from "../../../src/modules/production-steward-bootstrap/index.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(
  moduleDir,
  "../../../src/scripts/bootstrap-production-steward-identities.ts",
);
const exportScriptPath = path.resolve(
  moduleDir,
  "../../../src/scripts/export-staging-steward-bootstrap-manifest.ts",
);

function buildManifest(overrides: Partial<SourceStewardIdentity>[] = []): SourceStewardManifest {
  const identities: SourceStewardIdentity[] = APPROVED_PRODUCTION_STEWARDS.map((approved, index) => {
    const override = overrides[index] ?? {};
    return {
      label: approved.label,
      memberId: approved.memberId,
      userId: approved.userId,
      profileId: approved.profileId,
      email: `steward${index + 1}@example.test`,
      displayName: approved.label,
      publicName: approved.publicName,
      uniqueName: approved.uniqueName,
      languages: ["en"],
      sourcePasswordHash: `$2b$12$sourceHashMustNeverBeCopied${index}`,
      profile: {
        memberNumber: `HU-TEST${index}`,
        profileVisibility: "public",
        avatarUrl: `https://cdn.example.test/a${index}.png`,
      },
      ...override,
    };
  });
  return { version: 1, identities };
}

describe("Production steward bootstrap — guards & sanitization", () => {
  it("refuses wrong database names", () => {
    assert.equal(isAllowedBootstrapTargetDatabase("humanity_union_staging"), false);
    assert.equal(isAllowedBootstrapTargetDatabase("humanity_union_dev"), false);
    assert.equal(isAllowedBootstrapTargetDatabase(PRODUCTION_STEWARD_BOOTSTRAP_DATABASE), true);
    assert.throws(
      () => assertBootstrapTargetDatabase("humanity_union_staging"),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError && error.code === "WRONG_DATABASE",
    );
  });

  it("allows hu_test_* only with allowTestIsolation", () => {
    assert.equal(isAllowedBootstrapTargetDatabase("hu_test_abc"), false);
    assert.equal(
      isAllowedBootstrapTargetDatabase("hu_test_abc", { allowTestIsolation: true }),
      true,
    );
    assert.doesNotThrow(() =>
      assertBootstrapTargetDatabase("hu_test_abc", { allowTestIsolation: true }),
    );
  });

  it("missing confirmation refuses write", () => {
    assert.throws(
      () =>
        assertBootstrapWriteGuards({
          databaseName: PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
          execute: true,
          confirm: undefined,
        }),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "MISSING_CONFIRMATION" &&
        error.message.includes(PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG),
    );
  });

  it("dry-run is default without execute+confirm", () => {
    assert.equal(isExecuteModeRequested(["node", "script.ts"]), false);
    assert.equal(isExecuteModeRequested(["node", "script.ts", "--execute"]), true);
    assert.equal(resolveBootstrapMode({ execute: false, confirm: "YES" }), "dry-run");
    assert.equal(resolveBootstrapMode({ execute: true, confirm: "NO" }), "dry-run");
    assert.equal(
      resolveBootstrapMode({
        execute: true,
        confirm: PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
      }),
      "execute",
    );
  });

  it("parses and allow-lists manifest; preserves Leonardo/Munia legacy uniqueNames", () => {
    const manifest = parseSourceStewardManifest(buildManifest());
    assert.equal(manifest.identities.length, 4);
    const leonardo = manifest.identities.find((row) => row.label === "Leonardo");
    const munia = manifest.identities.find((row) => row.label === "Munia Khan");
    assert.equal(leonardo?.uniqueName, "michael-9cde6a4e");
    assert.equal(munia?.uniqueName, "isabella-2dfd0e");
    assert.equal(leonardo?.publicName, "leonardo-6a91cb");
    assert.equal(munia?.publicName, "munia-hhan");
  });

  it("rejects uniqueName drift in manifest", () => {
    const bad = buildManifest();
    bad.identities[1]!.uniqueName = "leonardo-corrected";
    assert.throws(
      () => parseSourceStewardManifest(bad),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "MANIFEST_ALLOWLIST_MISMATCH",
    );
  });

  it("refuses world-readable manifest files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-steward-manifest-"));
    const filePath = path.join(dir, "manifest.json");
    writeSourceStewardManifestFile(filePath, buildManifest());
    fs.chmodSync(filePath, 0o644);
    assert.throws(
      () => loadSourceStewardManifestFromFile(filePath),
      (error: unknown) =>
        error instanceof ProductionStewardBootstrapError &&
        error.code === "INSECURE_MANIFEST_PERMISSIONS",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("loads chmod 600 manifest and never exposes full email via mask helper", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-steward-manifest-"));
    const filePath = path.join(dir, "manifest.json");
    writeSourceStewardManifestFile(filePath, buildManifest());
    const loaded = loadSourceStewardManifestFromFile(filePath);
    assert.equal(loaded.identities[0]?.email, "steward1@example.test");
    assert.equal(maskEmail(loaded.identities[0]?.email), "st***@example.test");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prepares sanitized docs: new password hash, role member, pending verification, exact IDs", async () => {
    const prepared = await prepareStewardDocuments(buildManifest().identities);
    assert.equal(prepared.length, 4);

    for (const [index, steward] of prepared.entries()) {
      const approved = APPROVED_PRODUCTION_STEWARDS[index]!;
      assert.equal(steward.memberId, approved.memberId);
      assert.equal(steward.userId, approved.userId);
      assert.equal(steward.profileId, approved.profileId);
      assert.equal(steward.auth.userId, approved.userId);
      assert.equal(steward.auth.memberId, approved.memberId);
      assert.equal(steward.member.memberId, approved.memberId);
      assert.equal(steward.member.identityId, approved.userId);
      assert.equal(steward.member.uniqueName, approved.uniqueName);
      assert.equal(steward.profile.profileId, approved.profileId);
      assert.equal(steward.profile.publicName, approved.publicName);
      assert.equal(steward.auth.role, "member");
      assert.equal(steward.auth.status, "active");
      assert.equal(steward.auth.emailVerificationStatus, "pending");
      assert.equal("emailVerifiedAt" in steward.auth, false);
      assert.equal("lastLoginAt" in steward.auth, false);
      assert.equal("pendingEmail" in steward.auth, false);
      assert.equal(steward.member.roles[0], "member");
      assert.equal(steward.member.verificationLevel, "email");
      assert.equal(steward.member.registrationStatus, "registered");
      assert.equal(steward.profile.membershipPubliclyVisible, false);
      assert.equal(steward.profile.status, "active");
      assert.ok(steward.auth.passwordHash.startsWith("$2"));
      assert.notEqual(steward.auth.passwordHash, steward.discardedSourcePasswordHash);
      assert.ok(steward.emailMasked.includes("***"));
      assert.notEqual(steward.emailMasked, `steward${index + 1}@example.test`);
    }

    assert.equal(prepared[1]?.uniqueName, "michael-9cde6a4e");
    assert.equal(prepared[3]?.uniqueName, "isabella-2dfd0e");
  });

  it("script sources default to dry-run and never log URI/password material", () => {
    const source = fs.readFileSync(scriptPath, "utf8");
    assert.match(source, /DRY-RUN|dry-run/);
    assert.match(source, /PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM/);
    assert.match(source, /--execute/);
    assert.match(source, /assertNoSecretLeak/);
    assert.doesNotMatch(source, /console\.log\([^)]*MONGODB_URI/);
    assert.doesNotMatch(source, /console\.log\([^)]*passwordHash/);

    const exportSource = fs.readFileSync(exportScriptPath, "utf8");
    assert.match(exportSource, /chmod|0o600|0600/);
    assert.match(exportSource, /Full emails written to manifest file only/);
    assert.doesNotMatch(exportSource, /console\.log\([^)]*identity\.email/);
  });
});
