/**
 * Pack 08I.2 — Brand Localization unit tests.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { CANONICAL_ENGLISH_BRAND_FALLBACK } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "../../../src/modules/administration/persistence/administration-audit.repository.js";
import {
  BrandLocalizationValidationError,
  ENGLISH_BRAND_LOCALIZATION_ID,
  ensureBrandLocalizationSeeded,
  getBrandLocalizationByLocale,
  listBrandLocalizations,
  listPublishedBrandLocalizationSummaries,
  publishAdminBrandLocalization,
  resetBrandLocalizationStoreForTests,
  resolveCanonicalBrandLocaleForTests,
  resolveLocalizedBrand,
  setBrandLocalizationAdminAssertOverrideForTests,
  setBrandLocalizationForceMemoryForTests,
  updateAdminBrandLocalization,
  upsertAdminBrandLocalization,
  upsertBrandLocalization,
} from "../../../src/modules/brand-localization/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const moduleRoot = path.join(repoRoot, "apps/api/src/modules/brand-localization");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Pack 08I.2 — Brand Localization", () => {
  beforeEach(async () => {
    setBrandLocalizationForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setAdministrationAuditForceMemoryForTests(true);
    resetBrandLocalizationStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setBrandLocalizationAdminAssertOverrideForTests(async (userId) => {
      if (!userId.trim()) {
        throw new AdministrationUnauthorizedError();
      }
      if (userId === "member-1") {
        throw new AdministrationForbiddenError("Administrator access is required.");
      }
      if (userId !== "admin-1") {
        throw new AdministrationUnauthorizedError();
      }
      return { userId: "admin-1", participantId: "participant-admin-1" };
    });
    await ensureLanguageRegistrySeeded();
    await ensureBrandLocalizationSeeded();
  });

  afterEach(() => {
    setBrandLocalizationAdminAssertOverrideForTests(null);
    resetBrandLocalizationStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
    setBrandLocalizationForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setAdministrationAuditForceMemoryForTests(false);
  });

  it("seeds English published record from CANONICAL_ENGLISH_BRAND_FALLBACK", async () => {
    const seed = await ensureBrandLocalizationSeeded();
    assert.equal(seed.skippedExisting, 1);
    const english = await getBrandLocalizationByLocale("en");
    assert.ok(english);
    assert.equal(english.brandId, ENGLISH_BRAND_LOCALIZATION_ID);
    assert.equal(english.status, "published");
    assert.equal(english.siteName, CANONICAL_ENGLISH_BRAND_FALLBACK.siteName);
    assert.equal(english.slogan, CANONICAL_ENGLISH_BRAND_FALLBACK.slogan);
    assert.equal(english.heroUnityQuote, CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote);
    assert.equal(english.seoSiteName, CANONICAL_ENGLISH_BRAND_FALLBACK.seoSiteName);
    assert.equal(
      english.defaultMetaDescription,
      CANONICAL_ENGLISH_BRAND_FALLBACK.defaultMetaDescription,
    );
  });

  it("enforces one record per canonical locale and alias canonicalize", async () => {
    const tw = await resolveCanonicalBrandLocaleForTests("zh-TW");
    const hant = await resolveCanonicalBrandLocaleForTests("zh-Hant");
    assert.equal(tw, hant);

    const first = await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "zh-TW",
        siteName: "人類聯盟",
        slogan: "世界團結",
        heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
        seoSiteName: "人類聯盟",
        defaultMetaDescription: "世界團結公民科技平台",
        status: "draft",
      },
    });
    assert.equal(first.locale, "zh-Hant");

    const second = await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "zh-Hant",
        siteName: "人類聯盟 2",
        slogan: "世界團結",
        heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
        seoSiteName: "人類聯盟",
        defaultMetaDescription: "世界團結公民科技平台",
        status: "draft",
      },
    });
    assert.equal(second.brandId, first.brandId);
    assert.equal(second.locale, "zh-Hant");

    const all = await listBrandLocalizations();
    const zhRows = all.filter((row) => row.locale === "zh-Hant" || row.locale === "zh-TW");
    assert.equal(zhRows.length, 1);
  });

  it("rejects unknown registry locale and requires publish fields", async () => {
    await assert.rejects(
      () =>
        upsertAdminBrandLocalization({
          actorUserId: "admin-1",
          body: {
            locale: "xx-NOT-A-LOCALE",
            siteName: "X",
            slogan: "Y",
            heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
            seoSiteName: "Z",
            defaultMetaDescription: "D",
          },
        }),
      BrandLocalizationValidationError,
    );

    const draft = await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "uk",
        siteName: "Спілка Людства",
        slogan: "СВІТОВА СОЛІДАРНІСТЬ",
        heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
        seoSiteName: "Спілка Людства",
        defaultMetaDescription: "Громадянська технологічна платформа",
        status: "draft",
      },
    });
    assert.equal(draft.status, "draft");

    await assert.rejects(
      () =>
        updateAdminBrandLocalization({
          actorUserId: "admin-1",
          locale: "uk",
          body: {
            siteName: " ",
            status: "published",
          },
        }),
      BrandLocalizationValidationError,
    );

    await assert.rejects(
      () =>
        upsertAdminBrandLocalization({
          actorUserId: "admin-1",
          body: {
            locale: "uk",
            siteName: "Спілка Людства",
            slogan: "СВІТОВА СОЛІДАРНІСТЬ",
            heroUnityQuote: " ",
            seoSiteName: "Спілка Людства",
            defaultMetaDescription: "desc",
            status: "published",
          },
        }),
      BrandLocalizationValidationError,
    );

    await assert.rejects(
      () =>
        upsertAdminBrandLocalization({
          actorUserId: "admin-1",
          body: {
            locale: "uk",
            siteName: "Спілка Людства",
            slogan: "",
            heroUnityQuote: "Цитата",
            seoSiteName: "Спілка Людства",
            defaultMetaDescription: "desc",
            status: "published",
          },
        }),
      BrandLocalizationValidationError,
    );
  });

  it("heroUnityQuote persists, resolves, and is required for publish", async () => {
    const ukQuote = "З часом,\nлюбов і відповідальність\nгартують людяність";
    const draft = await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "uk",
        siteName: "Спілка Людства",
        slogan: "СВІТОВА СОЛІДАРНІСТЬ",
        heroUnityQuote: ukQuote,
        seoSiteName: "Спілка Людства",
        defaultMetaDescription: "Громадянська технологічна платформа",
        status: "draft",
      },
    });
    assert.equal(draft.heroUnityQuote, ukQuote);

    const draftResolve = await resolveLocalizedBrand("uk");
    assert.equal(draftResolve.source, "published_english");
    assert.equal(
      draftResolve.heroUnityQuote,
      CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    );

    const published = await publishAdminBrandLocalization({
      actorUserId: "admin-1",
      locale: "uk",
    });
    assert.equal(published.status, "published");
    assert.equal(published.heroUnityQuote, ukQuote);

    const ukResolved = await resolveLocalizedBrand("uk");
    assert.equal(ukResolved.source, "published_locale");
    assert.equal(ukResolved.heroUnityQuote, ukQuote);

    const zhQuote = "日久見人心，\n愛與責任鍛造人性";
    await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "zh-Hant",
        siteName: "人類聯盟",
        slogan: "世界團結",
        heroUnityQuote: zhQuote,
        seoSiteName: "人類聯盟",
        defaultMetaDescription: "世界團結公民科技平台",
        status: "published",
      },
    });
    const zhResolved = await resolveLocalizedBrand("zh-TW");
    assert.equal(zhResolved.source, "published_locale");
    assert.equal(zhResolved.heroUnityQuote, zhQuote);

    const arQuote = "مع مرور الوقت،\nالحب والمسؤولية يصنعان الإنسانية";
    await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "ar",
        siteName: "اتحاد الإنسانية",
        slogan: "تضامن عالمي",
        heroUnityQuote: arQuote,
        seoSiteName: "اتحاد الإنسانية",
        defaultMetaDescription: "منصة تكنولوجيا مدنية",
        status: "published",
      },
    });
    const arResolved = await resolveLocalizedBrand("ar");
    assert.equal(arResolved.heroUnityQuote, arQuote);

    const enResolved = await resolveLocalizedBrand("en");
    assert.equal(enResolved.heroUnityQuote, CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote);
  });

  it("resolveLocalizedBrand: published locale → published en → builtin; unpublished not public", async () => {
    const enResolved = await resolveLocalizedBrand("en");
    assert.equal(enResolved.source, "published_locale");
    assert.equal(enResolved.siteName, CANONICAL_ENGLISH_BRAND_FALLBACK.siteName);

    await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "uk",
        siteName: "Спілка Людства",
        slogan: "СВІТОВА СОЛІДАРНІСТЬ",
        heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
        seoSiteName: "Спілка Людства",
        defaultMetaDescription: "Громадянська технологічна платформа",
        status: "draft",
      },
    });

    const draftFallback = await resolveLocalizedBrand("uk");
    assert.equal(draftFallback.source, "published_english");
    assert.equal(draftFallback.locale, "en");
    assert.equal(draftFallback.requestedLocale, "uk");

    const published = await publishAdminBrandLocalization({
      actorUserId: "admin-1",
      locale: "uk",
    });
    assert.equal(published.status, "published");

    const ukResolved = await resolveLocalizedBrand("uk");
    assert.equal(ukResolved.source, "published_locale");
    assert.equal(ukResolved.siteName, "Спілка Людства");
    assert.equal(ukResolved.locale, "uk");

    const summaries = await listPublishedBrandLocalizationSummaries();
    assert.ok(summaries.some((row) => row.locale === "uk"));
    assert.ok(summaries.every((row) => row.status === "published"));

    // Unpublish English → builtin when resolving a locale without its own published row.
    const english = await getBrandLocalizationByLocale("en");
    assert.ok(english);
    await upsertBrandLocalization({
      ...english,
      status: "draft",
      updatedAt: new Date().toISOString(),
    });

    // Remove uk published so resolve falls through English → builtin.
    await upsertBrandLocalization({
      ...published,
      status: "draft",
      updatedAt: new Date().toISOString(),
    });

    const builtin = await resolveLocalizedBrand("uk");
    assert.equal(builtin.source, "builtin_english");
    assert.equal(builtin.siteName, CANONICAL_ENGLISH_BRAND_FALLBACK.siteName);
    assert.equal(builtin.slogan, CANONICAL_ENGLISH_BRAND_FALLBACK.slogan);
    assert.equal(builtin.heroUnityQuote, CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote);
  });

  it("locale is immutable on update and alias resolve uses published canonical", async () => {
    await upsertAdminBrandLocalization({
      actorUserId: "admin-1",
      body: {
        locale: "zh-Hant",
        siteName: "人類聯盟",
        slogan: "世界團結",
        heroUnityQuote: "Over time,\nlove and responsibility\nforge humanity",
        seoSiteName: "人類聯盟",
        defaultMetaDescription: "世界團結公民科技平台",
        status: "published",
      },
    });

    await assert.rejects(
      () =>
        updateAdminBrandLocalization({
          actorUserId: "admin-1",
          locale: "zh-Hant",
          body: { locale: "uk" },
        }),
      BrandLocalizationValidationError,
    );

    const viaAlias = await resolveLocalizedBrand("zh-TW");
    assert.equal(viaAlias.source, "published_locale");
    assert.equal(viaAlias.locale, "zh-Hant");
    assert.equal(viaAlias.requestedLocale, "zh-TW");
  });

  it("brand-localization module never imports Gemini / TranslationProvider / content_translations", () => {
    const files = collectTsFiles(moduleRoot);
    assert.ok(files.length > 0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        /^\s*import[\s\S]*?(TranslationProvider|gemini-translation|content_translations|content-translation)/im,
      );
      assert.doesNotMatch(
        source,
        /from\s+["'][^"']*(terminology-glossary|content-translation|gemini)[^"']*["']/i,
      );
    }
  });
});
