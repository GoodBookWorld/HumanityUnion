/**
 * Final UI & Administration Certification Pack 09H.
 * Aggregates cross-pack contracts for the 09A–09G series (certification only).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(repoRoot, "apps/api/src", relativePath), "utf8");
}

describe("Pack 09H — series certification contracts", () => {
  it("Admin navigation order includes Media Resources then Country Team & Partners after Publishing", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const publishing = labels.indexOf("Publishing");
    const media = labels.indexOf("Media Resources");
    const people = labels.indexOf("Country Team & Partners");
    const initiatives = labels.indexOf("Initiatives");
    const publicChoice = labels.indexOf("Public Choice");
    assert.ok(initiatives >= 0 && publicChoice === initiatives + 1);
    assert.ok(publishing >= 0 && media === publishing + 1);
    assert.ok(people === media + 1);
  });

  it("Country page order: Statistics → Search → Action → Media → News → Team → Partners", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const body = page.slice(page.indexOf("return ("));
    const markers = [
      "country-statistics-title",
      "country-search-title",
      "country-experience-dynamic__search-card",
      "<CountryCivicActionSection",
      "country-media-",
      "<CountryPublicNewsWidget",
      "<CountryTeamSection",
      "<CountryPartnersSection",
    ];
    let previous = -1;
    for (const marker of markers) {
      const idx = body.indexOf(marker);
      assert.ok(idx > previous, `${marker} out of order`);
      previous = idx;
    }
    assert.doesNotMatch(page, /sectionId=\{`country-initiatives-/);
  });

  it("Country Statistics and Media load independently (no shared Promise.all collapse)", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    assert.match(page, /fetchCountryStatistics\(countryCode\)/);
    assert.match(page, /fetchCountryMedia\(countryCode\)/);
    assert.doesNotMatch(
      page,
      /Promise\.all\(\[fetchCountryStatistics\(countryCode\),\s*fetchCountryMedia\(countryCode\)\]\)/,
    );
  });

  it("09A–09G focused pack tests and shared controls remain present", () => {
    assert.ok(
      existsSync(path.join(webSrc, "features/ux-consistency-pack09a/ux-consistency-pack09a.test.ts")),
    );
    assert.ok(
      existsSync(
        path.join(webSrc, "features/media-responsive-ux-pack09b/media-responsive-ux-pack09b.test.ts"),
      ),
    );
    assert.ok(
      existsSync(path.join(webSrc, "features/mobile-shell-pack09c/mobile-shell-pack09c.test.ts")),
    );
    assert.ok(
      existsSync(
        path.join(webSrc, "features/administration/admin-media-resources-pack09d.test.ts"),
      ),
    );
    assert.ok(
      existsSync(path.join(webSrc, "features/country-people-pack09e/country-people-pack09e.test.ts")),
    );
    assert.ok(
      existsSync(
        path.join(webSrc, "features/geography-integrity/geography-integrity-pack09f1.test.ts"),
      ),
    );
    assert.ok(
      existsSync(
        path.join(webSrc, "features/country-experience/country-civic-discovery-pack09f2.test.ts"),
      ),
    );
    assert.ok(
      existsSync(
        path.join(webSrc, "features/mobile-civic-cards-pack09g/mobile-civic-cards-pack09g.test.ts"),
      ),
    );
  });

  it("Media Resources + Country Affiliations admin services assertAdminUser", () => {
    const media = readApi("modules/media-resources/media-resource.service.ts");
    const people = readApi("modules/country-affiliation/country-affiliation.service.ts");
    assert.match(media, /assertAdminUser/);
    assert.match(people, /assertAdminUser/);
  });

  it("PWA brand icons and Install App / Add to Home Screen contracts remain", () => {
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-192.png")));
    assert.ok(existsSync(path.join(webRoot, "public/brand/app-512.png")));
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /\/brand\/app-192\.png/);
    assert.match(manifest, /\/brand\/app-512\.png/);
    const install = readWeb("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(install, /Install App|Add to Home Screen/);
  });

  it("09G compact CSS does not target Public Choice Overview voting rows", () => {
    const mini = readWeb("features/public-initiative-mini-card/public-initiative-mini-card.css");
    const rail = readWeb(
      "features/civic-media-center/components/civic-media-resource-cards.css",
    );
    assert.doesNotMatch(mini, /pie-overview-candidates|pc-vote-card/);
    assert.doesNotMatch(rail, /pie-overview-candidates|pc-vote-card/);
  });
});
