/**
 * Pack 12C — Editor moderation provenance + precedence contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatModerationBlockLabel,
  resolveEffectiveModerationBlock,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12C — effective moderation resolver", () => {
  it("legacy Fix08 Admin block without authority resolves as ADMIN", () => {
    const resolved = resolveEffectiveModerationBlock({
      administrativelyBlocked: true,
      administrativelyBlockedAt: "2026-01-01T00:00:00.000Z",
      administrativelyBlockedByParticipantId: "member-admin",
    });
    assert.equal(resolved.isBlocked, true);
    if (resolved.isBlocked) {
      assert.equal(resolved.authority, "ADMIN");
    }
    assert.equal(
      formatModerationBlockLabel({ administrativelyBlocked: true }),
      "Blocked by administrator",
    );
  });

  it("EDITOR authority is preserved and labeled", () => {
    const resolved = resolveEffectiveModerationBlock({
      administrativelyBlocked: true,
      administrativeBlockAuthority: "EDITOR",
      administrativelyBlockedByParticipantId: "member-editor",
    });
    assert.equal(resolved.isBlocked, true);
    if (resolved.isBlocked) {
      assert.equal(resolved.authority, "EDITOR");
    }
    assert.equal(
      formatModerationBlockLabel({
        administrativelyBlocked: true,
        administrativeBlockAuthority: "EDITOR",
      }),
      "Blocked by editor",
    );
  });

  it("unblocked records resolve clear", () => {
    assert.deepEqual(resolveEffectiveModerationBlock({}), { isBlocked: false });
    assert.equal(formatModerationBlockLabel({}), null);
  });
});

describe("Pack 12C — capability + service wiring", () => {
  it("adds INITIATIVE_MODERATE and PUBLIC_CHOICE_MODERATE capability IDs", () => {
    const grant = readRepo("packages/types/src/domain/editor-grant.ts");
    assert.match(grant, /INITIATIVE_MODERATE/);
    assert.match(grant, /PUBLIC_CHOICE_MODERATE/);
    assert.match(grant, /Moderate Initiatives/);
    assert.match(grant, /Moderate Public Choice/);
  });

  it("Editor moderation service sets EDITOR authority and refuses Admin blocks", () => {
    const service = readRepo("apps/api/src/modules/editor-grants/editor-moderation.service.ts");
    assert.match(service, /administrativeBlockAuthority: "EDITOR"/);
    assert.match(service, /MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE/);
    assert.match(service, /editor\.moderation\.block/);
    assert.match(service, /editor\.moderation\.unblock/);
    assert.match(service, /INITIATIVE_MODERATE/);
    assert.match(service, /PUBLIC_CHOICE_MODERATE/);
    assert.doesNotMatch(service, /administrativeBlockAuthority: "ADMIN"/);
  });

  it("Admin block upgrades EDITOR block and sets ADMIN authority", () => {
    const admin = readRepo(
      "apps/api/src/modules/administration/admin-initiative-moderation.service.ts",
    );
    assert.match(admin, /administrativeBlockAuthority: "ADMIN"/);
    assert.match(admin, /existing\.authority === "ADMIN"/);
    assert.match(admin, /upgrades effective authority to ADMIN/);
  });

  it("Media/Country remain activate/deactivate without Block inventing", () => {
    const panel = readRepo("apps/api/src/modules/editor-grants/editor-panel.service.ts");
    assert.match(panel, /moderationSupported: false/);
    assert.match(panel, /MEDIA_RESOURCE_EDIT/);
    assert.match(panel, /COUNTRY_PEOPLE_EDIT/);
  });
});
