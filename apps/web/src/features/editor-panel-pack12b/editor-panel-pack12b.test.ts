/**
 * Pack 12B — Workspace Editor Panel web contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isEligibleForEditorPanel,
} from "../administration/editor-panel-eligibility";
import { buildWorkspaceNavGroups } from "../initiatives/components/build-workspace-nav-groups";
import { isAdminAccountRole } from "../administration/is-admin-role";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

const authoring = { href: "/workspace/authoring", label: "Become an Author" };

describe("Pack 12B — Editor Panel navigation", () => {
  it("ACTIVE Editor sees Editor Panel inside Workspace group; Admin Panel stays separate", () => {
    const withEditor = buildWorkspaceNavGroups(authoring, null, {
      showEditorPanel: true,
      showAdminPanel: false,
    });
    const workspace = withEditor.find((group) => group.id === "workspace");
    assert.ok(workspace?.routes.some((route) => route.href === "/workspace/editor"));
    assert.equal(
      withEditor.some((group) => group.id === "administration"),
      false,
    );

    const adminOnly = buildWorkspaceNavGroups(authoring, null, {
      showEditorPanel: false,
      showAdminPanel: true,
    });
    assert.equal(
      adminOnly
        .find((group) => group.id === "workspace")
        ?.routes.some((route) => route.href === "/workspace/editor"),
      false,
    );
    assert.ok(adminOnly.some((group) => group.id === "administration"));
  });

  it("WorkspaceNavigation uses eligibility helper; drawers reuse same nav", () => {
    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /isEligibleForEditorPanel/);
    assert.match(nav, /showEditorPanel/);
    assert.match(
      readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx"),
      /WorkspaceNavigation/,
    );
  });

  it("route uses EditorAccessGate and Admin Panel remains Admin-only", () => {
    const page = readWeb("app/workspace/editor/page.tsx");
    assert.match(page, /EditorAccessGate/);
    assert.match(page, /EditorPanelSection/);
    assert.equal(isAdminAccountRole("editor"), false);
    assert.equal(
      isEligibleForEditorPanel({
        editor: {
          isEditor: true,
          status: "ACTIVE",
          capabilities: ["INITIATIVE_EDIT"],
          geographicScope: {
            level: "WORLD",
            levelLabel: "World",
            summary: "World",
            detail: "",
          },
        },
      }),
      true,
    );
  });
});

describe("Pack 12B — grant-driven widgets", () => {
  it("panel derives tools from capabilities and omits ungranted domains", () => {
    const section = readWeb("features/administration/components/EditorPanelSection.tsx");
    assert.match(section, /hasTool\("initiatives"\)/);
    assert.match(section, /hasTool\("public-choice"\)/);
    assert.match(section, /hasTool\("media-resources"\)/);
    assert.match(section, /fetchEditorPanel/);
    assert.doesNotMatch(section, /Admin Panel|\/admin\/traffic|\/admin\/editors/);
  });
});
