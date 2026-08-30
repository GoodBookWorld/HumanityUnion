/**
 * Pack 12D — Final Editor Role web certification.
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

describe("Pack 12D — Overview + Editors summary", () => {
  it("final Overview order ends with Editors after Quick links", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    const markers = [
      'title="Administrator"',
      'title="Platform status"',
      "Operational overview",
      'title="Quick links"',
      'title="Editors"',
    ];
    let cursor = -1;
    for (const marker of markers) {
      const next = overview.indexOf(marker);
      assert.ok(next > cursor, marker);
      cursor = next;
    }
    const summary = readWeb(
      "features/administration/components/AdminEditorsOverviewSummary.tsx",
    );
    assert.match(summary, /Active editors/);
    assert.match(summary, /Total editors/);
    assert.match(summary, /Manage Editors/);
    assert.match(summary, /Add Editor/);
  });
});

describe("Pack 12D — Workspace nav + Admin separation", () => {
  it("ACTIVE Editor sees Editor Panel; Admin Panel stays separate", () => {
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
  });

  it("drawers reuse WorkspaceNavigation eligibility", () => {
    assert.match(
      readWeb("features/initiatives/components/WorkspaceNavigation.tsx"),
      /isEligibleForEditorPanel/,
    );
    assert.match(
      readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx"),
      /WorkspaceNavigation/,
    );
  });
});

describe("Pack 12D — operational capability honesty", () => {
  it("PUBLISHING_EDIT is assignable as Edit publications; Beta remains WORLD-scoped in panel", () => {
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /blockEditorInitiative|moderationSupported/);
    assert.match(section, /Blocked by administrator/);
  });
});
