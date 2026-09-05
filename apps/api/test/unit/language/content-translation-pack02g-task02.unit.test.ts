/**
 * Production Completion Pack 02G Task 02 — content translation eligibility + sourceVersion contract.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative } from "@hu/types";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS,
  CONTENT_TRANSLATION_RESULT_EVENT_NAMES,
  assertAutomaticContentTranslationTargetLocale,
  assertCanonicalSourceEligibleForTranslation,
  assertPublicFieldsAllowlisted,
  buildContentTranslationSourceVersion,
  buildContentTranslationWarmRequestedCommand,
  buildContentTranslationWorkIdentity,
  buildContentTranslationWorkIdentityKey,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  isContentTranslationResultEventName,
  isContentTranslationWarmRequestCommandName,
  isPrivacyExcludedTranslationSurface,
  isRedundantTargetLanguage,
  isSupportedContentTranslationSourceKind,
  listAutomaticContentTranslationTargetLocales,
  loadTranslatableSource,
  markTranslationStaleIfSourceChanged,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolvePublicTranslatedContent,
  resolveStructuredTranslatedDisplay,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  DeterministicTranslationProvider,
  TranslationProviderError,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function sampleInitiative(overrides?: Partial<Initiative>): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t02-${Date.now()}`,
    stewardId: "member-pack02g-t02",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants will restore a local river with evidence-based steps.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

describe("Production Completion Pack 02G Task 02 — eligibility + sourceVersion contract", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: false,
    });
    await createLanguageRegistryRecord({
      locale: "g2-warm-a",
      englishName: "Warm A",
      nativeName: "Warm A",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      uiTranslationStatus: "complete",
      searchEnabled: true,
      seoIndexingEnabled: true,
    });
    await createLanguageRegistryRecord({
      locale: "g2-warm-b",
      englishName: "Warm B",
      nativeName: "Warm B",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    await createLanguageRegistryRecord({
      locale: "g2-warm-disabled",
      englishName: "Warm Disabled",
      nativeName: "Warm Disabled",
      textDirection: "ltr",
      enabled: false,
      contentTranslationEnabled: false,
    });
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1–8. automatic warm targets require enabled+contentTranslationEnabled; aliases dedupe; ordered; source excluded", async () => {
    const targets = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes("g2-warm-a"));
    assert.ok(targets.includes("g2-warm-b"));
    assert.ok(!targets.includes("uk")); // enabled but contentTranslationEnabled=false
    assert.ok(!targets.includes("g2-warm-disabled"));
    assert.ok(!targets.includes("en"));
    assert.ok(!targets.includes("ar")); // seed disabled

    // Unrelated flags do not enable warming.
    await updateLanguageRegistryRecord("lang-uk", {
      searchEnabled: true,
      seoIndexingEnabled: true,
      uiTranslationStatus: "complete",
    });
    const afterFlags = await listAutomaticContentTranslationTargetLocales();
    assert.ok(!afterFlags.includes("uk"));

    await assert.rejects(
      () => assertAutomaticContentTranslationTargetLocale("uk"),
      TranslationProviderError,
    );
    await assert.rejects(
      () => assertAutomaticContentTranslationTargetLocale("g2-warm-disabled"),
      TranslationProviderError,
    );
    assert.equal(await assertAutomaticContentTranslationTargetLocale("g2-warm-a"), "g2-warm-a");

    // Aliases collapse to canonical zh-Hant once enabled for content translation.
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    const withZh = await listAutomaticContentTranslationTargetLocales();
    assert.equal(withZh.filter((locale) => locale === "zh-Hant").length, 1);
    assert.ok(!withZh.includes("zh-TW"));
    assert.equal(
      await assertAutomaticContentTranslationTargetLocale("zh-TW"),
      "zh-Hant",
    );

    // Deterministic ordering among warm fixtures
    const orderedWarm = withZh.filter((locale) => locale.startsWith("g2-warm-"));
    assert.deepEqual(orderedWarm, [...orderedWarm].sort((a, b) => a.localeCompare(b)));
    assert.deepEqual([...withZh], [...withZh].sort((a, b) => a.localeCompare(b)));
  });

  it("9. on-demand remains compatible when contentTranslationEnabled=false", async () => {
    const onDemand = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "on_demand",
    });
    assert.equal(onDemand.generated, true);
    assert.ok(onDemand.translation);

    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      TranslationProviderError,
    );

    const defaultIntent = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(defaultIntent.generated, false);
  });

  it("10–12. sourceVersion deterministic; eligible field change bumps; private metadata ignored when not in fields", async () => {
    const fields = { title: "A", description: "B" };
    const stamp = "2026-08-31T00:00:00.000Z";
    const v1 = buildContentTranslationSourceVersion({ fields, versionStamp: stamp });
    const v1Again = buildContentTranslationSourceVersion({ fields, versionStamp: stamp });
    assert.equal(v1, v1Again);

    const v2 = buildContentTranslationSourceVersion({
      fields: { title: "A", description: "CHANGED" },
      versionStamp: stamp,
    });
    assert.notEqual(v1, v2);

    // Private/steward metadata is not hashed when omitted from eligible fields.
    const withoutPrivate = buildContentTranslationSourceVersion({
      fields,
      versionStamp: stamp,
    });
    const stillWithoutPrivate = buildContentTranslationSourceVersion({
      fields: { title: "A", description: "B" },
      versionStamp: stamp,
    });
    assert.equal(withoutPrivate, stillWithoutPrivate);
    assert.doesNotMatch(JSON.stringify(fields), /stewardId|rawSource|messageHeaders/);

    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(before);
    updateInitiative(initiative.initiativeId, {
      title: "Clean River Initiative Updated",
    });
    const after = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(after);
    assert.notEqual(before.sourceVersion, after.sourceVersion);
    assert.equal(after.fields.title, "Clean River Initiative Updated");
  });

  it("13–15. stale not current; missing/provider failure fall back to canonical", async () => {
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "g2-warm-a",
      generateIfMissing: true,
    });
    const stale = markTranslationStaleIfSourceChanged({
      translation: created.translation!,
      liveSourceVersion: "v-changed",
    });
    assert.equal(stale.stale, true);

    const display = resolveStructuredTranslatedDisplay({
      originalFields: created.source.fields,
      originalLanguage: created.source.sourceLanguage,
      preferredReadingLanguage: "g2-warm-a",
      translationPreference: "preferred",
      translations: [{ ...stale, sourceVersion: "v-old" }],
    });
    assert.equal(display.presentationMode, "original");
    assert.deepEqual(display.content, created.source.fields);

    const missing = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g2-warm-b",
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(missing.presentationMode, "original");

    setTranslationProviderForTests({
      providerId: "failing",
      async translate() {
        throw new TranslationProviderError("provider_error", "boom");
      },
    });
    const failed = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "g2-warm-b",
      translationPreference: "preferred",
      generateIfMissing: true,
    });
    assert.equal(failed.presentationMode, "original");
    assert.equal(initiative.title, "Clean River Initiative");
  });

  it("16–18. work identity deterministic; version/locale change identity", () => {
    const a = buildContentTranslationWorkIdentity({
      sourceKind: "initiative",
      sourceRecordId: "id-1",
      sourceVersion: "v-aaa",
      targetLanguage: "g2-warm-a",
    });
    const keyA = buildContentTranslationWorkIdentityKey(a);
    assert.equal(
      keyA,
      buildContentTranslationWorkIdentityKey({
        sourceKind: "initiative",
        sourceRecordId: "id-1",
        sourceVersion: "v-aaa",
        targetLanguage: "g2-warm-a",
      }),
    );
    assert.notEqual(
      keyA,
      buildContentTranslationWorkIdentityKey({
        ...a,
        sourceVersion: "v-bbb",
      }),
    );
    assert.notEqual(
      keyA,
      buildContentTranslationWorkIdentityKey({
        ...a,
        targetLanguage: "g2-warm-b",
      }),
    );
  });

  it("19–20. public/safety required; no private fields in allowlist/provider payload", async () => {
    assert.equal(isSupportedContentTranslationSourceKind("initiative"), true);
    for (const surface of CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS) {
      assert.equal(isPrivacyExcludedTranslationSurface(surface), true);
      assert.equal(isSupportedContentTranslationSourceKind(surface), false);
    }

    assert.throws(
      () =>
        assertPublicFieldsAllowlisted({
          sourceKind: "initiative",
          fields: { title: "t", description: "d", stewardId: "secret" },
        }),
      TranslationProviderError,
    );

    assert.throws(
      () =>
        assertCanonicalSourceEligibleForTranslation({
          intent: "automatic_warm",
          source: {
            sourceKind: "initiative",
            sourceRecordId: "x",
            sourceLanguage: "en",
            fields: { title: "t", description: "d" },
            sourceVersion: "v-1",
            isPublished: false,
            safetyCleared: true,
          },
        }),
      /published/i,
    );

    const loaded = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(loaded);
    assert.deepEqual(
      Object.keys(loaded.fields).sort(),
      [...CONTENT_TRANSLATION_FIELD_ALLOWLIST.initiative].sort(),
    );
    assert.ok(!("stewardId" in loaded.fields));
    assert.ok(!("rawSource" in loaded.fields));
  });

  it("21–23. Initiative / Analysis / Petition on-demand behavior preserved", async () => {
    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "g2-warm-a",
      generateIfMissing: true,
    });
    assert.equal(result.generated, true);
    assert.equal(result.source.sourceKind, "initiative");
    assert.deepEqual(Object.keys(result.source.fields).sort(), ["description", "title"]);

    assert.equal(
      isRedundantTargetLanguage({ sourceLanguage: "en", targetLanguage: "en" }),
      true,
    );
    const sameLang = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "en",
      generateIfMissing: true,
    });
    assert.equal(sameLang.translation, null);
    assert.equal(sameLang.generated, false);

    const warm = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "g2-warm-a",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(warm.generated, false);
    assert.ok(warm.translation);

    assert.deepEqual(
      [...CONTENT_TRANSLATION_FIELD_ALLOWLIST.collaborative_analysis],
      [
        "title",
        "summary",
        "supportingEvidence",
        "risks",
        "openQuestions",
        "suggestedImprovements",
        "references",
      ],
    );
    assert.deepEqual(
      [...CONTENT_TRANSLATION_FIELD_ALLOWLIST.petition],
      [
        "title",
        "summary",
        "requestStatement",
        "expectedOutcome",
        "supportingContext",
        "keyArguments",
      ],
    );
  });

  it("24–25. warm request seam distinct from TranslationPublished/Corrected; no search/SEO/UI side effects", () => {
    const cmd = buildContentTranslationWarmRequestedCommand({
      sourceKind: "initiative",
      sourceRecordId: "id-1",
      reason: "public_mutation",
      requestedAt: "2026-08-31T00:00:00.000Z",
    });
    assert.equal(cmd.commandName, CONTENT_TRANSLATION_WARM_REQUESTED);
    assert.equal(cmd.reason, "public_mutation");
    assert.equal("sourceVersion" in cmd, false);
    assert.equal("targetLanguage" in cmd, false);
    assert.equal(isContentTranslationWarmRequestCommandName(cmd.commandName), true);
    assert.equal(isContentTranslationResultEventName(cmd.commandName), false);
    for (const name of CONTENT_TRANSLATION_RESULT_EVENT_NAMES) {
      assert.equal(isContentTranslationResultEventName(name), true);
      assert.equal(isContentTranslationWarmRequestCommandName(name), false);
      assert.notEqual(name, CONTENT_TRANSLATION_WARM_REQUESTED);
    }

    const warmRequestSource = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-warm-request.ts"),
      "utf8",
    );
    assert.doesNotMatch(warmRequestSource, /enqueueDomainEvent|enqueueOutbox|outbox\.repository/);
    assert.match(warmRequestSource, /ContentTranslationWarmRequested/);
    assert.match(warmRequestSource, /TranslationPublished/);
    assert.match(warmRequestSource, /TranslationCorrected/);

    const warmTargetsSource = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-warm-targets.ts"),
      "utf8",
    );
    assert.doesNotMatch(warmTargetsSource, /\.searchEnabled|\.seoIndexingEnabled|\.uiTranslationStatus/);
    assert.match(warmTargetsSource, /contentTranslationEnabled/);

    // Allowlist includes Task 03 civic kinds; warm command remains source-level / result-event distinct.
    assert.deepEqual(Object.keys(CONTENT_TRANSLATION_FIELD_ALLOWLIST).sort(), [
      "blog_post",
      "civic_archive",
      "civic_media",
      "collaborative_analysis",
      "collective_decision",
      "decision_session",
      "discussion_comment",
      "implementation_commitment",
      "implementation_tracking",
      "improvement_proposal",
      "initiative",
      "initiative_revision",
      "lifecycle_stage",
      "official_response",
      "petition",
      "public_impact",
      "public_news",
    ]);
    assert.ok(Object.keys(CONTENT_TRANSLATION_FIELD_ALLOWLIST).includes("discussion_comment"));
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.discussion_comment], ["body"]);
    assert.ok(Object.keys(CONTENT_TRANSLATION_FIELD_ALLOWLIST).includes("improvement_proposal"));
    assert.ok(Object.keys(CONTENT_TRANSLATION_FIELD_ALLOWLIST).includes("collective_decision"));
    assert.ok(Object.keys(CONTENT_TRANSLATION_FIELD_ALLOWLIST).includes("civic_archive"));
  });
});
