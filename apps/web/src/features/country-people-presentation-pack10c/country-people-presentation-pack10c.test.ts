/**
 * Country People Presentation Pack 10C —
 * Team/Partner rails + placeholders + page position + PWA footer icons.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AFFILIATION_MIN_PRESENTATION_SLOTS,
  buildAffiliationPresentationSlots,
  countAffiliationPlaceholders,
} from "../country-experience/country-affiliation-presentation.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Country People Presentation Pack 10C — page + slots", () => {
  it("places Team after Country News and Partners at the bottom; removes top placement", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const body = page.slice(page.indexOf("return ("));
    const newsIdx = body.indexOf("<CountryPublicNewsWidget");
    const teamIdx = body.indexOf("<CountryTeamSection");
    const partnersIdx = body.indexOf("<CountryPartnersSection");
    const searchIdx = body.indexOf("country-search-title");
    const statsIdx = body.indexOf("country-statistics-title");

    assert.ok(newsIdx > searchIdx);
    assert.ok(teamIdx > newsIdx);
    assert.ok(partnersIdx > teamIdx);
    assert.ok(statsIdx > 0 && searchIdx > statsIdx);
    assert.equal((body.match(/<CountryTeamSection/g) ?? []).length, 1);
    assert.equal((body.match(/<CountryPartnersSection/g) ?? []).length, 1);
  });

  it("slot plan: 0→5, 1→4, 4→1, 5→0 placeholders; >5 keeps all real", () => {
    assert.equal(AFFILIATION_MIN_PRESENTATION_SLOTS, 5);
    assert.equal(countAffiliationPlaceholders(0), 5);
    assert.equal(countAffiliationPlaceholders(1), 4);
    assert.equal(countAffiliationPlaceholders(4), 1);
    assert.equal(countAffiliationPlaceholders(5), 0);
    assert.equal(countAffiliationPlaceholders(7), 0);

    const zero = buildAffiliationPresentationSlots([]);
    assert.equal(zero.length, 5);
    assert.ok(zero.every((slot) => slot.kind === "placeholder"));

    const one = buildAffiliationPresentationSlots([{ id: "a" }]);
    assert.equal(one.filter((slot) => slot.kind === "entry").length, 1);
    assert.equal(one.filter((slot) => slot.kind === "placeholder").length, 4);

    const many = buildAffiliationPresentationSlots(
      Array.from({ length: 7 }, (_, index) => ({ id: `e${index}` })),
    );
    assert.equal(many.length, 7);
    assert.ok(many.every((slot) => slot.kind === "entry"));
  });

  it("Team/Partners rails use horizontal scroll, placeholders, and tone variants", () => {
    const team = readWeb("features/country-experience/components/CountryTeamSection.tsx");
    const partners = readWeb(
      "features/country-experience/components/CountryPartnersSection.tsx",
    );
    const card = readWeb("features/country-experience/components/CountryAffiliationCard.tsx");
    const css = readWeb("features/country-experience/components/country-affiliation-cards.css");

    assert.match(team, /country-affiliation-rail/);
    assert.match(team, /CountryAffiliationPlaceholderCard/);
    assert.match(partners, /country-affiliation-rail/);
    assert.match(partners, /variant="partner"/);
    assert.match(css, /overflow-x:\s*auto/);
    assert.match(css, /grid-auto-columns:\s*calc\(\(100% - \(var\(--country-affiliation-rail-gap\) \* 3\)\) \/ 4\)/);
    assert.match(css, /country-affiliation-card--tone-0/);
    assert.match(css, /country-affiliation-card--tone-4/);
    assert.match(card, /CountryAffiliationPlaceholderCard/);
    assert.doesNotMatch(card, /country-affiliation-card__fallback/);
    assert.doesNotMatch(css, /\.country-affiliation-card__fallback\s*\{/);
  });

  it("centers Country flag and keeps hero copy left-aligned", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const css = readWeb("features/country-experience/country-experience-dynamic.css");
    assert.match(page, /country-experience-dynamic__flag-wrap/);
    assert.match(css, /\.country-experience-dynamic__flag-wrap\s*\{[^}]*justify-content:\s*center/s);
    assert.match(css, /country-experience-dynamic__hero-copy/);
  });
});

describe("Country People Presentation Pack 10C — PWA footer icons", () => {
  it("increases footer nav icon visual size by ~50% and keeps labels/active styles", () => {
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    const css = readWeb("features/pwa/pwa.css");
    const safe = readWeb("features/pwa/pwa-safe-area.css");

    assert.match(css, /\.hu-pwa-bottom-nav__icon\s*\{[^}]*width:\s*2\.25rem/s);
    assert.match(css, /height:\s*2\.25rem/);
    assert.match(nav, /width=\{36\}/);
    assert.match(nav, /Workspace/);
    assert.match(nav, /Initiatives/);
    assert.match(nav, /Notifications/);
    assert.match(css, /aria-current="page"|hu-pwa-bottom-nav__item\[aria-current="page"\]/);
    assert.match(safe, /--hu-pwa-bottom-nav-content-height:\s*4\.5rem/);
    assert.match(safe, /var\(--hu-safe-area-bottom\)/);
    assert.match(css, /padding:.*var\(--hu-safe-area-bottom\)/);
  });

  it("does not enlarge Pack 10A header/drawer or browser desktop nav icons", () => {
    const layout = readWeb("design-system/layout.css");
    const controls = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    const drawer = readWeb("features/pwa/components/PwaWorkspaceDrawer.tsx");
    const css = readWeb("features/pwa/pwa.css");

    assert.match(controls, /Open Workspace menu/);
    assert.match(drawer, /PwaWorkspaceDrawer|WorkspaceNavigation/);
    assert.match(layout, /humanity-header__menu-button/);
    assert.doesNotMatch(layout, /hu-pwa-bottom-nav__icon/);
    assert.match(css, /\.hu-pwa-bottom-nav\s*\{/);
  });
});
