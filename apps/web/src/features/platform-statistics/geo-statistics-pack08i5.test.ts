/**
 * Pack 08I.5 — Geo / Country / Region / Community statistics localization.
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
import { localizePublicStatisticCards } from "../platform-statistics/localize-public-statistic-cards.js";
import { COUNTRY_STATISTIC_CARDS } from "../platform-statistics/public-statistics-config.js";
import { formatPlatformStatisticValue } from "../platform-statistics/platform-statistics-api.js";

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

const GEO_STAT_KEYS = [
  "publicStatistics.shared.aboutMetric",
  "publicStatistics.shared.unavailableAria",
  "publicStatistics.metrics.participants.label",
  "publicStatistics.metrics.citiesCommunities.label",
  "publicStatistics.country.title",
  "publicStatistics.country.cards.participants.description",
  "publicStatistics.region.title",
  "publicStatistics.community.title",
  "publicStatistics.geoIndicators.regional-initiatives.label",
  "publicStatistics.geoIndicators.community-participants.label",
] as const;

describe("Pack 08I.5 — Geo statistics localization", () => {
  it("catalog parity includes publicStatistics across en/uk/zh-Hant/ar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of GEO_STAT_KEYS) {
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

  it("country/region/community statistics presenters use publicStatistics catalogs", () => {
    const country = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const region = readWeb(
      "features/region-experience/components/RegionalStatisticsSection.tsx",
    );
    const community = readWeb(
      "features/community-experience/components/CommunityStatisticsSection.tsx",
    );
    const evidence = readWeb(
      "features/public-experience/components/ParticipationStatisticsEvidence.tsx",
    );
    const home = readWeb(
      "features/platform-statistics/components/HumanityUnionInNumbers.tsx",
    );

    assert.match(country, /useTranslations\("publicStatistics"\)/);
    assert.match(country, /localizePublicStatisticCards/);
    assert.match(country, /formatPlatformStatisticValue\(value, locale\)/);
    assert.doesNotMatch(country, /Country Statistics/);
    assert.match(region, /useTranslations\("publicStatistics\.region"\)/);
    assert.match(community, /useTranslations\("publicStatistics\.community"\)/);
    assert.match(evidence, /geoIndicators/);
    assert.match(evidence, /toLocaleString\(locale\)/);
    assert.match(home, /publicStatistics\.metrics/);
  });

  it("shared card localizer overlays labels without mutating numeric keys", () => {
    const labels: Record<string, string> = {
      "metrics.participants.label": "Учасники",
      "country.cards.participants.description": "Опис",
    };
    const t = (key: string) => labels[key] ?? key;
    const localized = localizePublicStatisticCards(COUNTRY_STATISTIC_CARDS, t, {
      labelPath: (key) => `metrics.${key}.label`,
      descriptionPath: (key) => `country.cards.${key}.description`,
    });
    assert.equal(localized[0]?.key, "participants");
    assert.equal(localized[0]?.label, "Учасники");
    assert.equal(COUNTRY_STATISTIC_CARDS[0]?.label, "Participants");
  });

  it("locale-aware number formatting leaves numeric value unchanged", () => {
    assert.equal(formatPlatformStatisticValue(1234, "en"), "1,234");
    assert.equal(Number(formatPlatformStatisticValue(1234, "en").replace(/[^\d]/g, "")), 1234);
    assert.equal(Number(formatPlatformStatisticValue(1234, "uk").replace(/[^\d]/g, "")), 1234);
    assert.equal(Number(formatPlatformStatisticValue(1234, "ar").replace(/[^\d]/g, "")), 1234);
  });
});
