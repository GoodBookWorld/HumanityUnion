/**
 * Country People Pack 09E — Team + Partners admin and Country widgets.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_PANEL_SECTIONS } from "../administration/admin-panel-sections.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Country People Pack 09E", () => {
  it("Admin Panel includes Country Team & Partners after Media Resources", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const media = labels.indexOf("Media Resources");
    const people = labels.indexOf("Country Team & Partners");
    assert.ok(media >= 0 && people === media + 1);
    assert.ok(existsSync(path.resolve(webSrc, "app/admin/country-people/page.tsx")));
    assert.match(read("app/admin/country-people/page.tsx"), /AdminAccessGate/);
    assert.match(read("app/admin/country-people/page.tsx"), /AdminCountryPeopleSection/);
  });

  it("Admin form uses Pack 09A person/landscape image UX and country filters", () => {
    const section = read("features/administration/components/AdminCountryPeopleSection.tsx");
    const api = read("features/administration/admin-country-people-api.ts");
    assert.match(section, /PersonImageUploadField/);
    assert.match(section, /variant=\{imageVariant\}/);
    assert.match(section, /TEAM_MEMBER|PARTNER/);
    assert.match(section, /toGeographyCountryOptions|GEOGRAPHY_COUNTRIES/);
    assert.match(section, /uploadMediaResourceLogo/);
    assert.match(api, /\/api\/v1\/admin\/country-people/);
  });

  it("Country page mounts Our Team and Our Partners outside Search/Action zone", () => {
    const page = read("features/country-experience/components/CountryExperienceDynamicPage.tsx");
    const team = read("features/country-experience/components/CountryTeamSection.tsx");
    const partners = read("features/country-experience/components/CountryPartnersSection.tsx");
    const card = read("features/country-experience/components/CountryAffiliationCard.tsx");
    const api = read("features/country-experience/country-experience-api.ts");

    const statsIdx = page.indexOf('id="country-statistics-title"');
    const teamIdx = page.indexOf("<CountryTeamSection");
    const partnersIdx = page.indexOf("<CountryPartnersSection");
    const searchIdx = page.indexOf('id="country-search-title"');
    const actionIdx = page.indexOf("<CountryCivicActionSection");
    assert.ok(statsIdx > 0 && teamIdx > statsIdx && partnersIdx > teamIdx);
    assert.ok(searchIdx > partnersIdx && actionIdx > searchIdx);

    assert.match(team, /Our Team/);
    assert.match(team, /TEAM_MEMBER/);
    assert.match(partners, /Our Partners/);
    assert.match(partners, /PARTNER/);
    assert.match(card, /mailto:/);
    assert.match(card, /country-affiliation-card__fallback/);
    assert.match(api, /\/affiliations/);
  });
});
