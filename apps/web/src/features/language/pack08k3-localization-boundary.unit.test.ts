/**
 * Pack 08K.3 — close runtime localization boundary bypasses.
 * Deterministic fixtures only — no live Gemini / no staging mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  getLocalizedCountryDisplayName,
  normalizeGeographicDisplayLocale,
  resolveAdminRegionDisplayName,
  resolveCountryDisplayName,
  resolveUnRegionDisplayName,
  resolveUnSubregionDisplayName,
} from "@hu/geography";
import type { PublicNewsArticleItem } from "@hu/types";
import { unwrapPublicPresentationValue } from "@hu/types";

import {
  buildCompletePublicNewsFixtureTranslations,
  buildPublicNewsArticlePresentation,
  localizePublicNewsArticlePresentation,
  readPublicNewsPresentationTitle,
  readPublicNewsProtectedArticleUrl,
  readPublicNewsProtectedSourceName,
} from "../language/adapters/public-news-article-presentation.js";
import { collectAutoTranslatableNodes } from "../language/public-localized-presentation.js";
import { runUniversalLocalizationCoverageGate } from "../language/universal-localization-coverage-gate.js";
import {
  resetPublicNewsFixtureTranslationsForTests,
  resolveLocalizedPublicNewsCardView,
  seedCompletePublicNewsFixtureForTests,
} from "../public-news/use-localized-public-news-card.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "../../..");
const repoRoot = join(webRoot, "../..");

function readWeb(rel: string): string {
  return readFileSync(join(webRoot, "src", rel), "utf8");
}

function readApi(rel: string): string {
  return readFileSync(join(repoRoot, "apps/api/src", rel), "utf8");
}

function sampleArticle(
  overrides: Partial<PublicNewsArticleItem> = {},
): PublicNewsArticleItem {
  return {
    id: "news-pack08k3-1",
    sourceName: "The Atlantic",
    title: "Civic shoreline restoration expands",
    summary: "Communities organize a public initiative around coastal habitats.",
    articleUrl: "https://example.com/news/shoreline",
    publishedAt: "2026-09-01T12:00:00.000Z",
    language: "en",
    category: "Environment",
    geographicScope: "CA",
    verificationStatus: "external-source",
    ...overrides,
  };
}

afterEach(() => {
  resetPublicNewsFixtureTranslationsForTests();
});

describe("Pack 08K.3 geography display names", () => {
  it("A–D: country display names for en/uk/zh-Hant/ar", () => {
    const en = resolveCountryDisplayName({ countryCode: "CA", locale: "en" });
    const uk = resolveCountryDisplayName({ countryCode: "CA", locale: "uk" });
    const zh = resolveCountryDisplayName({ countryCode: "CA", locale: "zh-Hant" });
    const ar = resolveCountryDisplayName({ countryCode: "CA", locale: "ar" });
    assert.equal(en.identity, "CA");
    assert.equal(en.displayName, "Canada");
    assert.notEqual(uk.displayName, "Canada");
    assert.notEqual(zh.displayName, "Canada");
    assert.notEqual(ar.displayName, "Canada");
    assert.equal(normalizeGeographicDisplayLocale("zh-TW"), "zh-Hant");
    assert.equal(getLocalizedCountryDisplayName("UA", "uk").length > 0, true);
  });

  it("E: UN region / subregion display name localization", () => {
    const region = resolveUnRegionDisplayName({
      englishRegion: "Americas",
      locale: "uk",
    });
    const sub = resolveUnSubregionDisplayName({
      englishSubregion: "Northern America",
      locale: "ar",
    });
    assert.equal(region.source, "platform_override");
    assert.notEqual(region.displayName, "Americas");
    assert.equal(sub.source, "platform_override");
    assert.notEqual(sub.displayName, "Northern America");
  });

  it("F: canonical geography ID unchanged", () => {
    const result = resolveCountryDisplayName({ countryCode: "ca", locale: "zh-Hant" });
    assert.equal(result.identity, "CA");
  });

  it("G: unknown geography safely falls back", () => {
    const result = resolveCountryDisplayName({
      countryCode: "ZZ",
      locale: "uk",
      fallback: "Mystery Land",
    });
    assert.equal(result.displayName, "Mystery Land");
    const admin = resolveAdminRegionDisplayName({
      countryCode: "CA",
      regionCode: "NO-SUCH",
      locale: "uk",
    });
    assert.equal(admin.source, "fallback");
  });
});

describe("Pack 08K.3 public news presentation", () => {
  it("H–K: shared card presentation localizes title/summary; protects URL/source", () => {
    const article = sampleArticle();
    const locale = "uk";
    seedCompletePublicNewsFixtureForTests(article, locale);
    const view = resolveLocalizedPublicNewsCardView({ article, locale });
    assert.match(view.title, /^\[uk\]/);
    assert.match(view.summary, /^\[uk\]/);
    assert.equal(view.sourceName, "The Atlantic");
    assert.equal(view.articleUrl, "https://example.com/news/shoreline");
    assert.equal(view.coverage.canonicalFallbackNodeCount, 0);
    assert.equal(view.coverage.status, "COMPLETE");
  });

  it("L: every mounted public-news-card path uses shared localized presentation", () => {
    const card = readWeb("features/public-news/components/PublicNewsCard.tsx");
    const alternate = readWeb("features/public-news/components/NewsArticleCard.tsx");
    const section = readWeb("features/public-news/components/PublicNewsSection.tsx");
    assert.match(card, /useLocalizedPublicNewsCard/);
    assert.match(alternate, /useLocalizedPublicNewsCard/);
    assert.match(section, /PublicNewsCard/);
    assert.doesNotMatch(card, /\{article\.title\}/);
    assert.doesNotMatch(card, /\{article\.summary\}/);
  });

  it("M/U: unknown nested semantic media field auto-localizes without allowlist edit", () => {
    const article = sampleArticle();
    const withExtension = {
      ...article,
      extensions: {
        editorialNote: "Nested editorial context never allowlisted",
        deeper: { callout: "Deep nested semantic prose" },
      },
    };
    const translations = buildCompletePublicNewsFixtureTranslations(
      withExtension,
      "zh-Hant",
    );
    assert.ok(translations["extensions.editorialNote"]);
    assert.ok(translations["extensions.deeper.callout"]);
    const localized = localizePublicNewsArticlePresentation({
      article: withExtension,
      targetLanguage: "zh-Hant",
      translations,
    });
    assert.equal(localized.coverage.canonicalFallbackNodeCount, 0);
    const nodes = collectAutoTranslatableNodes(localized.presentation);
    assert.ok(nodes.some((n) => n.path === "extensions.editorialNote"));
    assert.ok(nodes.some((n) => n.path === "extensions.deeper.callout"));
  });

  it("protected identity wrappers preserve source name / URL", () => {
    const tree = buildPublicNewsArticlePresentation(sampleArticle());
    assert.equal(unwrapPublicPresentationValue(tree.sourceName), "The Atlantic");
    assert.equal(
      readPublicNewsProtectedArticleUrl(tree),
      "https://example.com/news/shoreline",
    );
    assert.equal(readPublicNewsProtectedSourceName(tree), "The Atlantic");
    assert.equal(readPublicNewsPresentationTitle(tree), sampleArticle().title);
  });
});

describe("Pack 08K.3 ACTUC ownership", () => {
  it("N–S: modal uses next-intl + brand; no raw English participant literals", () => {
    const modal = readWeb(
      "features/public-home-v2/components/ActucPresentationModal.tsx",
    );
    assert.match(modal, /useTranslations\(["']actuc["']\)/);
    assert.match(modal, /useLocalizedBrand/);
    assert.doesNotMatch(modal, /Close ACTUC presentation/);
    assert.doesNotMatch(modal, /Fighting Ignorance/);
    assert.doesNotMatch(modal, /Join The Vanguard/);
    assert.doesNotMatch(modal, /ACTIVE DEFENSE/);
    const en = JSON.parse(
      readFileSync(join(webRoot, "src/features/i18n/messages/en.json"), "utf8"),
    );
    const uk = JSON.parse(
      readFileSync(join(webRoot, "src/features/i18n/messages/uk.json"), "utf8"),
    );
    const zh = JSON.parse(
      readFileSync(join(webRoot, "src/features/i18n/messages/zh-Hant.json"), "utf8"),
    );
    const ar = JSON.parse(
      readFileSync(join(webRoot, "src/features/i18n/messages/ar.json"), "utf8"),
    );
    assert.equal(typeof en.actuc.close, "string");
    assert.notEqual(uk.actuc.close, en.actuc.close);
    assert.notEqual(zh.actuc.titleLead, en.actuc.titleLead);
    assert.notEqual(ar.actuc.cta, en.actuc.cta);
  });
});

describe("Pack 08K.3 boundary / locale / thin diagnostic", () => {
  it("T: suspicious raw semantic rendering diagnostic covers reported surfaces", () => {
    const gate = runUniversalLocalizationCoverageGate(join(webRoot, "src"));
    const unexpected = gate.governedUnexpectedBypasses.filter((row) =>
      [
        "features/country-experience/components/CountryExperienceDynamicPage.tsx",
        "features/public-news/components/PublicNewsCard.tsx",
        "features/public-home-v2/components/ActucPresentationModal.tsx",
      ].some((path) => row.file.endsWith(path) || row.file.includes(path)),
    );
    assert.deepEqual(unexpected, []);
  });

  it("V: news presentation uses interface locale — not readingLanguages[0]", () => {
    const hook = readWeb("features/public-news/use-localized-public-news-card.ts");
    const card = readWeb("features/public-news/components/PublicNewsCard.tsx");
    assert.match(hook, /useLocale/);
    assert.doesNotMatch(hook, /readingLanguages/);
    assert.doesNotMatch(card, /readingLanguages/);
  });

  it("Q: thin diagnostic architecture preserved", () => {
    const thin = readApi("scripts/diagnose-localization-residuals.ts");
    const entry = readApi("scripts/reconcile-public-localization.ts");
    assert.match(thin, /thin-localization-diagnostic/);
    assert.doesNotMatch(thin, /reconcile-public-localization-heavy/);
    assert.match(entry, /OPERATOR_DEPRECATED_MEMORY_UNSAFE/);
  });

  it("country page hero no longer renders raw country.name", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    assert.doesNotMatch(page, /\{country\.name\}/);
    assert.match(page, /countryDisplayName/);
  });
});
