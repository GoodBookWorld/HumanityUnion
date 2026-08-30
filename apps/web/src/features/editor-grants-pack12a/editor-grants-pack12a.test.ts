/**
 * Pack 12A — Admin Editors management + Workspace eligibility (web contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EDITOR_ASSIGNABLE_CAPABILITY_IDS, EDITOR_CAPABILITY_IDS, EDITOR_CAPABILITY_LABELS } from "@hu/types";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections";
import {
  isEligibleForEditorPanel,
  resolveEditorViewerState,
} from "../administration/editor-panel-eligibility";
import { isAdminAccountRole } from "../administration/is-admin-role";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 12A — Admin Editors surface", () => {
  it("adds Editors section after Participants and mounts AdminAccessGate pages", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const participants = labels.indexOf("Participants");
    assert.equal(labels[participants + 1], "Editors");

    for (const page of [
      "app/admin/editors/page.tsx",
      "app/admin/editors/new/page.tsx",
      "app/admin/editors/[editorGrantId]/page.tsx",
    ]) {
      const source = readWeb(page);
      assert.match(source, /AdminAccessGate/);
    }
  });

  it("Overview shows Editors summary with Manage Editors / Add Editor", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /title="Editors"/);
    assert.match(overview, /AdminEditorsOverviewSummary/);

    const summary = readWeb(
      "features/administration/components/AdminEditorsOverviewSummary.tsx",
    );
    assert.match(summary, /Active editors/);
    assert.match(summary, /Manage Editors/);
    assert.match(summary, /\/admin\/editors/);
    assert.match(summary, /Add Editor/);
  });

  it("Editors table and form use Profile identity + capability IDs + geography selects", () => {
    const table = readWeb("features/administration/components/AdminEditorsSection.tsx");
    assert.match(table, /Editing permissions/);
    assert.match(table, /Editing area/);
    assert.match(table, /Activate|Deactivate/);
    assert.doesNotMatch(table, /password|passwordHash/i);

    const form = readWeb("features/administration/components/AdminEditorFormSection.tsx");
    assert.match(form, /CountrySelect/);
    assert.match(form, /RegionSelect/);
    assert.match(form, /CitySelect/);
    assert.match(form, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
    assert.match(form, /listAdminParticipants/);
    assert.match(form, /memberId/);
    assert.match(form, /Passwords and\s+Admin Panel access are never assigned/);
    assert.doesNotMatch(form, /passwordHash|type=["']password["']/i);

    for (const id of EDITOR_CAPABILITY_IDS) {
      assert.ok(EDITOR_CAPABILITY_LABELS[id]);
    }
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT" as never));
    assert.equal(EDITOR_CAPABILITY_LABELS.PUBLISHING_EDIT, "Edit publications");
  });

  it("Admin Panel remains Admin-only; Editor is not an account role", () => {
    assert.equal(isAdminAccountRole("editor"), false);
    const gate = readWeb("features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /isAdminAccountRole/);
    assert.doesNotMatch(gate, /isEligibleForEditorPanel/);
  });
});

describe("Pack 12A — Workspace Editor Panel eligibility", () => {
  it("active Editor eligible; inactive and non-editor not eligible", () => {
    assert.equal(isEligibleForEditorPanel(null), false);
    assert.equal(isEligibleForEditorPanel({ editor: { isEditor: false } }), false);

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

    const state = resolveEditorViewerState({
      editor: {
        isEditor: true,
        status: "ACTIVE",
        capabilities: ["PUBLISHING_EDIT"],
        geographicScope: {
          level: "COUNTRY",
          countryCode: "CA",
          levelLabel: "Country",
          summary: "Canada",
          detail: "",
        },
      },
    });
    assert.equal(state.isEditor, true);
  });

  it("eligibility helper remains canonical for Editor Panel nav (Pack 12B mounts it)", () => {
    assert.match(
      readWeb("features/administration/editor-panel-eligibility.ts"),
      /isEligibleForEditorPanel/,
    );
    assert.match(
      readWeb("features/initiatives/components/build-workspace-nav-groups.ts"),
      /showEditorPanel/,
    );
  });
});
