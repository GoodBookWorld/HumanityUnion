/**
 * Pack 02G Task 08G — Archive completeness semantic summary + disclaimer + section titles.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER } from "@hu/types";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  resolveCivicArchiveCompletenessSummaryDisplay,
  resolveCivicArchiveSectionDisplayLabel,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

const SUMMARY_PART_CODES = [
  "stages_published",
  "public_impact_available",
  "public_impact_missing",
  "public_impact_available_optional",
  "public_impact_not_required_public_choice",
  "tracking_unresolved",
  "tracking_resolved",
  "commitments_unfinished",
  "commitments_finished",
] as const;

describe("Pack 02G Task 08G — Archive completeness + disclaimer", () => {
  it("catalog parity includes disclaimer + summaryParts in all locales", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof ieKey(loaded.messages, "author.archive.document.disclaimer"), "string");
      for (const code of SUMMARY_PART_CODES) {
        assert.equal(
          typeof ieKey(loaded.messages, `author.archive.completeness.summaryParts.${code}`),
          "string",
        );
      }
    }

    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      ieKey(en.messages, "author.archive.document.disclaimer"),
      INITIATIVE_LIFECYCLE_ARCHIVE_DISCLAIMER,
    );

    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("Ukrainian descriptor codes resolve without English leftovers", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const summary = resolveCivicArchiveCompletenessSummaryDisplay(
      {
        summary: "ENGLISH_SKEW_FALLBACK must not appear when descriptors present",
        summaryDescriptors: [
          { code: "stages_published", params: { count: 3 } },
          { code: "public_impact_available" },
          { code: "tracking_resolved" },
          { code: "commitments_finished" },
        ],
      },
      uk.messages,
    );

    assert.match(summary, /3/);
    assert.match(summary, /життєвого циклу|етап/);
    assert.doesNotMatch(summary, /Lifecycle stage/);
    assert.doesNotMatch(summary, /ENGLISH_SKEW_FALLBACK/);
    assert.doesNotMatch(summary, /A published Public Impact Report is available\./);
  });

  it("Completeness panel prefers descriptors over raw English summary", () => {
    const panel = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveCompletenessPanel.tsx",
    );
    assert.match(panel, /resolveCivicArchiveCompletenessSummaryDisplay/);
    assert.doesNotMatch(panel, /\{completeness\.summary\}/);
  });

  it("Document renderer prefers sectionId labels and catalog disclaimer", () => {
    const document = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDocumentRenderer.tsx",
    );
    assert.match(
      document,
      /resolveCivicArchiveSectionDisplayLabel\(section\.sectionId/,
    );
    assert.doesNotMatch(document, /section\.title\s*\|\|/);
    assert.match(document, /author\.archive\.document\.disclaimer/);
    assert.doesNotMatch(document, /\{document\.disclaimer\}/);
    assert.match(document, /resolveCivicArchiveCompletenessSummaryDisplay/);
  });

  it("resolveCivicArchiveSectionDisplayLabel preferred over English title when known", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolveCivicArchiveSectionDisplayLabel("archive_overview", uk.messages),
      "Огляд архіву",
    );
    assert.notEqual(
      resolveCivicArchiveSectionDisplayLabel("archive_overview", uk.messages),
      "Archive Overview",
    );
  });

  it("falls back to English summary when descriptors missing", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const fallback = resolveCivicArchiveCompletenessSummaryDisplay(
      {
        summary: "Skew English summary only.",
      },
      uk.messages,
    );
    assert.equal(fallback, "Skew English summary only.");
  });
});
