/**
 * Pack 02I / 02H residuals — Civic Archive + Global Search UI localization.
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

const ARCHIVE_FILTER_KEYS = [
  "civicArchivePublic.filters.search",
  "civicArchivePublic.filters.searchPlaceholder",
  "civicArchivePublic.filters.submit",
  "civicArchivePublic.filters.clearFilters",
  "civicArchivePublic.filters.activityArea",
  "civicArchivePublic.filters.allActivityAreas",
  "civicArchivePublic.filters.archiveYear",
  "civicArchivePublic.filters.outcomeStatus",
  "civicArchivePublic.filters.allOutcomes",
  "civicArchivePublic.filters.yearPlaceholder",
] as const;

const SEARCH_SAMPLE_KEYS = [
  "search.title",
  "search.submit",
  "search.clearFilters",
  "search.empty",
  "search.initialPrompt",
  "search.activityArea",
  "search.allActivityAreas",
  "search.recordType",
  "search.meta.title",
  "search.meta.description",
  "search.entityTypes.all",
  "search.entityTypes.initiative",
  "seo.home.title",
  "seo.home.description",
] as const;

describe("Pack 02I — Archive + Search UI localization", () => {
  it("catalog parity includes new archive filter + search + seo keys", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of ARCHIVE_FILTER_KEYS) {
        assert.equal(
          typeof resolveInitiativeExperienceMessage(loaded.messages, key),
          "string",
          `${locale}:${key}`,
        );
      }
      for (const key of SEARCH_SAMPLE_KEYS) {
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

  it("CivicArchiveFiltersForm uses civicArchivePublic.filters.* and activity area labels", () => {
    const form = readWeb("features/public-civic-archive/components/CivicArchiveFiltersForm.tsx");
    assert.match(form, /civicArchivePublic\.filters\.search/);
    assert.match(form, /civicArchivePublic\.filters\.clearFilters/);
    assert.match(form, /civicArchivePublic\.filters\.searchPlaceholder/);
    assert.match(form, /civicArchivePublic\.filters\.activityArea/);
    assert.match(form, /civicArchivePublic\.filters\.allActivityAreas/);
    assert.match(form, /civicArchivePublic\.filters\.archiveYear/);
    assert.match(form, /resolveActivityAreaDisplayLabel/);
    assert.doesNotMatch(form, />Search</);
    assert.doesNotMatch(form, /Clear Filters/);
    assert.doesNotMatch(form, /placeholder="Search archive records"/);
  });

  it("GlobalSearchPageContent uses search.* chrome keys and preserves API values", () => {
    const page = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    assert.match(page, /useTranslations\("search"\)/);
    assert.match(page, /t\("submit"\)/);
    assert.match(page, /t\("empty"\)/);
    assert.match(page, /t\("initialPrompt"\)/);
    assert.match(page, /t\("activityArea"\)/);
    assert.match(page, /resolveActivityAreaDisplayLabel/);
    assert.match(page, /ENTITY_TYPE_OPTIONS/);
    assert.match(page, /name="entityType"/);
    assert.match(page, /name="activityArea"/);
    assert.doesNotMatch(page, />Search civic records</);
    assert.doesNotMatch(page, /Enter keywords or select filters to find public civic records\./);
  });

  it("archive filters CSS uses min-width:0 / wrap for resilience", () => {
    const css = readWeb("app/civic-archive/civic-archive-page.css");
    assert.match(css, /\.civic-archive-page__filters\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.civic-archive-page__filter-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(css, /\.civic-archive-page__filters-row\s*\{[^}]*min-width:\s*0/s);
  });
});
