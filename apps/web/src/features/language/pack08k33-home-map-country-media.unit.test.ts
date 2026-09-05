/**
 * Pack 08K.3.3 — Home map + country Recommended Media localization closure.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getLocalizedAdminRegionDisplayName,
  getLocalizedCountryDisplayName,
} from "@hu/geography";
import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  type TrustedMediaResource,
} from "@hu/types";

import {
  buildCompleteCivicMediaCardFixtureTranslations,
  localizeCivicMediaTrustedCardPresentation,
} from "./adapters/civic-media-presentation.js";
import {
  aggregateHomeCountryDiagnostics,
  formatHomeCountryDiagnosticCounters,
  rowFromHomeCountryPresentation,
} from "./home-country-localization-diagnostic.js";
import { localizePublicPresentation } from "./public-localized-presentation.js";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = join(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webSrc, relativePath), "utf8");
}

function readWebPublic(relativePath: string): string {
  return readFileSync(join(webRoot, "public", relativePath), "utf8");
}

const FIXTURE_RESOURCE: TrustedMediaResource = {
  id: "the-atlantic",
  name: "The Atlantic",
  websiteUrl: "https://www.theatlantic.com/",
  explanation: "Trusted explanation of editorial standards for participants.",
  categoryId: "independent-investigative",
  country: "United States",
  countryCode: "US",
  logoUrl: "",
  logoLabel: "The Atlantic",
  sortOrder: 1,
};

describe("Pack 08K.3.3 home map + country media", () => {
  it("A–B: Home interactive map inventory uses next-intl + geography resolver", () => {
    const map = readWeb("features/world-map/components/InteractiveWorldMap.tsx");
    assert.match(map, /getLocalizedCountryDisplayName/);
    assert.match(map, /publicHome\.interactiveMap/);
    assert.match(map, /setCountryNames/);
    assert.match(map, /data-hu-surface="home-interactive-map"/);
    const iframe = readWebPublic("wdcr-js-map/map-interact.js");
    assert.match(iframe, /wdcrLocalizedHoverHtml/);
    assert.match(iframe, /__HU_MAP_COUNTRY_NAMES/);
    assert.doesNotMatch(iframe, /Democracy Index Score/);
  });

  it("C–F: geography navigators use shared display-name resolver", () => {
    const ipNav = readWeb(
      "features/public-home-v2/components/ApproximateIpGeographicNavigator.tsx",
    );
    const geoNav = readWeb(
      "features/global-experience/components/GeographicNavigator.tsx",
    );
    assert.match(ipNav, /getLocalizedCountryDisplayName/);
    assert.match(ipNav, /getLocalizedAdminRegionDisplayName/);
    assert.match(geoNav, /getLocalizedCountryDisplayName/);
    assert.match(geoNav, /getLocalizedAdminRegionDisplayName/);
    assert.doesNotMatch(geoNav, /country\?\.label \?\?/);
  });

  it("G–I: country Recommended Media shares trusted overlay + SSR seed", () => {
    const countryPage = readWeb("app/countries/[countryCode]/page.tsx");
    const dynamic = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const overlay = readWeb(
      "features/civic-media-center/components/use-trusted-media-explanations-overlay.ts",
    );
    const card = readWeb(
      "features/civic-media-center/components/TrustedMediaRailCard.tsx",
    );
    assert.match(countryPage, /loadCivicMediaEditorialSeed/);
    assert.match(countryPage, /initialTrustedExplanationsById/);
    assert.match(dynamic, /useTrustedMediaExplanationsOverlay/);
    assert.match(dynamic, /seedById/);
    assert.match(dynamic, /country-recommended-media/);
    assert.match(card, /civic-media-resource-card__body/);
    assert.match(card, /data-hu-semantic="auto"/);
    assert.match(card, /displayExplanation/);
    assert.match(overlay, /civic_media/);
    assert.match(overlay, /isPartial/);
  });

  it("H/M: same trusted identity across /media and country rail for uk/zh-Hant/ar", () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const base = localizeCivicMediaTrustedCardPresentation({
        mediaRecordId: "civic-media-center",
        resource: FIXTURE_RESOURCE,
        targetLanguage: locale,
      });
      const translations = buildCompleteCivicMediaCardFixtureTranslations(
        base.presentation,
        locale,
      );
      const mediaLocalized = localizeCivicMediaTrustedCardPresentation({
        mediaRecordId: "civic-media-center",
        resource: FIXTURE_RESOURCE,
        targetLanguage: locale,
        translations,
      });
      const countryLocalized = localizeCivicMediaTrustedCardPresentation({
        mediaRecordId: "civic-media-center",
        resource: FIXTURE_RESOURCE,
        targetLanguage: locale,
        translations,
      });
      assert.equal(
        mediaLocalized.identity.sourceRecordId,
        "civic-media-center::trusted::the-atlantic",
      );
      assert.equal(
        countryLocalized.identity.sourceRecordId,
        mediaLocalized.identity.sourceRecordId,
      );
      assert.equal(mediaLocalized.coverage.status, "COMPLETE");
      assert.equal(countryLocalized.coverage.canonicalFallbackNodeCount, 0);
      const mediaExplanation = String(
        (mediaLocalized.presentation as { explanation?: unknown }).explanation ?? "",
      );
      const countryExplanation = String(
        (countryLocalized.presentation as { explanation?: unknown }).explanation ?? "",
      );
      assert.equal(mediaExplanation, countryExplanation);
      assert.match(mediaExplanation, new RegExp(`\\[${locale}\\]`));
    }
  });

  it("N: geography display names consistent across surfaces for uk/zh-Hant/ar", () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const country = getLocalizedCountryDisplayName("CA", locale, "Canada");
      const region = getLocalizedAdminRegionDisplayName(
        "CA",
        "CA-BC",
        locale,
        "British Columbia",
      );
      assert.ok(country.length > 0);
      assert.ok(region.length > 0);
      if (locale === "uk") {
        assert.notEqual(country, "Canada");
      }
      assert.equal(getLocalizedCountryDisplayName("CA", locale, "Canada"), country);
      assert.equal(
        getLocalizedAdminRegionDisplayName("CA", "CA-BC", locale, "British Columbia"),
        region,
      );
    }
  });

  it("I: country card body COMPLETE fixture — fingerprinted + localized", () => {
    const base = localizeCivicMediaTrustedCardPresentation({
      mediaRecordId: "civic-media-center",
      resource: FIXTURE_RESOURCE,
      targetLanguage: "uk",
    });
    const translations = buildCompleteCivicMediaCardFixtureTranslations(
      base.presentation,
      "uk",
    );
    assert.ok(Object.keys(translations).includes("explanation"));
    const localized = localizeCivicMediaTrustedCardPresentation({
      mediaRecordId: "civic-media-center",
      resource: FIXTURE_RESOURCE,
      targetLanguage: "uk",
      translations,
    });
    assert.equal(localized.coverage.status, "COMPLETE");
    assert.equal(localized.coverage.canonicalFallbackNodeCount, 0);
    assert.equal(localized.coverage.localizedNodeCount, localized.coverage.semanticNodeCount);
  });

  it("Q: HOME_MAP + COUNTRY_RECOMMENDED_MEDIA diagnostics zero fallback on complete fixtures", () => {
    const homeLocalized = localizePublicPresentation({
      identity: {
        sourceKind: "geography_display",
        sourceRecordId: "home-map::country::CA",
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: "en",
      targetLanguage: "uk",
      presentation: { displayName: "Canada" },
      translations: { displayName: "Канада" },
    });
    const trustedBase = localizeCivicMediaTrustedCardPresentation({
      mediaRecordId: "civic-media-center",
      resource: FIXTURE_RESOURCE,
      targetLanguage: "uk",
    });
    const trusted = localizeCivicMediaTrustedCardPresentation({
      mediaRecordId: "civic-media-center",
      resource: FIXTURE_RESOURCE,
      targetLanguage: "uk",
      translations: buildCompleteCivicMediaCardFixtureTranslations(
        trustedBase.presentation,
        "uk",
      ),
    });
    const rows = [
      rowFromHomeCountryPresentation({ surface: "HOME_MAP", localized: homeLocalized }),
      rowFromHomeCountryPresentation({
        surface: "COUNTRY_RECOMMENDED_MEDIA",
        localized: trusted,
      }),
    ];
    const aggregate = aggregateHomeCountryDiagnostics(rows);
    assert.equal(aggregate.HOME_MAP_CANONICAL_FALLBACK_NODES, 0);
    assert.equal(aggregate.COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES, 0);
    const formatted = formatHomeCountryDiagnosticCounters(aggregate);
    assert.match(formatted, /HOME_MAP_CANONICAL_FALLBACK_NODES=0/);
    assert.match(formatted, /COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES=0/);
    assert.match(formatted, /surface=HOME_MAP/);
    assert.match(formatted, /surface=COUNTRY_RECOMMENDED_MEDIA/);
  });

  it("preserves 08K.3.2 PARTIAL + overlay contracts", () => {
    const overlay = readWeb(
      "features/civic-media-center/components/use-trusted-media-explanations-overlay.ts",
    );
    assert.match(overlay, /isPartial/);
    assert.match(overlay, /shouldAttemptOnDemandContentTranslation/);
    assert.match(overlay, /trustedMediaExplanations/);
  });
});
