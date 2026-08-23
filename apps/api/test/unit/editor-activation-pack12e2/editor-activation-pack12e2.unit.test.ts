/**
 * Pack 12E2 — Editor assignment notification + Workspace activation (API).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12E2 — notification + projection contracts", () => {
  it("reuses member_notifications; does not invent editor_notifications", () => {
    assert.equal(MONGO_COLLECTIONS.memberNotifications, "member_notifications");
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.doesNotMatch(collections, /editor_notifications/);
    assert.match(
      readRepo("apps/api/src/modules/editor-grants/editor-grant-notifications.ts"),
      /createNotification/,
    );
    assert.match(
      readRepo("apps/api/src/modules/editor-grants/editor-grant-notifications.ts"),
      /relatedUrl:\s*EDITOR_PANEL_URL|["']\/workspace\/editor["']/,
    );
  });

  it("assignment/activation/deactivation/update emit notifications best-effort", () => {
    const service = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.service.ts",
    );
    assert.match(service, /notifyEditorAccessAssigned/);
    assert.match(service, /notifyEditorAccessActivated/);
    assert.match(service, /notifyEditorAccessDeactivated/);
    assert.match(service, /notifyEditorPermissionsUpdated/);
    assert.match(service, /notifyEditorEditingAreaUpdated/);
    assert.match(service, /notificationDelivered/);
    assert.match(service, /AdminEditorMutationResult/);
  });

  it("uses human capability labels and geographic formatter in notification copy", () => {
    const notify = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant-notifications.ts",
    );
    assert.match(notify, /EDITOR_CAPABILITY_LABELS/);
    assert.match(notify, /formatEditorGeographicScope/);
    assert.doesNotMatch(notify, /INITIATIVE_EDIT/);
    assert.match(notify, /editor_access_assigned/);
  });

  it("auth /me resolves Editor from editor_grants (not JWT)", () => {
    const auth = readRepo("apps/api/src/modules/auth/auth.routes.ts");
    assert.match(auth, /resolveEditorViewerState/);
    assert.match(auth, /editor_grants|editor-grant\.admin\.service/);
  });
});
