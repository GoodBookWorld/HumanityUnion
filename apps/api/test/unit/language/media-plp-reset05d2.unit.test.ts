/**
 * RESET 05D.2 — editorial nested-path MACHINE eligibility + country affiliation.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  classifyFaqMachineProseLocalization,
} from "@hu/types";
import { selectCountryPublicNewsRail } from "@hu/media-registry";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-transport.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  bootstrapPlpAutoBuildRuntime,
  enqueueCivicMediaEditorialPlpBuilds,
  enqueuePlpBuildRequest,
  isCollectedPathMachineEligible,
  kickPlpAutoBuildDrain,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  processPlpBuildRequest,
  resetMediaLocalizationBuildHookStatusForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildRuntimeForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  resetPlpConsumptionCheckersForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPlpSearchSeoInvalidationForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPlpBuildRequestProcessor,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
  ensureMediaPlpAdapterRegistered,
  findCurrentPublishedPresentation,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { listCountryAffiliatedMediaSources } from "../../../src/modules/language/media-plp-carousel/country-affiliated-media-sources.js";
import { selectMediaPlpConsumerNewsArticles } from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
import { resetPublicNewsMemoryStoreForTests } from "../../../src/modules/public-news/public-news.repository.js";

async function waitIdle(): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const pending = listPlpAutoBuildWorkForTests().filter(
      (r) => r.status === "pending" || r.status === "running",
    );
    if (pending.length === 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetMediaPlpMaterializerCountersForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetPlpConsumptionCheckersForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  resetPublicNewsMemoryStoreForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  stopPlpAutoBuildRuntimeForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
  resetPublicNewsMemoryStoreForTests();
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
});

const editorialPolicy = {
  overviewTitle: "MACHINE_CONTENT" as const,
  overviewSummary: "MACHINE_CONTENT" as const,
  overviewPoints: "MACHINE_CONTENT" as const,
  faq: "MACHINE_CONTENT" as const,
};

describe("RESET 05D.2 — editorial + country affiliation", () => {
  it("1–2: nested editorial paths are machine-eligible; .id is not", () => {
    assert.equal(
      isCollectedPathMachineEligible("faq[0].question", editorialPolicy),
      true,
    );
    assert.equal(
      isCollectedPathMachineEligible("overviewPoints[1].body", editorialPolicy),
      true,
    );
    assert.equal(isCollectedPathMachineEligible("faq[0].id", editorialPolicy), false);
    assert.equal(isCollectedPathMachineEligible("title", editorialPolicy), false);
  });

  it("1/3: bootstrap creates durable editorial work; worker publishes current snapshot", async () => {
    setPlpBuildRequestProcessor((request) =>
      processPlpBuildRequest(request, {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      }),
    );
    await bootstrapPlpAutoBuildRuntime();
    await waitIdle();

    const work = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(work);
    assert.equal(work!.entityId, mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID));
    assert.ok(
      work!.status === "completed" || work!.status === "skipped_usable",
      `unexpected status ${work!.status} failure=${work!.failureCode}`,
    );

    const snapshot = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: mediaPlpEditorialEntityId(),
      locale: "uk",
    });
    assert.ok(snapshot);
    assert.equal(snapshot!.identity.canonicalVersion, work!.canonicalVersion);
  });

  it("4: Brand tokens survive machine hop; loss is BRAND_TOKEN_PRESERVATION_FAILED", async () => {
    const { validateMediaPlpProviderLocalizationValues } = await import(
      "../../../src/modules/language/media-plp-materializer/provider-boundary.js"
    );
    const { protectBrandTokensForMachineTranslation, restoreBrandTokensAfterMachineTranslation } =
      await import("@hu/types");
    const source = "{siteName} curates sources that meet published selection principles.";
    const protectedText = protectBrandTokensForMachineTranslation(source);
    assert.match(protectedText, /⟦HU_BRAND_SITE_NAME⟧/);
    const restored = restoreBrandTokensAfterMachineTranslation(
      protectedText.replace("curates", "відбирає"),
    );
    assert.match(restored, /\{siteName\}/);
    assert.match(restored, /відбирає/);

    const lost = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { "faq[0].answer": source },
      translated: { "faq[0].answer": "Союз Людяності відбирає джерела." },
    });
    assert.equal(lost.ok, false);
    if (!lost.ok) {
      assert.equal(lost.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
    }
  });

  it("5: Brand substitution alone cannot satisfy FAQ machine localization", () => {
    const result = classifyFaqMachineProseLocalization({
      template: "{siteName} curates sources that meet published selection principles.",
      canonicalTemplate:
        "{siteName} curates sources that meet published selection principles.",
      editorialMode: "CANONICAL_FALLBACK",
    });
    assert.equal(result.brandOnlyIllusion, true);
    assert.equal(result.machineLocalized, false);
  });

  it("6: targeted current-version editorial heal reopens terminal failed only with flag", async () => {
    const enqueued = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const work = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(work);
    await markPlpAutoBuildWorkFailed({
      workKey: work!.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: {
        failureCode: "REJECTED_PARTIAL",
        retryable: false,
        stage: "validate",
        safeReason: "REJECTED_PARTIAL:PARTIAL_AUTO_NODES",
      },
    });

    const blocked = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: work!.entityId,
      locale: "uk",
      canonicalVersion: enqueued.canonicalVersion,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      reopenFailedSameVersion: false,
    });
    assert.equal(blocked.deduped, true);

    const healed = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    assert.ok(healed.enqueued + healed.skippedUsable + healed.deduped >= 1);
    const after = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(after);
    assert.ok(after!.status === "pending" || after!.status === "skipped_usable" || after!.status === "completed");
  });

  it("7–9: UA affiliated sources exist; identity match is case-insensitive; zero news is coverage gap", () => {
    const sources = listCountryAffiliatedMediaSources("UA");
    assert.ok(sources.length >= 4);
    assert.ok(sources.some((s) => s.name === "Kyiv Independent"));

    const selectedCase = selectCountryPublicNewsRail(
      [
        {
          id: "ua1",
          sourceName: "kyiv independent",
          publishedAt: "2030-01-10T00:00:00.000Z",
        },
      ],
      {
        countryCode: "UA",
        countryName: "Ukraine",
        recommendedMedia: sources.map((s) => ({ id: s.id, name: s.name })),
        language: "en",
      },
      24,
    );
    assert.equal(selectedCase.countryRelevant.length, 1);

    const selected = selectCountryPublicNewsRail(
      [
        {
          id: "g1",
          sourceName: "BBC World",
          publishedAt: "2030-01-10T00:00:00.000Z",
          geographicScope: "global",
        },
      ],
      {
        countryCode: "UA",
        countryName: "Ukraine",
        recommendedMedia: sources.map((s) => ({ id: s.id, name: s.name })),
        language: "en",
      },
      24,
    );
    assert.equal(selected.countryRelevant.length, 0);
    assert.equal(selected.usedFallback, true);
    assert.ok(sources.length > 0);
  });

  it("8: country-affiliated News cannot be displaced by global cap", () => {
    const selected = selectCountryPublicNewsRail(
      [
        {
          id: "ua1",
          sourceName: "Kyiv Independent",
          publishedAt: "2030-01-01T00:00:00.000Z",
        },
        ...Array.from({ length: 40 }, (_, i) => ({
          id: `g-${i}`,
          sourceName: "BBC World",
          publishedAt: `2030-02-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        })),
      ],
      {
        countryCode: "UA",
        countryName: "Ukraine",
        recommendedMedia: [{ id: "kyiv-independent", name: "Kyiv Independent" }],
        language: "en",
      },
      24,
    );
    assert.equal(selected.articles[0]?.id, "ua1");
    assert.equal(selected.countryRelevant.length, 1);
    assert.equal(selected.countryRelevantExcludedByCap, 0);
  });

  it("10–12: /media selector unchanged at 12; shared selector import; no provider in diagnostic module", async () => {
    const media = await selectMediaPlpConsumerNewsArticles({ limit: 12 });
    assert.ok(media.length <= 12);
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(diag, /listCountryAffiliatedMediaSources/);
    assert.match(diag, /findPlpAutoBuildWorkByKey/);
    assert.doesNotMatch(diag, /gemini|enqueuePlpBuildRequest|markPlpAutoBuildWorkFailed/);
    const selection = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-plp-news-selection.ts",
      ),
      "utf8",
    );
    assert.match(selection, /countryAffiliatedMediaRefs/);
    const field = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/field-authority.ts",
      ),
      "utf8",
    );
    assert.match(field, /isCollectedPathMachineEligible/);
  });
});
