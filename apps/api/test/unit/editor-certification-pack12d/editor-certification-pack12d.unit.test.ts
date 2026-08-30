/**
 * Pack 12D — Final Editor Role certification (contracts + wiring).
 * Certification-only: proves 12A–12C end-to-end integrity without new product features.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EDITOR_ASSIGNABLE_CAPABILITY_IDS,
  EDITOR_CAPABILITY_IDS,
  formatModerationBlockLabel,
  resolveEffectiveModerationBlock,
} from "@hu/types";
import { initiativeContentGeography } from "../../../src/modules/editor-grants/editor-content-geography.js";
import { normalizeEditorCapabilities } from "../../../src/modules/editor-grants/editor-grant.authorization.js";
import {
  contentMatchesEditorScope,
  normalizeEditorGeographicScope,
} from "../../../src/modules/editor-grants/editor-grant.scope.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12D — working-tree / collection contracts", () => {
  it("uses fixed editor_grants collection only (no moderation collection)", () => {
    assert.equal(MONGO_COLLECTIONS.editorGrants, "editor_grants");
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.doesNotMatch(collections, /editor_moderation|moderation_blocks/);
  });

  it("allows PUBLISHING_EDIT as assignable Edit publications capability", () => {
    assert.ok(EDITOR_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLISHING_EDIT"));
    assert.deepEqual(normalizeEditorCapabilities(["PUBLISHING_EDIT"]), ["PUBLISHING_EDIT"]);
    const form = readRepo(
      "apps/web/src/features/administration/components/AdminEditorFormSection.tsx",
    );
    assert.match(form, /EDITOR_ASSIGNABLE_CAPABILITY_IDS/);
    assert.doesNotMatch(form, /EDITOR_CAPABILITY_IDS\.map/);
  });
});

describe("Pack 12D — geographic scope matrix", () => {
  it("WORLD / COUNTRY / REGION / CITY match and deny correctly", () => {
    const world = normalizeEditorGeographicScope({ level: "WORLD" });
    const country = normalizeEditorGeographicScope({ level: "COUNTRY", countryCode: "CA" });
    const region = normalizeEditorGeographicScope({
      level: "REGION",
      countryCode: "CA",
      regionCode: "BC",
    });
    const city = normalizeEditorGeographicScope({
      level: "CITY",
      countryCode: "CA",
      regionCode: "BC",
      communityCode: "vancouver",
    });

    const caBcVan = initiativeContentGeography({
      countrySlug: "CA",
      regionSlug: "BC",
      communitySlug: "vancouver",
    });
    const caOn = initiativeContentGeography({ countrySlug: "CA", regionSlug: "ON" });
    const ua = initiativeContentGeography({ countrySlug: "UA" });
    const unclassified = initiativeContentGeography({});

    assert.equal(contentMatchesEditorScope(world, caBcVan), true);
    assert.equal(contentMatchesEditorScope(world, ua), true);

    assert.equal(contentMatchesEditorScope(country, caBcVan), true);
    assert.equal(contentMatchesEditorScope(country, ua), false);
    assert.equal(contentMatchesEditorScope(country, unclassified), false);

    assert.equal(contentMatchesEditorScope(region, caBcVan), true);
    assert.equal(contentMatchesEditorScope(region, caOn), false);
    assert.equal(contentMatchesEditorScope(region, unclassified), false);

    assert.equal(contentMatchesEditorScope(city, caBcVan), true);
    assert.equal(
      contentMatchesEditorScope(
        city,
        initiativeContentGeography({
          countrySlug: "CA",
          regionSlug: "BC",
          communitySlug: "victoria",
        }),
      ),
      false,
    );
  });
});

describe("Pack 12D — next-geography + moderation provenance", () => {
  it("Initiative Editor re-checks next geography before mutation", () => {
    const editor = readRepo("apps/api/src/modules/initiatives/initiative-editor.service.ts");
    assert.match(editor, /nextCountrySlug/);
    assert.match(editor, /nextRegionSlug/);
    assert.match(editor, /nextCommunitySlug/);
    assert.match(editor, /assertEditorMayEditInitiative/);
  });

  it("legacy Admin block without authority remains ADMIN; Editor cannot clear", () => {
    const resolved = resolveEffectiveModerationBlock({
      administrativelyBlocked: true,
    });
    assert.equal(resolved.isBlocked, true);
    if (resolved.isBlocked) {
      assert.equal(resolved.authority, "ADMIN");
    }
    assert.equal(
      formatModerationBlockLabel({ administrativelyBlocked: true }),
      "Blocked by administrator",
    );
    const moderation = readRepo(
      "apps/api/src/modules/editor-grants/editor-moderation.service.ts",
    );
    assert.match(moderation, /MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE/);
    assert.match(moderation, /authority === "ADMIN"/);
  });
});

describe("Pack 12D — capability independence + panel honesty", () => {
  it("edit and moderate capabilities are independently grantable", () => {
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("INITIATIVE_EDIT"));
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("INITIATIVE_MODERATE"));
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLIC_CHOICE_EDIT"));
    assert.ok(EDITOR_ASSIGNABLE_CAPABILITY_IDS.includes("PUBLIC_CHOICE_MODERATE"));

    const panel = readRepo("apps/api/src/modules/editor-grants/editor-panel.service.ts");
    assert.match(panel, /mutationSupported: caps\.has\("INITIATIVE_EDIT"\)/);
    assert.match(panel, /moderationSupported: caps\.has\("INITIATIVE_MODERATE"\)/);
    assert.match(panel, /mutationSupported: caps\.has\("PUBLIC_CHOICE_EDIT"\)/);
    assert.match(panel, /moderationSupported: caps\.has\("PUBLIC_CHOICE_MODERATE"\)/);
  });

  it("Editor Panel includes Publishing tool when PUBLISHING_EDIT granted; Beta is WORLD-only", () => {
    const panel = readRepo("apps/api/src/modules/editor-grants/editor-panel.service.ts");
    assert.match(panel, /toolId: "publishing"/);
    assert.match(panel, /caps\.has\("PUBLISHING_EDIT"\)/);
    assert.match(panel, /betaAccessCompatibleWithEditorScope/);
    const section = readRepo(
      "apps/web/src/features/administration/components/EditorPanelSection.tsx",
    );
    assert.match(section, /hasTool\("beta-access"\)/);
  });
});

describe("Pack 12D — Admin separation + Overview order", () => {
  it("Editors Overview widget remains after Quick links", () => {
    const overview = readRepo(
      "apps/web/src/features/administration/components/AdminOverviewSection.tsx",
    );
    const orderMarkers = [
      'title="Administrator"',
      'title="Platform status"',
      "Operational overview",
      'title="Quick links"',
      'title="Editors"',
      'title="Platform social accounts"',
      'title="Support operational links"',
    ];
    let cursor = -1;
    for (const marker of orderMarkers) {
      const next = overview.indexOf(marker);
      assert.ok(next > cursor, `missing or out of order: ${marker}`);
      cursor = next;
    }
    assert.equal((overview.match(/title="Editors"/g) ?? []).length, 1);
    assert.doesNotMatch(overview, /Editor World|Available permissions/);
  });

  it("Admin Editors and Admin Panel stay Admin-only; Editor cannot self-manage", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/editors/);
    assert.match(app, /\/api\/v1\/workspace\/editor/);
    const gate = readRepo(
      "apps/web/src/features/administration/components/EditorAccessGate.tsx",
    );
    assert.match(gate, /isEligibleForEditorPanel|Editor Panel/);
    const adminGate = readRepo(
      "apps/web/src/features/administration/components/AdminAccessGate.tsx",
    );
    assert.match(adminGate, /isAdminAccountRole|admin/);
  });
});
