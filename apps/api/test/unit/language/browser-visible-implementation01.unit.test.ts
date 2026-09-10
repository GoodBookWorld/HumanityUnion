/**
 * Browser-Visible Localization — Implementation 01
 * Locale isolation (RSS) + Improvement Proposals Part D CT ownership.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
  LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS,
  buildImprovementProposalCtFields,
  isCompleteLocalizedProseBag,
  mayApplyPersistedLocalizedPresentation,
} from "@hu/types";

import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../../../src/modules/language/content-translation-eligibility.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const webRoot = path.resolve(here, "../../../../web");

describe("Implementation 01 — locale isolation + Improvement Proposals", () => {
  it("1. locale isolation fail-closed: mode + locale must both qualify", async () => {
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "ar",
        requestedLocale: "ar",
        mode: undefined,
      }),
      false,
      "A. matching locale + mode undefined => rejected",
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "ar",
        requestedLocale: "ar",
        mode: null,
      }),
      false,
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "ar",
        requestedLocale: "ar",
        mode: "CANONICAL_FALLBACK",
      }),
      false,
      "B. matching locale + CANONICAL_FALLBACK => rejected",
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "ar",
        requestedLocale: "ar",
        mode: "PUBLISHED_LOCALIZED",
      }),
      true,
      "C. matching locale + PUBLISHED_LOCALIZED => accepted",
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "uk",
        requestedLocale: "ar",
        mode: "PUBLISHED_LOCALIZED",
      }),
      false,
    );

    const { resolvePublicNewsCardFieldsFromPlp } = await import(
      "../../../../web/src/features/public-news/resolve-public-news-card-fields-from-plp.js"
    );
    const article = {
      id: "news-1",
      title: "English title",
      summary: "English summary",
      category: "peace and security",
      sourceName: "Outlet",
      articleUrl: "https://example.org/a",
      publishedAt: "2026-01-01T00:00:00.000Z",
      imageUrl: undefined,
    };
    const rejected = resolvePublicNewsCardFieldsFromPlp({
      article,
      requestedLocale: "ar",
      plpPresentation: {
        mode: "PUBLISHED_LOCALIZED",
        locale: "uk",
        presentation: { title: "Українська назва", summary: "Український опис" },
      },
    });
    assert.equal(rejected.presentationMode, "canonical");
    assert.equal(rejected.title, "English title");
    assert.equal(rejected.summary, "English summary");
  });

  it("2. language switch from /uk/media → Arabic navigates to Arabic document locale", async () => {
    const { resolveLocaleSwitchNavigationHref } = await import(
      "../../../../web/src/features/language/resolve-locale-switch-navigation-href.js"
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({ pathname: "/uk/media", nextLocale: "ar" }),
      "/ar/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({ pathname: "/uk/media", nextLocale: "en" }),
      "/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({ pathname: "/workspace", nextLocale: "ar" }),
      null,
    );

    const section = readFileSync(
      path.join(webRoot, "src/features/public-news/components/PublicNewsSection.tsx"),
      "utf8",
    );
    assert.match(section, /localeMatchedSsrPlp/);
    assert.match(section, /mayApplyPersistedLocalizedPresentation/);
  });

  it("3. Part D prose is CT-owned; category has one owner (not dual CT+WEB_UI leaf)", () => {
    assert.equal(LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS.length, 0);
    assert.deepEqual(
      [...CONTENT_TRANSLATION_FIELD_ALLOWLIST.improvement_proposal],
      [...IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS],
    );
    assert.doesNotMatch(
      CONTENT_TRANSLATION_FIELD_ALLOWLIST.improvement_proposal.join(","),
      /currentIssue|proposedChange|rationale/,
    );
    // D. category is not a CT complete-bag leaf (controlled key embedded in reason prose only).
    assert.equal(
      IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS.includes("category" as never),
      false,
    );

    const publicResult = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      ),
      "utf8",
    );
    assert.match(publicResult, /PublicTranslatedFields/);
    assert.match(publicResult, /sourceKind="improvement_proposal"/);
    assert.match(publicResult, /IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS/);
    assert.doesNotMatch(publicResult, /MANUAL_AUTHOR/);
    // Standalone category must not be dual-owned via CT fieldLabels + WEB_UI key.
    assert.doesNotMatch(publicResult, /category:\s*t\(["']author\.proposal\.fields\.category["']\)/);
    const bag = buildImprovementProposalCtFields({
      title: "t",
      summary: "s",
      description: "d",
      reason: "",
      expectedImprovement: "e",
      supportingSources: "",
      relatedDiscussionReferences: "r",
      huSystemGeneration: {
        descriptionKind: "single_excerpt",
        raisedCount: 1,
        reasonKind: "raised_by",
        participantCount: 2,
        category: "Funding",
        discussionStageToken: "{lifecycleStage:discussion}",
        helpfulCount: 0,
        memberCount: 3,
        supportingSourcesKind: "related_comments",
      },
    });
    assert.equal("category" in bag, false);
    assert.match(bag.reason, /Funding/);
  });

  it("4. incomplete Improvement Proposal localized bag falls back coherently", () => {
    const original = buildImprovementProposalCtFields({
      title: "Title EN",
      summary: "Summary EN",
      description: "Description EN",
      reason: "Reason EN",
      expectedImprovement: "Expected EN",
      supportingSources: "Sources EN",
      relatedDiscussionReferences: "Refs EN",
      huSystemGeneration: {
        descriptionKind: "single_excerpt",
        raisedCount: 1,
        reasonKind: "raised_by",
        participantCount: 2,
        category: "Funding",
        discussionStageToken: "{lifecycleStage:discussion}",
        helpfulCount: 0,
        memberCount: 3,
        supportingSourcesKind: "related_comments",
      },
    });
    const incomplete = {
      ...original,
      title: "عنوان",
      summary: "",
    };
    assert.equal(
      isCompleteLocalizedProseBag({
        originalFields: original,
        localizedFields: incomplete,
        requiredFields: IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
      }),
      false,
    );
    const complete = { ...original };
    for (const key of IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS) {
      if (original[key]?.trim()) {
        complete[key] = `[ar] ${original[key]}`;
      }
    }
    assert.equal(
      isCompleteLocalizedProseBag({
        originalFields: original,
        localizedFields: complete,
        requiredFields: IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
      }),
      true,
    );
  });

  it("5. Part D publish enqueues CT warm; generated prose is localization-eligible", () => {
    const service = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.ts",
      ),
      "utf8",
    );
    assert.match(service, /scheduleContentTranslationWarmAfterMutation/);
    assert.match(service, /sourceKind:\s*"improvement_proposal"/);

    const loader = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-civic-loaders.ts",
      ),
      "utf8",
    );
    assert.match(loader, /findPublishedStructuredProposalById/);
    assert.match(loader, /buildImprovementProposalCtFields/);
  });

  it("6. public RSS/IP read paths do not invoke TranslationProvider/Gemini", () => {
    for (const rel of [
      "apps/web/src/features/public-news/use-localized-public-news-card.ts",
      "apps/web/src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      "apps/web/src/features/language/components/PublicTranslatedFields.tsx",
    ]) {
      const src = readFileSync(path.join(repoRoot, rel), "utf8");
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /generateContentTranslation/);
      assert.doesNotMatch(src, /\/translations\/generate/);
    }
  });
});

/**
 * Implementation 01A — future-language genericity (engine must not hardcode
 * en/uk/ar/zh-Hant). Fixture locale `de` is not a claim that German catalogs exist.
 */
