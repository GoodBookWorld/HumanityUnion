import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  buildMigrationPlan,
  computeBundleChecksum,
  computeFileChecksums,
  loadAndValidatePortableCivicSource,
  resolveRepoRoot,
  StagingDataMigrationError,
} from "../../../src/modules/staging-data-migration/index.js";
import {
  PORTABLE_BUNDLE_FILES,
  PORTABLE_CIVIC_SOURCE_RELATIVE_PATH,
} from "../../../src/modules/staging-data-migration/portable-source-bundle.js";
import type { MigrationSourceBundle } from "../../../src/modules/staging-data-migration/plan.js";
import type { SafeAuthShell } from "../../../src/modules/staging-data-migration/types.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(moduleDir);
const bundleDir = path.join(repoRoot, PORTABLE_CIVIC_SOURCE_RELATIVE_PATH);

function shell(
  partial: Partial<SafeAuthShell> & Pick<SafeAuthShell, "userId" | "memberId" | "email">,
): SafeAuthShell {
  return {
    displayName: partial.displayName ?? "User",
    role: partial.role ?? "member",
    status: partial.status ?? "active",
    emailVerificationStatus: partial.emailVerificationStatus ?? "pending",
    ...partial,
  };
}

describe("Staging Data Migration Pack 02A — portable civic source bundle", () => {
  it("contains exactly 5 approved Initiatives including Isabella", () => {
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    assert.equal(loaded.initiativesById.size, 5);
    assert.ok(loaded.initiativesById.has("initiative-1785948978037"));
    for (const approved of APPROVED_HISTORICAL_INITIATIVES) {
      const initiative = loaded.initiativesById.get(approved.initiativeId);
      assert.ok(initiative, approved.initiativeId);
      assert.equal(initiative.stewardId, approved.stewardMemberId);
      assert.equal(initiative.title, approved.title);
    }
  });

  it("preserves historical Vlad stewardship on CSS and Mind-Safe", () => {
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    const vladMemberId = APPROVED_HISTORICAL_PARTICIPANTS[0].memberId;
    assert.equal(
      loaded.initiativesById.get("initiative-1783748417899")?.stewardId,
      vladMemberId,
    );
    assert.equal(
      loaded.initiativesById.get("initiative-1784349613932")?.stewardId,
      vladMemberId,
    );
  });

  it("keeps all child artifacts under approved Initiative IDs with no orphans", () => {
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    const approved = new Set(APPROVED_HISTORICAL_INITIATIVES.map((i) => i.initiativeId));
    for (const record of [
      ...loaded.analyses,
      ...loaded.proposals,
      ...loaded.revisions,
      ...loaded.petitionDrafts,
    ]) {
      assert.ok(approved.has(String(record.initiativeId)));
    }
    assert.equal(loaded.manifest.artifactCounts.analyses, loaded.analyses.length);
    assert.equal(loaded.manifest.artifactCounts.improvementProposals, loaded.proposals.length);
    assert.equal(loaded.manifest.artifactCounts.revisions, loaded.revisions.length);
    assert.equal(loaded.manifest.artifactCounts.petitionDrafts, loaded.petitionDrafts.length);
  });

  it("excludes legacy civic roots and secrets", () => {
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    assert.deepEqual(loaded.manifest.legacyExcluded, [
      "activities",
      "discussions",
      "proposals",
      "decisions",
    ]);
    assert.equal(loaded.manifest.secretScan?.result, "PASS");
    const joined = JSON.stringify(loaded.manifest) + readFileSync(path.join(bundleDir, "initiatives.json"), "utf8");
    assert.doesNotMatch(joined, /passwordHash/);
    assert.doesNotMatch(joined, /mongodb(\+srv)?:\/\//i);
    assert.doesNotMatch(joined, /\/Users\//);
  });

  it("Render-style loader works without apps/api/.runtime", () => {
    assert.ok(!bundleDir.includes(`${path.sep}.runtime${path.sep}`));
    assert.match(bundleDir, /staging-data-source-v1$/);
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    assert.equal(loaded.manifest.pack, "STAGING_DATA_MIGRATION_PACK_02A");
  });

  it("fails when bundle is missing", () => {
    assert.throws(
      () => loadAndValidatePortableCivicSource(path.join(tmpdir(), "missing-hu-bundle")),
      StagingDataMigrationError,
    );
  });

  it("fails when checksum is tampered", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "hu-bundle-tamper-"));
    try {
      for (const fileName of [...PORTABLE_BUNDLE_FILES, "manifest.json"]) {
        copyFileSync(path.join(bundleDir, fileName), path.join(tempDir, fileName));
      }
      const initiativesPath = path.join(tempDir, "initiatives.json");
      const parsed = JSON.parse(readFileSync(initiativesPath, "utf8")) as {
        initiatives: Record<string, { title?: string }>;
      };
      const firstId = Object.keys(parsed.initiatives)[0];
      parsed.initiatives[firstId].title = `${parsed.initiatives[firstId].title} TAMPERED`;
      writeFileSync(initiativesPath, `${JSON.stringify(parsed, null, 2)}\n`);
      assert.throws(() => loadAndValidatePortableCivicSource(tempDir), /checksum mismatch/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("checksum helpers are deterministic", () => {
    const hashes = computeFileChecksums(bundleDir);
    const checksum = computeBundleChecksum(hashes);
    assert.equal(checksum, loadAndValidatePortableCivicSource(bundleDir).manifest.bundleChecksumSha256);
  });

  it("Pack 02 dry-run plan builds from Mongo identity stubs + portable civic bundle", () => {
    const loaded = loadAndValidatePortableCivicSource(bundleDir);
    const admin = shell({
      userId: "admin-user",
      memberId: "admin-member",
      email: "admin@huws.org",
      displayName: "Vlad",
      role: "admin",
    });
    const sourceAuthByMemberId = new Map<string, SafeAuthShell>();
    const sourceMembersById = new Map();
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

    const planInput: MigrationSourceBundle = {
      sourceDatabase: "humanity_union_dev",
      targetDatabase: "humanity_union_staging",
      fileRuntimePath: loaded.bundleDir,
      sourceAuthByMemberId,
      sourceMembersById,
      sourceProfilesByUserId: new Map(),
      sourceMembershipsByMemberId: new Map(),
      targetAuthByUserId: new Map([[admin.userId, admin]]),
      targetAuthByEmail: new Map([[admin.email, admin]]),
      targetAuthByMemberId: new Map([[admin.memberId, admin]]),
      targetMembersById: new Map(),
      targetProfilesByUserId: new Map(),
      targetMembershipsByMemberId: new Map(),
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
      fileInitiativesById: loaded.initiativesById,
      relatedCountsByInitiativeId: loaded.relatedCountsByInitiativeId,
      stagingAdmin: admin,
    };

    const plan = buildMigrationPlan(planInput);
    assert.equal(plan.conflicts.length, 0);
    assert.equal(plan.initiatives.length, 5);
    assert.ok(plan.initiatives.every((item) => item.action === "transform"));
    assert.ok(plan.relatedArtifacts.revisions >= 5);
  });
});
