/**
 * Reset 03D — PLP resolve cache behavior (API, no live ops).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import {
  buildMediaPlpResolveCacheKey,
  getCachedMediaPlpResolve,
  getMediaPlpResolveCacheStats,
  invalidateMediaPlpResolveCacheForEntity,
  resetMediaPlpResolveCacheForTests,
  resolvePublishedPresentation,
  resetPublishedLocalizationPersistenceForTests,
  setCachedMediaPlpResolve,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";

afterEach(() => {
  resetMediaPlpResolveCacheForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
});

describe("Reset 03D — PLP resolve cache", () => {
  it("cache hit serves second resolve for same versioned key", async () => {
    const canonical = { explanation: "en explanation" };
    const first = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "canon-v1",
      canonicalPresentation: canonical,
    });
    assert.equal(first.mode, "CANONICAL_FALLBACK");

    const statsAfterMiss = getMediaPlpResolveCacheStats();
    assert.ok(statsAfterMiss.misses >= 1);

    const second = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "canon-v1",
      canonicalPresentation: canonical,
    });
    assert.equal(second.mode, "CANONICAL_FALLBACK");
    const statsAfterHit = getMediaPlpResolveCacheStats();
    assert.ok(statsAfterHit.hits >= 1);
  });

  it("canonicalVersion change uses distinct cache key (stale miss)", async () => {
    const keyV1 = buildMediaPlpResolveCacheKey({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    });
    setCachedMediaPlpResolve(keyV1, {
      mode: "PUBLISHED_LOCALIZED",
      presentation: { explanation: "old" },
    });
    assert.equal(getCachedMediaPlpResolve(keyV1)?.mode, "PUBLISHED_LOCALIZED");

    const keyV2 = buildMediaPlpResolveCacheKey({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "v2",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    });
    assert.notEqual(keyV1, keyV2);
    assert.equal(getCachedMediaPlpResolve(keyV2), null);

    const resolved = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "v2",
      canonicalPresentation: { explanation: "en" },
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("entity invalidation drops cached entries", () => {
    const key = buildMediaPlpResolveCacheKey({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: "v1",
    });
    setCachedMediaPlpResolve(key, {
      mode: "PUBLISHED_LOCALIZED",
      presentation: { explanation: "cached" },
    });
    invalidateMediaPlpResolveCacheForEntity({
      entityType: "civic_media_trusted",
      entityId: "reuters",
    });
    assert.equal(getCachedMediaPlpResolve(key), null);
  });
});
