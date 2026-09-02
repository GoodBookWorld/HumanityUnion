/**
 * Pack 08I.1 / 08I.2 — Civic Archive public chrome localization residuals.
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
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const ARCHIVE_PUBLIC_KEYS = [
  "civicArchivePublic.pageTitle",
  "civicArchivePublic.pageIntro",
  "civicArchivePublic.filtersLoading",
  "civicArchivePublic.resultsTitle",
  "civicArchivePublic.resultsCount",
  "civicArchivePublic.resultsCountOne",
  "civicArchivePublic.idleInstruction",
  "civicArchivePublic.noMatch",
  "civicArchivePublic.unavailableTitle",
  "civicArchivePublic.unavailableBody",
  "civicArchivePublic.tryAgain",
  "civicArchivePublic.adjustSearch",
  "civicArchivePublic.activeFiltersAria",
  "civicArchivePublic.loadingResultsAria",
  "civicArchivePublic.emptySearchFeedback",
  "civicArchivePublic.filters.clearFilters",
] as const;

const ARCHIVE_DETAIL_KEYS = [
  "civicArchivePublic.detail.eyebrow",
  "civicArchivePublic.detail.emptyTitle",
  "civicArchivePublic.detail.emptyBody",
  "civicArchivePublic.detail.backToArchive",
  "civicArchivePublic.detail.viewPublicInitiative",
  "civicArchivePublic.detail.relatedNavAria",
  "civicArchivePublic.detail.metaOutcome",
  "civicArchivePublic.detail.metaGeography",
  "civicArchivePublic.detail.metaActivityArea",
  "civicArchivePublic.detail.metaStarted",
  "civicArchivePublic.detail.metaCompleted",
  "civicArchivePublic.detail.metaArchived",
  "civicArchivePublic.detail.sectionArchiveNarrative",
  "civicArchivePublic.detail.sectionFinalOutcome",
  "civicArchivePublic.detail.sectionDecisionSummary",
  "civicArchivePublic.detail.sectionImplementationSummary",
  "civicArchivePublic.detail.sectionPublicImpactSummary",
  "civicArchivePublic.detail.sectionOfficialResponses",
  "civicArchivePublic.detail.sectionArchiveEvidence",
  "civicArchivePublic.detail.seoNotFoundTitle",
  "civicArchivePublic.detail.seoDescriptionFallback",
  "civicArchivePublic.lifecycle.title",
  "civicArchivePublic.lifecycle.viewRecord",
  "civicArchivePublic.horizontal.loadingAria",
  "civicArchivePublic.horizontal.instructions",
  "civicArchivePublic.horizontal.previousAria",
  "civicArchivePublic.horizontal.nextAria",
  "civicArchivePublic.horizontal.previous",
  "civicArchivePublic.horizontal.next",
  "civicArchivePublic.horizontal.showingStatus",
] as const;

describe("Pack 08I.1 — Civic Archive public chrome", () => {
  it("catalog keys present in all 4 locales with parity", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of ARCHIVE_PUBLIC_KEYS) {
        assert.equal(
          typeof resolveInitiativeExperienceMessage(loaded.messages, key),
          "string",
          `${locale}:${key}`,
        );
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("page + loading shells use CivicArchivePageChrome / translated filters loading", () => {
    const page = readWeb("app/civic-archive/page.tsx");
    const loading = readWeb("app/civic-archive/loading.tsx");
    assert.match(page, /CivicArchivePageChrome/);
    assert.match(page, /CivicArchiveFiltersLoading/);
    assert.doesNotMatch(page, /Humanity Union Public Civic Archive/);
    assert.doesNotMatch(page, /Loading archive filters/);
    assert.match(loading, /CivicArchivePageChrome/);
    assert.match(loading, /loading/);
    assert.doesNotMatch(loading, /Humanity Union Public Civic Archive/);
  });

  it("ResultsPanel + SearchExperience use civicArchivePublic chrome keys", () => {
    const panel = readWeb(
      "features/public-civic-archive/components/CivicArchiveResultsPanel.tsx",
    );
    const experience = readWeb(
      "features/public-civic-archive/components/CivicArchiveSearchExperience.tsx",
    );
    const chrome = readWeb(
      "features/public-civic-archive/components/CivicArchivePageChrome.tsx",
    );

    assert.match(chrome, /useTranslations\("initiativeExperience\.civicArchivePublic"\)/);
    assert.match(chrome, /t\("pageTitle"\)/);
    assert.match(chrome, /t\("pageIntro"\)/);

    assert.match(panel, /useTranslations\("initiativeExperience\.civicArchivePublic"\)/);
    assert.match(panel, /t\("resultsTitle"\)/);
    assert.match(panel, /t\("resultsCount"/);
    assert.match(panel, /t\("resultsCountOne"/);
    assert.match(panel, /t\("idleInstruction"\)/);
    assert.match(panel, /t\("noMatch"\)/);
    assert.match(panel, /t\("unavailableTitle"\)/);
    assert.match(panel, /t\("adjustSearch"\)/);
    assert.match(panel, /filters\.clearFilters/);
    assert.doesNotMatch(panel, /Civic Archive Results/);
    assert.doesNotMatch(panel, /CIVIC_ARCHIVE_IDLE_INSTRUCTION/);
    assert.doesNotMatch(panel, /CIVIC_ARCHIVE_NO_MATCH_MESSAGE/);

    assert.match(experience, /t\("emptySearchFeedback"\)/);
    assert.doesNotMatch(experience, /CIVIC_ARCHIVE_EMPTY_SEARCH_MESSAGE/);
  });
});

describe("Pack 08I.2 — Civic Archive detail chrome", () => {
  it("detail / lifecycle / horizontal catalog keys present with parity", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of ARCHIVE_DETAIL_KEYS) {
        assert.equal(
          typeof resolveInitiativeExperienceMessage(loaded.messages, key),
          "string",
          `${locale}:${key}`,
        );
      }
    }

    const en = await loadUiMessagesForLocale("en");
    const enEyebrow = resolveInitiativeExperienceMessage(
      en.messages,
      "civicArchivePublic.detail.eyebrow",
    );
    assert.equal(typeof enEyebrow, "string");
    assert.match(enEyebrow as string, /\{siteName\}/);
    const enSeo = resolveInitiativeExperienceMessage(
      en.messages,
      "civicArchivePublic.detail.seoDescriptionFallback",
    );
    assert.equal(typeof enSeo, "string");
    assert.match(enSeo as string, /\{siteName\}/);
    assert.match(enSeo as string, /\{title\}/);

    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("detail page uses catalogs + resolveBrandForMetadata", () => {
    const page = readWeb("app/civic-archive/[initiativeId]/page.tsx");
    assert.match(page, /resolveBrandForMetadata/);
    assert.match(page, /getTranslations\("initiativeExperience\.civicArchivePublic"\)/);
    assert.match(page, /getLocale/);
    assert.match(page, /detail\.eyebrow/);
    assert.match(page, /siteName:\s*brand\.siteName/);
    assert.match(page, /titleBrandSuffix:\s*brand\.seoTitleSuffix/);
    assert.match(page, /brand\.seoSiteName/);
    assert.match(page, /detail\.seoDescriptionFallback/);
    assert.match(page, /detail\.seoNotFoundTitle/);
    assert.match(page, /detail\.metaOutcome/);
    assert.match(page, /detail\.sectionArchiveNarrative/);
    assert.match(page, /detail\.viewPublicInitiative/);
    assert.match(page, /detail\.backToArchive/);
    assert.match(page, /detail\.relatedNavAria/);
    assert.doesNotMatch(page, /Humanity Union Public Civic Archive/);
    assert.doesNotMatch(page, /Archive record is not available/);
    assert.doesNotMatch(page, /View Public Initiative/);
    assert.doesNotMatch(page, /Back to Civic Archive/);
    assert.doesNotMatch(page, /Related civic records/);
    assert.doesNotMatch(page, /Civic Archive on Humanity Union/);
  });

  it("LifecycleTimeline + HorizontalResults use translated chrome", () => {
    const timeline = readWeb(
      "features/public-civic-archive/components/CivicArchiveLifecycleTimeline.tsx",
    );
    const horizontal = readWeb(
      "features/public-civic-archive/components/CivicArchiveHorizontalResults.tsx",
    );

    assert.match(
      timeline,
      /useTranslations\("initiativeExperience\.civicArchivePublic\.lifecycle"\)/,
    );
    assert.match(timeline, /t\("title"\)/);
    assert.match(timeline, /t\("viewRecord"\)/);
    assert.doesNotMatch(timeline, /Documented lifecycle/);
    assert.doesNotMatch(timeline, /View record →/);

    assert.match(
      horizontal,
      /useTranslations\("initiativeExperience\.civicArchivePublic\.horizontal"\)/,
    );
    assert.match(horizontal, /t\("loadingAria"\)/);
    assert.match(horizontal, /t\("instructions"\)/);
    assert.match(horizontal, /t\("previousAria"\)/);
    assert.match(horizontal, /t\("nextAria"\)/);
    assert.match(horizontal, /t\("showingStatus"/);
    assert.doesNotMatch(horizontal, /Loading archive results/);
    assert.doesNotMatch(horizontal, /Previous archive records/);
    assert.doesNotMatch(horizontal, /Next archive records/);
  });
});
