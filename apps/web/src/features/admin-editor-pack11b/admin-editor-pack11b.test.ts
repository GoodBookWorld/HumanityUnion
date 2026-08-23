/**
 * Pack 11B — Admin Overview Editor authority summary + World geographic scope.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_EDITOR_CAPABILITY_SECTION_IDS,
  formatAdminGeographicEditingArea,
  resolveAdminEditorAuthority,
} from "../administration/admin-editor-authority";
import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections";
import { isAdminAccountRole } from "../administration/is-admin-role";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 11B — Admin authorization architecture", () => {
  it("Admin Panel remains global role-only (no second role / editor account)", () => {
    assert.equal(isAdminAccountRole("admin"), true);
    assert.equal(isAdminAccountRole("member"), false);
    assert.equal(isAdminAccountRole("editor"), false);
    assert.equal(isAdminAccountRole("moderator"), false);

    const gate = readWeb("features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /isAdminAccountRole/);
    assert.doesNotMatch(gate, /editor|geographicScope|editingScope/i);
  });

  it("non-admin still denied Admin Overview; no public Editor endpoint", () => {
    const overviewPage = readWeb("app/admin/page.tsx");
    assert.match(overviewPage, /AdminAccessGate/);

    const authority = resolveAdminEditorAuthority({ role: "member" });
    assert.equal(authority, null);

    const resolver = readWeb("features/administration/admin-editor-authority.ts");
    assert.doesNotMatch(resolver, /apiRequest|fetch\(|\/api\/v1\//);
  });
});

describe("Pack 11B — Editor widget contract", () => {
  it("Overview mounts Editor widget from shared resolver", () => {
    const overview = readWeb("features/administration/components/AdminOverviewSection.tsx");
    assert.match(overview, /title="Editor"/);
    assert.match(overview, /AdminEditorAuthoritySection/);
    assert.match(overview, /resolveAdminEditorAuthority/);
    assert.match(overview, /getMyMemberProfile/);
    assert.match(overview, /profileDisplayName/);
  });

  it("capabilities come from ADMIN_PANEL_SECTIONS labels for real editing areas only", () => {
    const authority = resolveAdminEditorAuthority({ role: "admin" });
    assert.ok(authority);

    const expectedLabels = ADMIN_EDITOR_CAPABILITY_SECTION_IDS.map((id) => {
      const section = ADMIN_PANEL_SECTIONS.find((entry) => entry.id === id);
      assert.ok(section, id);
      return section.label;
    });

    assert.deepEqual(
      authority.capabilities.map((entry) => entry.label),
      expectedLabels,
    );

    for (const capability of authority.capabilities) {
      assert.equal(capability.status, "available");
      assert.equal(capability.statusLabel, "Available");
    }

    assert.ok(expectedLabels.includes("Initiatives"));
    assert.ok(expectedLabels.includes("Public Choice"));
    assert.ok(expectedLabels.includes("Publishing"));
    assert.ok(expectedLabels.includes("Media Resources"));
    assert.ok(expectedLabels.includes("Country Team & Partners"));

    assert.equal(expectedLabels.includes("SEO"), false);
    assert.equal(expectedLabels.includes("Audit"), false);
    assert.equal(expectedLabels.includes("Views"), false);
    assert.equal(expectedLabels.includes("Platform"), false);
  });

  it("does not duplicate Admin navigation into Overview Editor widget", () => {
    const section = readWeb(
      "features/administration/components/AdminEditorAuthoritySection.tsx",
    );
    assert.doesNotMatch(section, /ADMIN_PANEL_SECTIONS\.map|href=|Link /);
    assert.match(section, /Editing access/);
    assert.match(section, /Editing area/);
  });
});

describe("Pack 11B — geographic editing area", () => {
  it("current global Admin resolves World with honest all-geography copy", () => {
    const authority = resolveAdminEditorAuthority({ role: "admin" });
    assert.ok(authority);
    assert.equal(authority.editingArea.level, "WORLD");
    assert.equal(authority.editingArea.levelLabel, "World");
    assert.equal(authority.editingArea.summary, "World");
    assert.equal(authority.editingArea.detail, "All countries, regions and cities");
  });

  it("future Country/Region/City presentation uses canonical geography labels", () => {
    const country = formatAdminGeographicEditingArea({
      level: "COUNTRY",
      countryCode: "CA",
    });
    assert.equal(country.levelLabel, "Country");
    assert.equal(country.summary, "Canada");
    assert.doesNotMatch(country.summary, /^CA$/);

    const region = formatAdminGeographicEditingArea({
      level: "REGION",
      countryCode: "CA",
      regionCode: "CA-BC",
    });
    assert.equal(region.levelLabel, "Region");
    assert.equal(region.summary, "Canada → British Columbia");
    assert.doesNotMatch(region.summary, /CA-BC/);

    const city = formatAdminGeographicEditingArea({
      level: "CITY",
      countryCode: "CA",
      regionCode: "CA-BC",
      communitySlug: "nelson",
      knownCommunityName: "Nelson",
    });
    assert.equal(city.levelLabel, "City");
    assert.equal(city.summary, "Canada → British Columbia → Nelson");
    assert.doesNotMatch(city.summary, /\bCA\b|CA-BC|nelson/);
  });

  it("does not invent geographic scope persistence or enforcement", () => {
    const resolver = readWeb("features/administration/admin-editor-authority.ts");
    assert.doesNotMatch(resolver, /persist|localStorage|editingScope|countryScope/i);
    assert.match(resolver, /WORLD/);
    assert.match(resolver, /COUNTRY/);
    assert.match(resolver, /REGION/);
    assert.match(resolver, /CITY/);
  });
});

describe("Pack 11B — responsive / a11y presentation", () => {
  it("statuses include text labels and mobile stacks cleanly", () => {
    const section = readWeb(
      "features/administration/components/AdminEditorAuthoritySection.tsx",
    );
    const css = readWeb("features/administration/components/admin-panel.css");

    assert.match(section, /Available|statusLabel/);
    assert.match(section, /aria-label="Editing access"/);
    assert.match(section, /aria-hidden="true"/);
    assert.match(css, /\.admin-editor-authority/);
    assert.match(css, /@media \(max-width: 520px\)[\s\S]*admin-editor-authority__item/);
    assert.doesNotMatch(css, /admin-editor-authority__list[\s\S]*overflow-x:\s*auto/);
  });
});

describe("Pack 11B — regression anchors", () => {
  it("Admin navigation sections remain unchanged", () => {
    assert.deepEqual(
      ADMIN_PANEL_SECTIONS.map((section) => section.id),
      [
        "overview",
        "views",
        "participants",
        "initiatives",
        "public-choice",
        "publishing",
        "media-resources",
        "country-people",
        "seo",
        "beta-access",
        "platform",
        "audit",
      ],
    );
  });
});
