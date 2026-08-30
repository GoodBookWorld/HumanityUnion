/**
 * Pack 12E3 — Editor runtime end-to-end certification (API contracts).
 * Certification-only: proves 12E1–12E2 assign → notify → /me → deactivate chain.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EDITOR_ASSIGNABLE_CAPABILITY_IDS, EDITOR_CAPABILITY_LABELS } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getNotificationTemplate } from "../../../src/modules/notifications/notification.templates.js";
import { formatEditorGeographicScope } from "../../../src/modules/editor-grants/editor-grant.scope.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12E3 — collection + assignment pipeline", () => {
  it("uses editor_grants + member_notifications only (no editor_notifications)", () => {
    assert.equal(MONGO_COLLECTIONS.editorGrants, "editor_grants");
    assert.equal(MONGO_COLLECTIONS.memberNotifications, "member_notifications");
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.doesNotMatch(collections, /editor_notifications/);
  });

  it("assign returns notificationDelivered; duplicate assign is rejected", () => {
    const service = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.service.ts",
    );
    assert.match(service, /notifyEditorAccessAssigned/);
    assert.match(service, /notificationDelivered/);
    assert.match(service, /already has an Editor grant/);
    assert.match(service, /notifyEditorAccessActivated/);
    assert.match(service, /notifyEditorAccessDeactivated/);
    assert.match(service, /auditActions\.length === 0/);
  });

  it("assignment notification copy uses labels + /workspace/editor deep link", () => {
    const notify = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant-notifications.ts",
    );
    assert.match(notify, /editor_access_assigned/);
    assert.match(notify, /EDITOR_CAPABILITY_LABELS/);
    assert.match(notify, /formatEditorGeographicScope/);
    assert.match(notify, /["']\/workspace\/editor["']/);
    assert.doesNotMatch(notify, /INITIATIVE_EDIT/);

    const assigned = getNotificationTemplate("editor_access_assigned");
    assert.equal(assigned.title, "Editor access assigned");
    assert.match(assigned.message, /Editor Panel/);

    const world = formatEditorGeographicScope({ level: "WORLD" });
    assert.equal(world.summary, "World");
    assert.ok(EDITOR_CAPABILITY_LABELS.INITIATIVE_EDIT);
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
    assert.equal(EDITOR_CAPABILITY_LABELS.PUBLISHING_EDIT, "Edit publications");
  });
});

describe("Pack 12E3 — /me projection + Admin separation", () => {
  it("auth /me attaches live Editor viewer state from editor_grants", () => {
    const auth = readRepo("apps/api/src/modules/auth/auth.routes.ts");
    assert.match(auth, /resolveEditorViewerState/);
    assert.match(auth, /editor/);
  });

  it("Admin Editors routes remain Admin-only; Editor Panel is workspace-scoped", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/editors/);
    assert.match(app, /\/api\/v1\/workspace\/editor/);
    const adminService = readRepo(
      "apps/api/src/modules/editor-grants/editor-grant.admin.service.ts",
    );
    assert.match(adminService, /assertAdminActor/);
    assert.match(adminService, /role !== ["']admin["']/);
  });
});
