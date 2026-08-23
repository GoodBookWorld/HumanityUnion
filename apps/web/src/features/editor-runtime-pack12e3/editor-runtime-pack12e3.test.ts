/**
 * Pack 12E3 — Editor runtime end-to-end certification (web contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EDITOR_ASSIGNABLE_CAPABILITY_IDS } from "@hu/types";

import { isEligibleForEditorPanel } from "../administration/editor-panel-eligibility";
import { isAdminAccountRole } from "../administration/is-admin-role";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

const authoring = { href: "/workspace/authoring", label: "Become an Author" };

describe("Pack 12E3 — Assign → table → notify → Workspace activation", () => {
  it("Assign Editor state machine + honest notification messaging", () => {
    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /Assigning…/);
    assert.match(form, /["']Assigned["']/);
    assert.match(form, /aria-busy=\{submitBusy\}/);
    assert.match(form, /notificationDelivered/);
    assert.match(form, /Notification sent/);
    assert.match(form, /Notification could not be delivered/);
    assert.match(form, /\/admin\/editors\?assigned=1/);
    assert.match(form, /Content-Type|assignAdminEditor/);
    assert.doesNotMatch(form, /type=["']password["']/i);

    const api = readWeb("features/administration/admin-editors-api.ts");
    assert.match(api, /Content-Type["']:\s*["']application\/json["']/);
  });

  it("Editors table + Overview summary derive from Admin Editors API", () => {
    const table = readWeb("features/administration/components/AdminEditorsSection.tsx");
    assert.match(table, /listAdminEditors/);
    assert.match(table, /Editor assigned successfully/);
    assert.match(table, /displayName/);
    assert.match(table, /capabilityLabels/);
    assert.match(table, /geographicScope/);

    const summary = readWeb(
      "features/administration/components/AdminEditorsOverviewSummary.tsx",
    );
    assert.match(summary, /fetchAdminEditorSummary/);
    assert.match(summary, /Active editors/);
    assert.match(summary, /Total editors/);
  });

  it("already-logged-in Participant refreshes Editor Panel without logout", () => {
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /getMe\(\)/);
    assert.match(nav, /pathname, refreshAuthority/);
    assert.match(nav, /visibilitychange/);
    assert.match(nav, /EDITOR_GRANT_CHANGED_EVENT|AUTH_STATE_CHANGED_EVENT/);
    assert.match(nav, /isEligibleForEditorPanel/);

    const gate = readWeb("features/administration/components/EditorAccessGate.tsx");
    assert.match(gate, /getMe\(\)/);
    assert.match(gate, /visibilitychange/);
    assert.match(gate, /active Editors only/);

    const drawers = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    assert.match(drawers, /WorkspaceNavigation/);
  });

  it("notification UI deep-links Editor events to Editor Panel", () => {
    const center = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(center, /View Editor Panel/);
    assert.match(center, /relatedUrl/);
    assert.match(center, /editor_access_/);
  });

  it("ACTIVE Editor sees Panel; Admin Panel separate; Publishing not assignable", () => {
    const groups = buildWorkspaceNavGroups(authoring, null, {
      showEditorPanel: true,
      showAdminPanel: false,
    });
    assert.ok(
      groups
        .find((group) => group.id === "workspace")
        ?.routes.some((route) => route.href === "/workspace/editor"),
    );
    assert.equal(groups.some((group) => group.id === "administration"), false);
    assert.equal(isAdminAccountRole("editor"), false);
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
    assert.ok(!EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
  });
});
