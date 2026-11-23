/**
 * HU-LOC-BRAND-01B — platform-name sentences use {siteName}.
 * The legal name Humanity Union Society stays literal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getBuiltinEnglishBrand } from "./resolve-localized-brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const LOCALES = ["en", "ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;

const LEGAL_KEYS = [
  "regionalProgramPublic.development.steps.team.body",
  "regionalProgramPublic.presence.notice",
  "regionalProgramPublic.principles.legal",
] as const;

const PLATFORM_KEYS = [
  "auth.loginSubtitle",
  "auth.deleteAccountIntro",
  "membershipPublic.faq.items.what-is-member.question",
  "volunteerPublic.intro.p1",
  "rrpApplication.consent.label",
] as const;

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function load(locale: string): Record<string, unknown> {
  return JSON.parse(read(`apps/web/src/features/i18n/messages/${locale}.json`)) as Record<
    string,
    unknown
  >;
}

function get(tree: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, tree);
}

function siteNameCount(value: string): number {
  return value.match(/\{siteName\}/g)?.length ?? 0;
}

describe("platform name uses published siteName", () => {
  it("replaces the platform name and keeps the surrounding sentence", () => {
    const english = load("en");
    assert.equal(get(english, "auth.loginSubtitle"), "Access your {siteName} workspace.");
    assert.equal(
      get(english, "auth.deleteAccountIntro"),
      "You can schedule deletion of your {siteName} account. The 30-day recovery period starts only after you confirm an email code.",
    );
    assert.match(String(get(english, "volunteerPublic.intro.p1")), /<platform>\{siteName\} platform<\/platform>/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /\{siteName\}/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /<privacy>/);

    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of PLATFORM_KEYS) {
        const value = get(catalog, key);
        if (typeof value !== "string") continue;
        assert.equal(siteNameCount(value), siteNameCount(String(get(english, key))), `${locale} ${key}`);
        const displayed = value.replaceAll("{siteName}", "Союз Людяності");
        assert.doesNotMatch(displayed, /\{siteName\}/, `${locale} ${key}`);
        assert.match(displayed, /Союз Людяності/);
      }
    }
  });

  it("keeps Humanity Union Society as the legal name", () => {
    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of LEGAL_KEYS) {
        const value = String(get(catalog, key));
        assert.match(value, /Humanity Union Society/, `${locale} ${key}`);
      }
    }
    const legal = String(get(load("en"), "regionalProgramPublic.principles.legal"));
    assert.match(legal, /\{siteName\}/);
    assert.match(legal, /Humanity Union Society/);
  });

  it("uses the builtin English siteName when Brand Localization is unavailable", () => {
    const fallback = getBuiltinEnglishBrand("ar");
    assert.equal(fallback.siteName, "Humanity Union");
    assert.equal(fallback.source, "builtin_english");
    const displayed = String(get(load("ar"), "auth.loginSubtitle")).replaceAll(
      "{siteName}",
      fallback.siteName,
    );
    assert.equal(displayed.includes("{siteName}"), false);
    assert.match(displayed, /Humanity Union/);
  });

  it("keeps Arabic and Hebrew RTL on the language registry, not in the catalog", () => {
    const layout = read("apps/web/src/app/layout.tsx");
    const catalog = read("apps/api/src/modules/language/language-catalog.ts");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(catalog, /code: "ar"[\s\S]{0,120}rtl: true/);
    assert.match(catalog, /code: "he"[\s\S]{0,120}rtl: true/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/ar.json"), /dir="ltr"/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/he.json"), /dir="ltr"/);
  });

  it("does not turn the glossary into a runtime replacement system", () => {
    const seed = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.seed.ts",
    );
    assert.match(seed, /conceptId: "humanity_union"/);
    assert.match(seed, /canonicalEnglishTerm: "Humanity Union"/);
    assert.match(seed, /translations: \{\}/);
    const provider = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.provider-context.ts",
    );
    assert.doesNotMatch(provider, /replaceAll\("Humanity Union"/);
  });

  it("protects approved published translations from Add missing overwrites", () => {
    const service = read(
      "apps/api/src/modules/web-ui-message-packs/web-ui-message-pack.service.ts",
    );
    assert.match(service, /Preserves every existing leaf/);
    assert.match(service, /preserveExistingPublishedLeaves: true/);
  });

  it("keeps the published nominative name grammatical", () => {
    const ka = load("ka");
    const georgian = [
      "civicActivity.pageSubtitle",
      "initiativeExperience.civicArchivePublic.pageTitle",
      "membershipPublic.faq.items.what-is-member.question",
      "initiativeExperience.manage.newsSource.disclaimer",
      "workspace.initiativesPage.subtitle",
      "pwa.install.installCta",
      "preferences.language.help",
    ];
    for (const key of georgian) {
      assert.doesNotMatch(String(get(ka, key)), /\{siteName\}[-\u10A0-\u10FF]/, key);
    }
    assert.equal(
      get(ka, "membershipPublic.faq.items.what-is-member.question"),
      "ვინ არის წევრი პლატფორმაზე «{siteName}»?",
    );
    assert.equal(get(ka, "pwa.install.installCta"), "დააინსტალირეთ {siteName}");

    const french = load("fr");
    assert.match(String(get(french, "auth.twoStepLoginHelp")), /à l'\{siteName\}/);
    assert.match(String(get(french, "authoringPage.application.motivationLabel")), /de l'\{siteName\}/);
    assert.doesNotMatch(String(get(french, "notifications.types.member_badge_delivered.message")), /de la \{siteName\}/);

    const spanish = load("es");
    assert.match(String(get(spanish, "auth.loginSubtitle")), /de la \{siteName\}/);
    assert.doesNotMatch(JSON.stringify(spanish), /la la \{siteName\}/);
    assert.equal(
      get(spanish, "membershipPublic.faq.items.what-is-member.question"),
      "¿Qué es un Miembro de la {siteName}?",
    );

    const german = load("de");
    for (const key of [
      "auth.chooseNewPasswordSubtitle",
      "auth.verifyEmailSubtitle",
      "initiativeExperience.author.archive.document.disclaimer",
      "initiativeExperience.publicChoice.election.eyebrow",
      "initiativeExperience.publicChoice.results.disclaimerBody",
      "preferences.unavailableExplanation",
      "pwa.install.androidStep5",
      "workspace.publishingPage.editor.seo.lede",
      "volunteerPublic.meaning.p4",
      "volunteerPublic.takePart.p3",
    ]) {
      assert.doesNotMatch(String(get(german, key)), /\{siteName\}-/, key);
    }
    assert.match(String(get(german, "auth.chooseNewPasswordSubtitle")), /Konto bei \{siteName\}/);
    assert.match(String(get(german, "volunteerPublic.meaning.p4")), /<platform>Plattform \{siteName\}<\/platform>/);

    assert.match(String(get(load("ar"), "membershipPublic.faq.items.what-is-member.question")), /في \{siteName\}/);
    assert.equal(
      get(load("uk"), "membershipPublic.faq.items.what-is-member.question"),
      "Хто такий член організації «{siteName}»?",
    );
    assert.equal(
      get(load("zh-Hant"), "membershipPublic.faq.items.what-is-member.question"),
      "什麼是{siteName}的會員？",
    );
    assert.match(String(get(load("pt"), "auth.loginSubtitle")), /da \{siteName\}/);
    assert.match(String(get(load("he"), "auth.loginSubtitle")), /ב\{siteName\}/);

    const corrected = {
      ka: georgian,
      fr: ["auth.twoStepLoginHelp", "authoringPage.application.motivationLabel"],
      es: ["auth.loginSubtitle", "membershipPublic.faq.items.what-is-member.question"],
      de: ["auth.chooseNewPasswordSubtitle", "volunteerPublic.meaning.p4"],
      ar: ["membershipPublic.faq.items.what-is-member.question"],
      uk: ["membershipPublic.faq.items.what-is-member.question"],
      "zh-Hant": ["membershipPublic.faq.items.what-is-member.question"],
    };
    for (const [locale, keys] of Object.entries(corrected)) {
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      for (const key of keys) {
        assert.equal(get(packaged, key), get(load(locale), key), `${locale} ${key}`);
      }
    }
  });

  it("packages the same corrected deletion intro as the WEB catalog", () => {
    for (const locale of LOCALES) {
      const web = get(load(locale), "auth.deleteAccountIntro");
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      assert.equal(get(packaged, "auth.deleteAccountIntro"), web, locale);
    }
  });
});
