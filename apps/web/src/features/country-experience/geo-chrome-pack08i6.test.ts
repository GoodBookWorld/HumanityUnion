/**
 * Pack 08I.6 — Geo public non-statistics chrome localization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const GEO_CHROME_KEYS = [
  "publicGeo.shared.home",
  "publicGeo.shared.world",
  "publicGeo.shared.bootstrapSource",
  "publicGeo.shared.returnToCountrySquare",
  "publicGeo.country.heroIntro",
  "publicGeo.country.search.title",
  "publicGeo.country.search.placeholder",
  "publicGeo.country.action.eyebrow",
  "publicGeo.country.media.title",
  "publicGeo.country.team.title",
  "publicGeo.country.partners.title",
  "publicGeo.region.identity.visitorConclusion",
  "publicGeo.region.map.title",
  "publicGeo.region.pipeline.title",
  "publicGeo.region.initiatives.emptyMessage",
  "publicGeo.region.discovery.title",
  "publicGeo.community.identity.visitorConclusion",
  "publicGeo.community.pipeline.title",
  "publicGeo.community.impact.title",
  "publicGeo.community.find.title",
  "publicGeo.community.registration.title",
  "publicGeo.shared.registration.title",
  "publicGeo.shared.initiativeCard.unavailableNotice",
  "publicNews.country.heading",
  "publicNews.country.providerLabel",
  "publicNews.toolbar.searchLabel",
  "publicNews.card.createInitiative",
  "publicNews.placeholder.errorTitle",
  "publicStatistics.country.title",
  "publicStatistics.region.title",
  "publicStatistics.community.title",
] as const;

describe("Pack 08I.6 — Geo public chrome localization", () => {
  it("catalog parity includes publicGeo across en/uk/zh-Hant/ar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of GEO_CHROME_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("country live chrome uses publicGeo (not hardcoded English headings)", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const action = readWeb(
      "features/country-experience/components/CountryCivicActionSection.tsx",
    );
    const team = readWeb("features/country-experience/components/CountryTeamSection.tsx");
    const partners = readWeb(
      "features/country-experience/components/CountryPartnersSection.tsx",
    );

    assert.match(page, /useTranslations\("publicGeo"\)/);
    assert.match(page, /country\.heroIntro/);
    assert.match(page, /country\.search\.title/);
    assert.doesNotMatch(page, /Search Civic Activity in This Country/);
    assert.doesNotMatch(page, /Clear Filters/);
    assert.match(action, /publicGeo\.country\.action/);
    assert.doesNotMatch(action, /Country Action/);
    assert.match(team, /publicGeo\.country\.team/);
    assert.match(partners, /publicGeo\.country\.partners/);
    assert.match(page, /useTranslations\("publicStatistics"\)/);
  });

  it("region/community live chrome uses publicGeo catalogs", () => {
    const regionNav = readWeb(
      "features/region-experience/components/RegionGeographicNavigator.tsx",
    );
    const regionIdentity = readWeb(
      "features/region-experience/components/RegionIdentitySection.tsx",
    );
    const regionMap = readWeb(
      "features/region-experience/components/RegionalInteractiveMapSection.tsx",
    );
    const communityNav = readWeb(
      "features/community-experience/components/CommunityGeographicNavigator.tsx",
    );
    const communityIdentity = readWeb(
      "features/community-experience/components/CommunityIdentitySection.tsx",
    );
    const find = readWeb(
      "features/community-experience/components/FindYourCommunitySection.tsx",
    );

    assert.match(regionNav, /publicGeo/);
    assert.match(regionIdentity, /region\.identity/);
    assert.match(regionMap, /publicGeo\.region\.map/);
    assert.match(communityNav, /community\.navigatorAria/);
    assert.match(communityIdentity, /community\.identity/);
    assert.match(find, /publicGeo\.community\.find/);
  });

  it("shared geo evidence cards localize chrome while preserving identifiers in props", () => {
    const pipeline = readWeb(
      "features/public-experience/components/ParticipationPipelineEvidence.tsx",
    );
    const card = readWeb("features/public-experience/components/LatestInitiativeCard.tsx");
    const registration = readWeb(
      "features/public-experience/components/RegistrationGatewaySection.tsx",
    );

    assert.match(pipeline, /scopePrefix/);
    assert.match(pipeline, /pipelineStagesAria/);
    assert.match(card, /initiativeCard\./);
    assert.match(registration, /publicGeo\.shared\.registration/);
  });

  it("geographic display names use locale-aware resolver (not UI catalog country dictionaries)", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    assert.match(page, /getLocalizedCountryDisplayName|resolveUnRegionDisplayName/);
    assert.match(page, /getCountryByCode/);
    assert.doesNotMatch(page, /publicGeo\.country\.names/);
    assert.doesNotMatch(page, /\{country\.name\}/);
  });

  it("country news + shared public news chrome use publicNews catalogs", () => {
    const widget = readWeb("features/public-news/components/CountryPublicNewsWidget.tsx");
    const section = readWeb("features/public-news/components/PublicNewsSection.tsx");
    const toolbar = readWeb("features/public-news/components/PublicNewsToolbar.tsx");
    const card = readWeb("features/public-news/components/PublicNewsCard.tsx");
    const placeholder = readWeb("features/public-news/components/PublicNewsPlaceholder.tsx");

    assert.match(widget, /publicNews\.country/);
    assert.match(section, /publicNews\.country/);
    assert.match(section, /publicNews\.discovery/);
    assert.doesNotMatch(section, /COUNTRY NEWS/);
    assert.doesNotMatch(section, /Clear filter/);
    assert.match(toolbar, /publicNews\.toolbar/);
    assert.doesNotMatch(toolbar, /Search events/);
    assert.match(card, /publicNews\.card/);
    assert.doesNotMatch(card, /Create Initiative/);
    assert.match(placeholder, /publicNews\.placeholder/);
  });

  it("statistics remain on publicStatistics (no duplicated geo stats namespace)", () => {
    const country = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const region = readWeb(
      "features/region-experience/components/RegionalStatisticsSection.tsx",
    );
    const community = readWeb(
      "features/community-experience/components/CommunityStatisticsSection.tsx",
    );

    assert.match(country, /publicStatistics/);
    assert.match(region, /publicStatistics\.region/);
    assert.match(community, /publicStatistics\.community/);
    assert.doesNotMatch(country, /publicGeo\.statistics/);
  });
});
