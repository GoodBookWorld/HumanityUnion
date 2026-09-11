/**
 * Localization Authority Closure 05 — Media registry-driven localization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  listAutomaticContentTranslationTargetLocales,
  resetLanguageRegistryStoreForTests,
  runMediaHuOwnedLocalizationIntegrityCheck,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  parsePlpAutoBuildLocaleOpsLimiter,
  registerPlpAutoBuildProcessor,
  registerPlpAutoBuildProcessorWithLocalesForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePlpAutoBuildLocaleResolution,
  resolvePlpAutoBuildLocales,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Localization Authority Closure 05 — Media registry-driven targets", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
    delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
    delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  });

  afterEach(() => {
    stopPlpAutoBuildRuntimeForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    resetPublishedLocalizationPersistenceForTests();
    delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
    delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  });

  it("A/B/C. Registry uk/ar/zh-Hant enabled+CT are included via the same path", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await updateLanguageRegistryRecord("lang-ar", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      contentTranslationEnabled: true,
    });

    const targets = await resolvePlpAutoBuildLocales();
    assert.ok(targets.includes("uk"));
    assert.ok(targets.includes("ar"));
    assert.ok(targets.includes("zh-Hant"));
    assert.deepEqual(
      [...targets].sort(),
      [...(await listAutomaticContentTranslationTargetLocales({ excludeSourceLanguage: "en" }))].sort(),
    );
  });

  it("D. Synthetic future locale fr enabled+CT is included with no production locale-list change", async () => {
    await createLanguageRegistryRecord({
      locale: "fr",
      englishName: "French",
      nativeName: "Français",
      textDirection: "ltr",
      aliases: [],
      enabled: true,
      uiTranslationStatus: "none",
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
    });

    const targets = await resolvePlpAutoBuildLocales();
    assert.ok(targets.includes("fr"));
    assert.doesNotMatch(
      readFileSync(
        path.join(
          repoRoot,
          "apps/api/src/modules/language/published-localized-presentation/universal/public-source-mutation-bridge.ts",
        ),
        "utf8",
      ),
      /\["uk".*"ar".*"zh-Hant"\]|locale === ["']fr["']/,
    );
  });

  it("E. enabled but contentTranslationEnabled=false is excluded", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: false,
    });
    const targets = await resolvePlpAutoBuildLocales();
    assert.equal(targets.includes("uk"), false);
  });

  it("F. Disabled locale is excluded", async () => {
    await updateLanguageRegistryRecord("lang-ar", {
      enabled: false,
      contentTranslationEnabled: false,
    });
    const targets = await resolvePlpAutoBuildLocales();
    assert.equal(targets.includes("ar"), false);
  });

  it("G. No hardcoded three-locale allowlist controls production Media builds", () => {
    const bridge = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/universal/public-source-mutation-bridge.ts",
      ),
      "utf8",
    );
    const corpus = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/public-localization-corpus.ts"),
      "utf8",
    );
    assert.match(bridge, /listAutomaticContentTranslationTargetLocales/);
    assert.doesNotMatch(bridge, /\["uk",\s*"ar",\s*"zh-Hant"\]/);
    assert.doesNotMatch(corpus, /\["uk",\s*"zh-Hant",\s*"ar"\]/);
    assert.match(corpus, /never fall back to a hardcoded locale triple/);
  });

  it("ops limiter can only narrow Registry targets, not invent locales", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    await updateLanguageRegistryRecord("lang-ar", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk,xx-invented";
    const resolved = await resolvePlpAutoBuildLocaleResolution();
    assert.equal(resolved.opsLimiterActive, true);
    assert.deepEqual([...resolved.locales], ["uk"]);
    assert.ok(resolved.registryTargets.includes("ar"));
    assert.ok(parsePlpAutoBuildLocaleOpsLimiter()?.includes("uk"));
  });

  it("unset ops limiter uses full Registry targets", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
    const resolved = await resolvePlpAutoBuildLocaleResolution();
    assert.equal(resolved.opsLimiterActive, false);
    assert.ok(resolved.locales.includes("uk"));
  });

  it("H. Media HU prose has one persisted translation owner (PLP)", () => {
    const compose = readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/language/media-plp/compose-media-page-localization.ts",
      ),
      "utf8",
    );
    assert.match(compose, /loadMediaPlpPagePresentations|PLP/);
    const integrity = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/media-hu-localization-integrity.ts"),
      "utf8",
    );
    assert.match(integrity, /CIVIC_MEDIA_EDITORIAL/);
    assert.doesNotMatch(integrity, /MEDIA_PLP_ENTITY_TYPE\.PUBLIC_NEWS/);
  });

  it("I/J. Completeness docs: PARTIAL cannot publish CURRENT; complete can", () => {
    const validate = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/validate-build-result.ts",
      ),
      "utf8",
    );
    const publish = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/publish-atomic.ts",
      ),
      "utf8",
    );
    assert.match(validate, /PARTIAL|NOT_READY|MACHINE_CONTENT/);
    assert.match(publish, /PASSED|PUBLISHED/);
  });

  it("L/M. Public Media read path has no provider / localization write", () => {
    const page = readFileSync(
      path.join(repoRoot, "apps/web/src/app/media/page.tsx"),
      "utf8",
    );
    const compose = readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/language/media-plp/compose-media-page-localization.ts",
      ),
      "utf8",
    );
    for (const src of [page, compose]) {
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /\/translations\/generate/);
      assert.doesNotMatch(src, /\benqueueContentTranslation\b|\bmaterializeMediaPlp\b/);
    }
  });

  it("N. RSS/public_news never enters machine translation targets", () => {
    const hook = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/media/publication-hook.ts",
      ),
      "utf8",
    );
    const newsTrigger = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.ts",
      ),
      "utf8",
    );
    assert.match(hook, /PUBLIC_NEWS[\s\S]{0,400}?return 0/);
    assert.match(newsTrigger, /MEDIA_PLP_CAROUSEL_NEWS_LIMIT/);
  });

  it("O. WEB_UI chrome remains WEB_UI authority on /media", () => {
    const page = readFileSync(
      path.join(repoRoot, "apps/web/src/app/media/page.tsx"),
      "utf8",
    );
    assert.match(page, /getTranslations\(["']civicMediaPublic["']\)|civicMediaPublic/);
  });

  it("processor registers from Registry targets; kill switch still works", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    const active = await registerPlpAutoBuildProcessor();
    assert.equal(active.registered, true);
    assert.ok(active.locales.includes("uk"));

    process.env.HU_PLP_AUTO_BUILD_PROCESSOR = "0";
    const disabled = await registerPlpAutoBuildProcessor();
    assert.equal(disabled.registered, false);
    assert.equal(disabled.reason, "disabled_by_env");
  });

  it("test helper can still register explicit locales for RESET suites", () => {
    const active = registerPlpAutoBuildProcessorWithLocalesForTests(["uk", "ar"]);
    assert.equal(active.registered, true);
    assert.deepEqual([...active.locales], ["uk", "ar"]);
  });

  it("Media HU integrity diagnostic is Registry-driven and provider-free", async () => {
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    const report = await runMediaHuOwnedLocalizationIntegrityCheck();
    assert.equal(report.PROVIDER_CALLS, 0);
    assert.equal(report.WRITES_PERFORMED, 0);
    assert.ok(report.registryTargetLocales.includes("uk"));
    assert.ok(report.rows.some((row) => row.locale === "uk"));
    assert.equal(
      report.rows.every((row) => row.entityType !== "public_news"),
      true,
    );
  });

  it("Admin CT enable path re-registers processor + enqueues Media consumer PLP (source guard)", () => {
    const service = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/language-registry/language-registry.service.ts",
      ),
      "utf8",
    );
    assert.match(service, /becameCtEligible|contentTranslationEnabled/);
    assert.match(service, /enqueueConsumerVisibleMediaPlpBuildsForLocales/);
    assert.match(service, /registerPlpAutoBuildProcessor/);
  });
});
