/**
 * STEP 15D.14.F.2 — ownership parity and Public News source-original.
 * No provider calls. No Mongo writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  emptyLanguageLocalizationCountBucket,
  isAuthoritativeMachineLocalizedPlpEntityType,
  isLocalizationSourceOriginalEntityType,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  deriveLanguageLocalizationReadinessState,
} from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { enqueuePlpBuildRequest } from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { enqueueConsumerVisibleNewsPlpBuilds } from "../../../src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { processPlpBuildRequest } from "../../../src/modules/language/published-localized-presentation/universal/process-plp-build-request.js";
import { isCollectedPathMachineEligible } from "../../../src/modules/language/published-localized-presentation/universal/field-authority.js";
import { resolveMediaPlpFieldPolicy } from "../../../src/modules/language/published-localized-presentation/universal/adapters/media-plp-field-policies.js";
import {
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { resetThinGeminiProviderStateForTests } from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readyInputs(
  plp: ReturnType<typeof emptyLanguageLocalizationCountBucket>,
  ct = emptyLanguageLocalizationCountBucket(),
) {
  return deriveLanguageLocalizationReadinessState({
    enabled: true,
    contentTranslationEnabled: true,
    webUiDataReady: true,
    participantWebUiDataReady: true,
    controlledVocabularyPresentationReady: true,
    ct,
    plpMedia: plp,
  });
}

describe("STEP 15D.14.F.2 ownership and Admin parity", () => {
  it("1–2 public_news title and summary are SOURCE_ORIGINAL", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "SOURCE_ORIGINAL");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "SOURCE_ORIGINAL");
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    const policy = resolveMediaPlpFieldPolicy("public_news");
    assert.equal(isCollectedPathMachineEligible("title", policy), false);
    assert.equal(isCollectedPathMachineEligible("summary", policy), false);
  });

  it("3 RSS refresh does not enqueue public_news translation", async () => {
    setPlpAutoBuildWorkForceMemoryForTests(true);
    resetPlpAutoBuildWorkStoreForTests();
    const result = await enqueueConsumerVisibleNewsPlpBuilds({ locales: ["uk", "ka"] });
    assert.equal(result.enqueued, 0);
    assert.equal(result.PROVIDER_CALLS, 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
    const direct = await enqueuePlpBuildRequest({
      entityType: "public_news",
      entityId: "news-1",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
    });
    assert.equal(direct.accepted, false);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
  });

  it("4–5 and 10 historical public_news cannot be claimed or sent to a provider", async () => {
    setPlpAutoBuildWorkForceMemoryForTests(true);
    resetPlpAutoBuildWorkStoreForTests();
    resetThinGeminiProviderStateForTests();
    await upsertPendingPlpAutoBuildWork({
      entityType: "public_news",
      entityId: "historical-news",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
    });
    await upsertPendingPlpAutoBuildWork({
      entityType: "civic_media_trusted",
      entityId: "trusted-1",
      locale: "ka",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.equal(claimed?.entityType, "civic_media_trusted");
    const news = listPlpAutoBuildWorkForTests().find((row) => row.entityType === "public_news");
    assert.equal(news?.status, "pending");
    assert.equal(news?.attempts, 0);

    let providerCalls = 0;
    const processed = await processPlpBuildRequest(
      {
        workKey: "ignored",
        entityType: "public_news",
        entityId: "historical-news",
        locale: "uk",
        canonicalVersion: "v1",
        contentRevision: 1,
        trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        callProvider: async () => {
          providerCalls += 1;
          return { ok: true, values: { title: "x", summary: "y" } };
        },
      },
    );
    assert.equal(processed.status, "SKIPPED_USABLE");
    assert.equal(providerCalls, 0);
  });

  it("6–7 historical public_news does not block readiness or add denominator units", () => {
    assert.equal(isAuthoritativeMachineLocalizedPlpEntityType("public_news"), false);
    const state = readyInputs(emptyLanguageLocalizationCountBucket());
    assert.equal(state, "READY");
    for (const entityType of LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES) {
      assert.notEqual(entityType, "public_news");
    }
  });

  it("8–9 visible news stays source-original and chrome stays WEB_UI", () => {
    const hook = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/public-news/use-localized-public-news-card.ts",
      ),
      "utf8",
    );
    const card = readFileSync(
      path.resolve(here, "../../../../web/src/features/public-news/components/PublicNewsCard.tsx"),
      "utf8",
    );
    assert.match(hook, /plpPresentation: null/);
    assert.match(card, /useTranslations\("publicNews\.card"\)/);
    assert.match(card, /useTranslations\("publicNews\.categories"\)/);
    assert.match(card, /data-hu-reading-owner="browser-native"/);
  });

  it("11–17 authoritative PLP work blocks READY; source-original does not", () => {
    const work = {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 1,
      workItemsRequired: 1,
    };
    for (const entityType of [
      "civic_media_editorial",
      "civic_media_principle",
      "civic_media_trusted",
      "civic_media_fact_check",
      "civic_media_propaganda",
    ] as const) {
      assert.equal(isAuthoritativeMachineLocalizedPlpEntityType(entityType), true);
      assert.notEqual(readyInputs(work), "READY");
    }
    assert.equal(readyInputs(emptyLanguageLocalizationCountBucket()), "READY");
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    assert.equal(readyInputs(emptyLanguageLocalizationCountBucket()), "READY");
    const georgianTrusted = readyInputs({
      ...emptyLanguageLocalizationCountBucket(),
      missing: 9,
      workItemsRequired: 9,
    });
    assert.equal(georgianTrusted, "BACKFILL_REQUIRED");
  });

  it("21–24 structural WEB_UI invalidity blocks dataReady", () => {
    const english = loadBundledEnglishWebUiMessagePack();
    const valid = assessWebUiMessageTreeReadiness({
      messages: english,
      scope: "public",
    });
    assert.equal(valid.missingKeyCount, 0);
    assert.equal(valid.structuralInvalidCount, 0);
    assert.equal(valid.dataReady, true);

    const broken = structuredClone(english) as Record<string, unknown>;
    const blog = broken.blogPublic as Record<string, unknown>;
    const pagination = blog.pagination as Record<string, unknown>;
    pagination.showingCount = "count removed";
    const invalid = assessWebUiMessageTreeReadiness({
      messages: broken as never,
      scope: "public",
    });
    assert.equal(invalid.missingKeyCount, 0);
    assert.ok((invalid.structuralInvalidCount ?? 0) > 0);
    assert.equal(invalid.dataReady, false);

    const arabic = loadBundledWebUiMessagePackFromFs("ar");
    assert.ok(arabic);
    const arReady = assessWebUiMessageTreeReadiness({
      messages: arabic as never,
      scope: "public",
    });
    assert.equal(arReady.dataReady, false);
    assert.ok((arReady.structuralInvalidCount ?? 0) > 0);

    const traditional = loadBundledWebUiMessagePackFromFs("zh-Hant");
    assert.ok(traditional);
    const zhReady = assessWebUiMessageTreeReadiness({
      messages: traditional as never,
      scope: "public",
    });
    assert.equal(zhReady.dataReady, false);
    assert.ok((zhReady.structuralInvalidCount ?? 0) > 0);
  });

  it("25–27 CT invalid, stale, and missing prevent READY", () => {
    const invalid = readyInputs(emptyLanguageLocalizationCountBucket(), {
      ...emptyLanguageLocalizationCountBucket(),
      invalid: 1,
      workItemsRequired: 1,
    });
    const stale = readyInputs(emptyLanguageLocalizationCountBucket(), {
      ...emptyLanguageLocalizationCountBucket(),
      stale: 2,
      workItemsRequired: 2,
    });
    const missing = readyInputs(emptyLanguageLocalizationCountBucket(), {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 3,
      workItemsRequired: 3,
    });
    assert.equal(invalid, "BACKFILL_REQUIRED");
    assert.equal(stale, "BACKFILL_REQUIRED");
    assert.equal(missing, "BACKFILL_REQUIRED");
  });

  it("29–31 search, knowledge, and participant biography stay outside completion", () => {
    assert.equal(readyInputs(emptyLanguageLocalizationCountBucket()), "READY");
    assert.ok(LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS.includes("knowledge_article"));
    assert.equal(isLocalizationSourceOriginalEntityType("participant_public"), true);
    assert.equal(isAuthoritativeMachineLocalizedPlpEntityType("participant_public"), false);
  });
});
