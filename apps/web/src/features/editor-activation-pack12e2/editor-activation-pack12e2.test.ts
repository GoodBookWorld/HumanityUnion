/**
 * Pack 12E2 — Editor notification deep-link + Workspace nav refresh (web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isEligibleForEditorPanel } from "../administration/editor-panel-eligibility";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

const authoring = { href: "/workspace/authoring", label: "Become an Author" };

describe("Pack 12E2 — Workspace activation without logout", () => {
  it("WorkspaceNavigation refreshes /me on route, visibility, and grant events", () => {
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /getMe\(\)/);
    assert.match(nav, /AUTH_STATE_CHANGED_EVENT/);
    assert.match(nav, /EDITOR_GRANT_CHANGED_EVENT/);
    assert.match(nav, /visibilitychange/);
    assert.match(nav, /pathname, refreshAuthority/);
    assert.match(nav, /isEligibleForEditorPanel/);
  });

  it("EditorAccessGate re-checks live /me authority", () => {
    const gate = readWeb("features/administration/components/EditorAccessGate.tsx");
    assert.match(gate, /getMe\(\)/);
    assert.match(gate, /EDITOR_GRANT_CHANGED_EVENT/);
    assert.match(gate, /isEligibleForEditorPanel/);
    assert.match(gate, /active Editors only/);
  });

  it("Admin assign success reports notification delivery honestly", () => {
    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /notificationDelivered/);
    assert.match(form, /Notification sent/);
    assert.match(form, /Notification could not be delivered/);
    assert.match(form, /notify=/);
  });

  it("ACTIVE Editor nav includes Editor Panel; Admin Panel stays separate", () => {
    const groups = buildWorkspaceNavGroups(authoring, null, {
      showEditorPanel: true,
      showAdminPanel: false,
    });
    assert.ok(
      groups
        .find((group) => group.id === "workspace")
        ?.routes.some((route) => route.href === "/workspace/editor"),
    );
    assert.equal(
      groups.some((group) => group.id === "administration"),
      false,
    );
    assert.equal(
      isEligibleForEditorPanel({
        editor: {
          isEditor: true,
          status: "INACTIVE",
          capabilities: ["INITIATIVE_EDIT"],
          geographicScope: {
            level: "WORLD",
            levelLabel: "World",
            summary: "World",
            detail: "",
          },
        },
      }),
      false,
    );
  });
});