describe("Implementation 01A — future-language genericity", () => {
  it("1. routing + locale isolation accept arbitrary future locale without branches", async () => {
    const { resolveLocaleSwitchNavigationHref } = await import(
      "../../../../web/src/features/language/resolve-locale-switch-navigation-href.js"
    );
    const { resolvePublicNewsCardFieldsFromPlp } = await import(
      "../../../../web/src/features/public-news/resolve-public-news-card-fields-from-plp.js"
    );

    assert.equal(
      resolveLocaleSwitchNavigationHref({ pathname: "/uk/media", nextLocale: "de" }),
      "/de/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/ar/initiatives/public/abc",
        nextLocale: "fr",
      }),
      "/fr/initiatives/public/abc",
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "uk",
        requestedLocale: "de",
        mode: "PUBLISHED_LOCALIZED",
      }),
      false,
    );
    assert.equal(
      mayApplyPersistedLocalizedPresentation({
        presentationLocale: "de",
        requestedLocale: "de",
        mode: "PUBLISHED_LOCALIZED",
      }),
      true,
    );

    const rejected = resolvePublicNewsCardFieldsFromPlp({
      article: {
        id: "news-de",
        title: "English title",
        summary: "English summary",
        category: "peace and security",
        sourceName: "Outlet",
        articleUrl: "https://example.org/a",
        publishedAt: "2026-01-01T00:00:00.000Z",
        imageUrl: undefined,
      },
      requestedLocale: "de",
      plpPresentation: {
        mode: "PUBLISHED_LOCALIZED",
        locale: "uk",
        presentation: { title: "Українська", summary: "Опис" },
      },
    });
    assert.equal(rejected.presentationMode, "canonical");

    // Engine sources must not whitelist the current fixture locale set.
    for (const rel of [
      "packages/types/src/domain/persisted-presentation-locale-isolation.ts",
      "apps/web/src/features/language/resolve-locale-switch-navigation-href.ts",
      "apps/web/src/features/public-news/resolve-public-news-card-fields-from-plp.ts",
    ]) {
      const src = readFileSync(path.join(repoRoot, rel), "utf8");
      assert.doesNotMatch(src, /\["en",\s*"uk",\s*"ar"/);
      assert.doesNotMatch(src, /zh-Hant/);
      assert.doesNotMatch(src, /switch\s*\(\s*locale\s*\)/);
    }
  });

  it("2. Improvement Proposal CT warm targets follow Registry, not uk/ar/zh-Hant lists", async () => {
    const {
      createLanguageRegistryRecord,
      ensureLanguageRegistrySeeded,
      listAutomaticContentTranslationTargetLocales,
      resetLanguageRegistryStoreForTests,
      setLanguageRegistryForceMemoryForTests,
    } = await import("../../../src/modules/language/index.js");

    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    try {
      await ensureLanguageRegistrySeeded();
      await createLanguageRegistryRecord({
        languageId: "lang-de-future-01a",
        locale: "de",
        englishName: "German",
        nativeName: "Deutsch",
        textDirection: "ltr",
        enabled: true,
        contentTranslationEnabled: true,
      });

      const targets = await listAutomaticContentTranslationTargetLocales({
        excludeSourceLanguage: "en",
      });
      assert.ok(
        targets.includes("de" as never),
        "Registry-enabled future locale de must be a warm target without code changes",
      );

      const service = readFileSync(
        path.join(
          repoRoot,
          "apps/api/src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.ts",
        ),
        "utf8",
      );
      assert.match(service, /scheduleContentTranslationWarmAfterMutation/);
      assert.doesNotMatch(service, /targetLocales:\s*\[/);
      assert.doesNotMatch(service, /\["uk"|'uk',\s*'ar'|zh-Hant/);

      const publicResult = readFileSync(
        path.join(
          webRoot,
          "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
        ),
        "utf8",
      );
      assert.match(publicResult, /PublicTranslatedFields/);
      assert.doesNotMatch(publicResult, /locale\s*===\s*["']uk["']/);
      assert.doesNotMatch(publicResult, /switch\s*\(\s*locale\s*\)/);
    } finally {
      resetLanguageRegistryStoreForTests();
      setLanguageRegistryForceMemoryForTests(false);
    }
  });
});
