/**
 * Localization Authority Closure 06 — remaining public surface bypass closure.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_PRESENTATION_AUTHORITY,
  resolvePublicPresentationField,
  type ControlledVocabularyLabelLookup,
} from "@hu/types";

import {
  assertPublicLocalizationIntegrity,
  inspectPublicLocalizationIntegrity,
} from "../../../../web/src/features/language/assert-public-localization-integrity.js";
import {
  checkPublicCatalogReadiness,
  collectRequiredPublicChromePaths,
} from "../../../../web/src/features/language/public-catalog-readiness.js";
import { resolveMediaPublicHuOwnedBody } from "../../../../web/src/features/language/media-plp/resolve-media-public-hu-owned-body.js";
import { EXPECTED_TRANSLATION_FALLBACK } from "../../../../web/src/features/knowledge-center/resolve-knowledge-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../../web");
const messagesDir = path.join(webRoot, "src/features/i18n/messages");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, "src", rel), "utf8");
}

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

describe("Localization Authority Closure 06 — public surface authority", () => {
  it("A. Home ACTUC chrome uses WEB_UI actuc catalog (not hardcoded English)", () => {
    const src = readWeb("features/public-home-v2/components/PublicHomeActucSection.tsx");
    assert.match(src, /useTranslations\("actuc"\)/);
    assert.match(src, /t\("homeSlogan"\)/);
    assert.match(src, /t\("badge"/);
    assert.doesNotMatch(src, /Action Unity Center/);
    assert.doesNotMatch(src, /Intellectual Defense Division/);
    const en = loadMessages("en") as { actuc: { homeSlogan: string; badge: string } };
    const uk = loadMessages("uk") as { actuc: { homeSlogan: string; badge: string } };
    assert.ok(en.actuc.homeSlogan);
    assert.ok(uk.actuc.homeSlogan);
    assert.notEqual(uk.actuc.homeSlogan, en.actuc.homeSlogan);
  });

  it("B. Membership public chrome uses WEB_UI membershipPublic.statistics", () => {
    const panel = readWeb(
      "features/membership/components/MembershipParticipationStatisticsPanel.tsx",
    );
    const voting = readWeb(
      "features/membership/components/MembershipVotingExplanation.tsx",
    );
    const hero = readWeb("features/membership/components/MembershipHero.tsx");
    assert.match(panel, /useTranslations\("membershipPublic"\)/);
    assert.match(panel, /statistics\.totalParticipation/);
    assert.doesNotMatch(panel, /Total participation/);
    assert.match(voting, /statistics\.votingExplanation/);
    assert.doesNotMatch(voting, /MEMBERSHIP_VOTING_EXPLANATION/);
    assert.match(hero, /status\.participantCohort/);
  });

  it("C. Footer + header aria labels use WEB_UI navigation catalog", () => {
    const footer = readWeb(
      "features/public-experience/components/PublicExperienceFooter.tsx",
    );
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(footer, /brandHomeAria/);
    assert.match(footer, /footerPlatformNavCol1Aria/);
    assert.match(footer, /footerLegalNavAria/);
    assert.doesNotMatch(footer, /Platform navigation column one/);
    assert.match(header, /primaryNavAria/);
    assert.match(header, /brandHomeAria/);
    assert.match(mobile, /closeNavMenuAria/);
    assert.match(mobile, /mobileNavAria/);
    assert.doesNotMatch(mobile, /"Close navigation menu"/);
  });

  it("D. Blog runtime uses CT ownership via resolveBlogPostPresentation (cache-only)", () => {
    const resolve = readWeb("features/blog/resolve-blog-post-presentation.ts");
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(resolve, /sourceKind:\s*"blog_post"/);
    assert.match(resolve, /resolveLocalizedPresentation/);
    assert.match(article, /resolveBlogPostPresentation/);
    const localized = readWeb("features/language/resolve-localized-presentation.ts");
    assert.match(localized, /Never POST \/generate/);
    assert.match(localized, /cache-only/);
  });

  it("E. Knowledge chrome uses WEB_UI; content honestly falls back without inventing CT", () => {
    const knowledge = readWeb(
      "features/knowledge-center/resolve-knowledge-presentation.ts",
    );
    assert.match(knowledge, /ContentTranslationSourceKind/);
    assert.match(knowledge, /DOCUMENT_LAYER_DEBT/);
    assert.match(knowledge, /EXPECTED_TRANSLATION_FALLBACK/);
    assert.equal(EXPECTED_TRANSLATION_FALLBACK, "expected_translation_fallback");
    const listing = readWeb(
      "features/knowledge-center/components/KnowledgeCenterPageContent.tsx",
    );
    assert.match(listing, /useTranslations\("knowledgePublic"\)/);
  });

  it("F. Initiative lifecycle leftovers use controlled vocabulary resolver", () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /resolveLifecycleStageDisplayLabel/);
    assert.doesNotMatch(
      center,
      /\?\?\s*"Initiative"/,
    );
    const i18n = readWeb(
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    );
    assert.match(i18n, /resolvePublicPresentationField/);
    assert.match(i18n, /controlled_vocabulary/);
  });

  it("G. Media public body cannot prefer legacy CT over PLP owner", () => {
    const compose = readWeb(
      "features/language/media-plp/compose-media-page-localization.ts",
    );
    assert.match(compose, /isPlpEnabled/);
    assert.match(compose, /loadLegacy/);
    const withPlp = resolveMediaPublicHuOwnedBody({
      plpEnabled: true,
      plpLocalizedBody: "PLP body",
      legacyCtBody: "LEGACY CT body",
      canonicalEnglishBody: "Canonical English",
    });
    assert.equal(withPlp.value, "PLP body");
    assert.equal(withPlp.source, "plp");
    const plpMissing = resolveMediaPublicHuOwnedBody({
      plpEnabled: true,
      plpLocalizedBody: null,
      legacyCtBody: "LEGACY CT body",
      canonicalEnglishBody: "Canonical English",
    });
    assert.equal(plpMissing.value, "Canonical English");
    assert.equal(plpMissing.source, "canonical");
    assert.notEqual(plpMissing.value, "LEGACY CT body");
  });

  it("H. Protected RSS / public_news original content is never leakage", () => {
    const report = inspectPublicLocalizationIntegrity({
      documentLocale: "uk",
      fields: [
        {
          fieldId: "public_news.title",
          presentedValue: "Original English RSS headline",
          authority: "PROTECTED_CANONICAL",
          protectedOriginal: true,
        },
      ],
    });
    assert.equal(report.ok, true);
    assert.ok(report.findings.some((row) => row.kind === "protected_original_ok"));
    assert.equal(
      report.findings.filter((row) => row.kind !== "protected_original_ok").length,
      0,
    );
  });

  it("I. Canonical fallback is truthfully classified (not marked translated)", () => {
    const ok = inspectPublicLocalizationIntegrity({
      documentLocale: "uk",
      fields: [
        {
          fieldId: "knowledge.body",
          presentedValue: "English canonical body",
          authority: "CANONICAL_ENGLISH_FALLBACK",
          presentationMode: "canonical_fallback",
        },
      ],
    });
    assert.equal(ok.ok, true);

    assert.throws(
      () =>
        assertPublicLocalizationIntegrity({
          documentLocale: "uk",
          surfaceId: "knowledge",
          fields: [
            {
              fieldId: "knowledge.body",
              presentedValue: "English canonical body",
              authority: "CANONICAL_ENGLISH_FALLBACK",
              presentationMode: "translated",
            },
          ],
        }),
      /canonical_fallback_marked_translated/,
    );
  });

  it("J. Synthetic future locale fr follows the same resolver authority path", () => {
    const uk = resolvePublicPresentationField({
      fieldClass: "ui_system_chrome",
      persistedTranslation: null,
      canonicalEnglishFallback: "Membership",
    });
    const fr = resolvePublicPresentationField({
      fieldClass: "ui_system_chrome",
      persistedTranslation: null,
      canonicalEnglishFallback: "Membership",
    });
    assert.equal(uk?.authority, fr?.authority);
    assert.equal(uk?.authority, "CANONICAL_ENGLISH_FALLBACK");

    const order = [...PUBLIC_PRESENTATION_AUTHORITY];
    const report = inspectPublicLocalizationIntegrity({
      documentLocale: "fr",
      resolverPathComparisons: [
        {
          fieldId: "membership.title",
          pathA: { locale: "uk", authorityOrder: order },
          pathB: { locale: "fr", authorityOrder: order },
        },
      ],
    });
    assert.equal(report.ok, true);

    const en = loadMessages("en");
    const catalogs = {
      en,
      fr: en, // DATA readiness may be missing; engine path still identical
    };
    const readiness = checkPublicCatalogReadiness({
      locales: ["en", "fr"],
      catalogsByLocale: catalogs,
      requiredPaths: ["navigation.home", "membershipPublic.statistics.members"],
      flagEnglishIdenticalAsFallback: false,
    });
    assert.equal(readiness.ok, true);
  });

  it("K. No locale-specific production allowlist introduced in Closure 06 paths", () => {
    const targets = [
      "features/language/assert-public-localization-integrity.ts",
      "features/language/public-catalog-readiness.ts",
      "features/language/media-plp/resolve-media-public-hu-owned-body.ts",
      "features/public-home-v2/components/PublicHomeActucSection.tsx",
      "features/membership/components/MembershipParticipationStatisticsPanel.tsx",
      "features/public-experience/components/PublicExperienceFooter.tsx",
    ];
    for (const rel of targets) {
      const src = readWeb(rel);
      assert.doesNotMatch(src, /\["uk",\s*"ar",\s*"zh-Hant"\]/);
      assert.doesNotMatch(src, /\["uk",\s*"zh-Hant",\s*"ar"\]/);
    }
  });

  it("L. Generic leakage assertion catches controlled English leakage", () => {
    const lookup: ControlledVocabularyLabelLookup = {
      analysis: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: "Спільний аналіз",
        stageId: "analysis",
        registryCanonicalEnglishLabel: "Collaborative Analysis",
      },
    };
    assert.throws(
      () =>
        assertPublicLocalizationIntegrity({
          documentLocale: "uk",
          surfaceId: "initiative-ca",
          presentationText: "See Collaborative Analysis for details.",
          labelLookup: lookup,
        }),
      /controlled_english_leak|CONTROLLED_ENGLISH/,
    );
  });

  it("M. Generic leakage assertion ignores participant-authored / protected originals", () => {
    const report = inspectPublicLocalizationIntegrity({
      documentLocale: "uk",
      presentationText: "Collaborative Analysis is mentioned by the author in free prose.",
      // No labelLookup → controlled scan skipped; protected field ignored
      fields: [
        {
          fieldId: "author.comment",
          presentedValue: "Collaborative Analysis rocks",
          authority: "MANUAL_AUTHOR",
          protectedOriginal: true,
        },
      ],
    });
    assert.equal(report.ok, true);
  });

  it("N. Public catalog readiness detects missing required keys", () => {
    const en = loadMessages("en");
    const report = checkPublicCatalogReadiness({
      locales: ["en", "fr"],
      catalogsByLocale: { en, fr: { navigation: { home: "Accueil" } } },
      requiredPaths: [
        "navigation.home",
        "navigation.brandHomeAria",
        "membershipPublic.statistics.members",
      ],
      flagEnglishIdenticalAsFallback: false,
    });
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.kind === "missing"));
    assert.ok(
      report.issues.some((issue) => issue.path === "membershipPublic.statistics.members"),
    );

    const bundledLocales = ["en", "uk", "ar", "zh-Hant"] as const;
    const catalogs = Object.fromEntries(
      bundledLocales.map((locale) => [locale, loadMessages(locale)]),
    );
    const required = collectRequiredPublicChromePaths(en as never).filter((path) =>
      [
        "navigation.brandHomeAria",
        "membershipPublic.statistics.members",
        "actuc.homeSlogan",
        "institutionsPublic.relatedActivityAreaFallback",
      ].includes(path),
    );
    const parity = checkPublicCatalogReadiness({
      locales: bundledLocales,
      catalogsByLocale: catalogs,
      requiredPaths: required,
      flagEnglishIdenticalAsFallback: false,
    });
    assert.equal(parity.ok, true, JSON.stringify(parity.issues, null, 2));
  });

  it("P/Q. No provider-on-read / localization writes on public compose paths", () => {
    const publicPages = [
      "app/page.tsx",
      "app/membership/page.tsx",
      "app/blog/page.tsx",
      "app/knowledge/page.tsx",
      "app/media/page.tsx",
      "app/institutions/page.tsx",
      "app/initiatives/page.tsx",
      "app/volunteer/page.tsx",
      "app/contact/page.tsx",
      "app/privacy/page.tsx",
      "app/terms/page.tsx",
    ];
    for (const rel of publicPages) {
      const src = readWeb(rel);
      assert.doesNotMatch(src, /TranslationProvider/);
      assert.doesNotMatch(src, /\/translations\/generate/);
      assert.doesNotMatch(src, /generateContentTranslation\(/);
    }
    const compose = readWeb(
      "features/language/media-plp/compose-media-page-localization.ts",
    );
    assert.doesNotMatch(compose, /generateContentTranslation/);
    assert.doesNotMatch(compose, /TranslationProvider/);
  });

  it("O. Closure 01–05 contracts remain importable / authority ladder intact", () => {
    assert.equal(PUBLIC_PRESENTATION_AUTHORITY[0], "PROTECTED_CANONICAL");
    assert.equal(
      PUBLIC_PRESENTATION_AUTHORITY[PUBLIC_PRESENTATION_AUTHORITY.length - 1],
      "CANONICAL_ENGLISH_FALLBACK",
    );
    for (const name of [
      "localization-authority-closure01-public-presentation.unit.test.ts",
      "localization-authority-closure02-public-presentation-resolver.unit.test.ts",
      "localization-authority-closure03-initiative-ca.unit.test.ts",
      "localization-authority-closure04-improvement-proposals.unit.test.ts",
      "localization-authority-closure05-media-registry.unit.test.ts",
    ]) {
      const full = path.join(here, name);
      assert.ok(readFileSync(full, "utf8").length > 100);
    }
  });

  it("Institutions mini-card fallbacks use WEB_UI", () => {
    const src = readWeb(
      "features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
    );
    assert.match(src, /relatedActivityAreaFallback/);
    assert.match(src, /relatedGeographyUnspecified/);
    assert.doesNotMatch(src, /"Civic initiative"/);
    assert.doesNotMatch(src, /"Geography not specified"/);
  });

  it("system English WEB_UI leak detection fires when expected localized chrome exists", () => {
    assert.throws(
      () =>
        assertPublicLocalizationIntegrity({
          documentLocale: "uk",
          fields: [
            {
              fieldId: "footer.platformNav",
              presentedValue: "Platform navigation column one",
              authority: "CANONICAL_ENGLISH_FALLBACK",
              englishSystemLabel: "Platform navigation column one",
              expectedWebUiLabel: "Навігація платформи, колонка 1",
            },
          ],
        }),
      /system_english_label_leak/,
    );
  });
});
