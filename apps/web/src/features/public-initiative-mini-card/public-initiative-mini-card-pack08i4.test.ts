/**
 * Pack 08I.4 — PublicInitiativeMiniCard translation boundary + shared chrome.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { compareCatalogParityToEnglish } from "../i18n/catalog-parity.js";
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

const MINI_CARD_CHROME_KEYS = [
  "publicInitiativeMiniCard.viewInitiative",
  "publicInitiativeMiniCard.updated",
  "publicInitiativeMiniCard.likesDislikes",
  "publicInitiativeMiniCard.shareAria",
  "publicInitiativeMiniCard.viewAria",
  "publicInitiativeMiniCard.placeholder.title",
  "publicInitiativeMiniCard.placeholder.summary",
  "publicInitiativeMiniCard.placeholder.meta",
  "publicInitiativeMiniCard.placeholder.ariaLabel",
] as const;

const PUBLIC_HOME_STATISTICS_KEYS = [
  "publicHome.statistics.title",
  "publicHome.statistics.intro",
  "publicHome.statistics.unavailable",
  "publicHome.statistics.loading",
  "publicHome.statistics.aboutMetric",
  "publicHome.statistics.unavailableValue",
  "publicHome.statistics.unavailableAria",
  "publicHome.statistics.cards.users.label",
  "publicHome.statistics.cards.users.description",
  "publicHome.statistics.cards.humanityUnionMembers.label",
  "publicHome.statistics.cards.countries.label",
  "publicHome.statistics.cards.regions.label",
  "publicHome.statistics.cards.initiatives.label",
  "publicHome.statistics.cards.collectiveDecisions.label",
  "publicHome.statistics.cards.civicActionPackages.label",
  "publicHome.statistics.cards.officialResponses.label",
  "publicHome.statistics.cards.civicArchive.label",
  "publicHome.statistics.cards.civicArchive.description",
] as const;

describe("Pack 08I.4 — PublicInitiativeMiniCard translation boundary", () => {
  it("resolves title/summary via shared presentation helper and reading context", () => {
    const card = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const resolver = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );
    assert.match(card, /usePublicContentReadingContext/);
    assert.match(card, /useInitiativeCardTitlePresentation/);
    assert.match(card, /initiativeId:\s*initiative\.initiativeId/);
    assert.match(card, /readingContext/);
    assert.match(resolver, /resolveTranslatedContent/);
    assert.match(resolver, /sourceKind:\s*"initiative"/);
    assert.match(resolver, /generateContentTranslation/);
    assert.match(resolver, /translationPreference === "preferred"/);
    assert.match(resolver, /presentationMode === "original"/);
    assert.match(resolver, /pickTranslatedField\(resolved,\s*"title"/);
    assert.match(resolver, /pickTranslatedField\(resolved,\s*"description"/);
    assert.doesNotMatch(card, /updatePublicInitiative|patchInitiative|mutateInitiative/);
  });

  it("Home and Institutions both import the same PublicInitiativeMiniCard", () => {
    const home = readWeb(
      "features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
    );
    const institutions = readWeb(
      "features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
    );
    assert.match(home, /from ["'].*public-initiative-mini-card["']/);
    assert.match(institutions, /from ["'].*public-initiative-mini-card["']/);
    assert.match(home, /PublicInitiativeMiniCard/);
    assert.match(institutions, /PublicInitiativeMiniCard/);
  });

  it("catalog keys cover mini-card chrome with en/uk/zh-Hant/ar parity", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of MINI_CARD_CHROME_KEYS) {
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

  it("does not hard-code View Initiative chrome in the component", () => {
    const card = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    assert.match(card, /useTranslations\("publicInitiativeMiniCard"\)/);
    assert.match(card, /t\("viewInitiative"\)/);
    assert.doesNotMatch(card, /View Initiative/);
    assert.doesNotMatch(card, /Updated \{/);
    assert.match(card, /t\("updated"/);
    assert.match(card, /t\("likesDislikes"/);
    assert.match(card, /t\("shareAria"/);
    assert.match(card, /t\("viewAria"/);
  });
});

describe("Pack 08I.4 — publicHome.statistics catalog keys", () => {
  it("HumanityUnionInNumbers uses publicHome.statistics translations and locale formatting", () => {
    const section = readWeb(
      "features/platform-statistics/components/HumanityUnionInNumbers.tsx",
    );
    assert.match(section, /useTranslations\("publicHome\.statistics"\)/);
    assert.match(section, /useLocale\(\)/);
    assert.match(section, /formatPlatformStatisticValue\(value, locale\)/);
    assert.match(section, /formatMembershipStatisticValue\(value, locale\)/);
    assert.match(section, /t\("title", siteName\)|t\("title".*siteName/);
    assert.match(section, /useLocalizedBrand/);
    assert.match(section, /t\(`cards\.\$\{card\.key[^}]*\}\.label`\)/);
    assert.doesNotMatch(section, /Humanity Union in Numbers/);
  });

  it("catalog keys cover statistics chrome with en/uk/zh-Hant/ar parity", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PUBLIC_HOME_STATISTICS_KEYS) {
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

  it("PublicStatisticsGrid accepts localized About/Unavailable chrome via props", () => {
    const grid = readWeb("features/platform-statistics/components/PublicStatisticsGrid.tsx");
    assert.match(grid, /aboutMetricLabel/);
    assert.match(grid, /unavailableValueLabel/);
    assert.match(grid, /formatUnavailableAriaLabel/);
  });
});
