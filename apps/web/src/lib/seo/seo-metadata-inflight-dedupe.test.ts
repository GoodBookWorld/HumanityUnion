/**
 * HU-MEM-14B.2 — in-flight SEO metadata dedupe.
 * Counts are synthetic bookkeeping. They are not Render memory measurements.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolvePublicSiteOrigin } from "./public-site-url";
import {
  SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT,
  acquireSeoMetadataEligibilityPermit,
  readWaitingSeoMetadataEligibilityOperations,
  releaseSeoMetadataEligibilityPermit,
  resetSeoMetadataEligibilityGateForTests,
} from "./seo-metadata-eligibility-gate";
import { SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT } from "./seo-evidence-fetch-gate";
import { resolvePublicSeoMetadataDocumentPaths } from "./build-public-page-metadata-for-request";
import {
  SEO_METADATA_DEDUPE_MAX_FOLLOWERS_PER_KEY,
  SEO_METADATA_DEDUPE_MAX_KEYS,
  SEO_METADATA_DEDUPE_MAX_TOTAL_FOLLOWERS,
  readSeoMetadataDedupeSnapshot,
  resetSeoMetadataInflightDedupeForTests,
  seoMetadataEquivalenceKey,
  shareInFlightSeoMetadataResolution,
} from "./seo-metadata-inflight-dedupe";

function signals(overrides?: {
  pathname?: string | null;
  urlLocaleSegment?: string | null;
  huLangCookie?: string | null;
  acceptLanguage?: string | null;
}) {
  return {
    pathname: overrides?.pathname ?? "/",
    urlLocaleSegment: overrides?.urlLocaleSegment ?? null,
    huLangCookie: overrides?.huLangCookie ?? null,
    acceptLanguage: overrides?.acceptLanguage ?? null,
  };
}

function seoCatalog(
  rows: Array<{ locale: string; seoIndexingEnabled: boolean }>,
) {
  return rows.map((row, index) => ({
    languageId: `lang-${row.locale}-${index}`,
    locale: row.locale,
    textDirection: "ltr" as const,
    aliases: [] as string[],
    enabled: true,
    seoIndexingEnabled: row.seoIndexingEnabled,
  }));
}

async function burst(count: number, keyFor: (index: number) => string) {
  resetSeoMetadataInflightDedupeForTests();
  let resolutions = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending: Array<Promise<number>> = [];
  for (let index = 0; index < count; index += 1) {
    pending.push(
      shareInFlightSeoMetadataResolution(keyFor(index), async () => {
        resolutions += 1;
        await gate;
        return index;
      }),
    );
  }
  const during = readSeoMetadataDedupeSnapshot();
  release();
  await Promise.all(pending);
  const after = readSeoMetadataDedupeSnapshot();
  return { resolutions, during, after };
}

describe("HU-MEM-14B.2 in-flight SEO metadata dedupe", { concurrency: 1 }, () => {
  afterEach(() => {
    resetSeoMetadataInflightDedupeForTests();
    resetSeoMetadataEligibilityGateForTests();
  });

  it("keeps the existing eligibility and evidence caps", () => {
    assert.equal(SEO_METADATA_ELIGIBILITY_CONCURRENCY_LIMIT, 4);
    assert.equal(SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT, 8);
    assert.equal(SEO_METADATA_DEDUPE_MAX_KEYS, 8);
    assert.equal(SEO_METADATA_DEDUPE_MAX_FOLLOWERS_PER_KEY, 32);
    assert.equal(SEO_METADATA_DEDUPE_MAX_TOTAL_FOLLOWERS, 32);
  });

  it("hashes equivalence inputs and does not keep the raw cookie in the key", () => {
    const cookie = "hu-lang-secret-value";
    const same = seoMetadataEquivalenceKey("/blog/post", signals({ huLangCookie: cookie }));
    assert.equal(same, seoMetadataEquivalenceKey("/blog/post", signals({ huLangCookie: cookie })));
    assert.notEqual(same, seoMetadataEquivalenceKey("/blog/other", signals({ huLangCookie: cookie })));
    assert.notEqual(same, seoMetadataEquivalenceKey("/blog/post", signals({ urlLocaleSegment: "uk" })));
    assert.notEqual(same, seoMetadataEquivalenceKey("/blog/post", signals({ huLangCookie: "de" })));
    assert.notEqual(
      same,
      seoMetadataEquivalenceKey("/blog/post", signals({ acceptLanguage: "de-DE,de;q=0.9" })),
    );
    assert.equal(same.includes(cookie), false);
    assert.equal(same.includes("/blog/post"), false);
    assert.equal(resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://huws.org" }), "https://huws.org");
  });

  it("shares equivalent work, isolates distinct keys, and drops the entry after settle", async () => {
    resetSeoMetadataInflightDedupeForTests();
    let calls = 0;
    let release!: (value: string) => void;
    const gate = new Promise<string>((resolve) => {
      release = resolve;
    });
    const leader = shareInFlightSeoMetadataResolution("same", async () => {
      calls += 1;
      return gate;
    });
    const follower = shareInFlightSeoMetadataResolution("same", async () => {
      calls += 1;
      return "follower-should-not-run";
    });
    const other = shareInFlightSeoMetadataResolution("other", async () => {
      calls += 1;
      return "other";
    });
    assert.equal(readSeoMetadataDedupeSnapshot().activeKeys, 2);
    assert.equal(readSeoMetadataDedupeSnapshot().activeFollowers, 1);
    assert.equal(readSeoMetadataDedupeSnapshot().hits, 1);
    release("leader");
    assert.equal(await leader, "leader");
    assert.equal(await follower, "leader");
    assert.equal(await other, "other");
    assert.equal(calls, 2);
    assert.equal(readSeoMetadataDedupeSnapshot().activeKeys, 0);
    assert.equal(readSeoMetadataDedupeSnapshot().activeFollowers, 0);

    const again = await shareInFlightSeoMetadataResolution("same", async () => {
      calls += 1;
      return "fresh";
    });
    assert.equal(again, "fresh");
    assert.equal(calls, 3);
    resetSeoMetadataInflightDedupeForTests();
  });

  it("propagates leader rejection and runs a new resolution afterward", async () => {
    resetSeoMetadataInflightDedupeForTests();
    const leader = shareInFlightSeoMetadataResolution("fail", async () => {
      throw new Error("leader-failed");
    });
    const follower = shareInFlightSeoMetadataResolution("fail", async () => "unused");
    await assert.rejects(leader, /leader-failed/);
    await assert.rejects(follower, /leader-failed/);
    assert.equal(readSeoMetadataDedupeSnapshot().activeKeys, 0);
    let calls = 0;
    const fresh = await shareInFlightSeoMetadataResolution("fail", async () => {
      calls += 1;
      return "recovered";
    });
    assert.equal(fresh, "recovered");
    assert.equal(calls, 1);
    resetSeoMetadataInflightDedupeForTests();
  });

  it("bypasses per-key and global follower limits onto the normal path", async () => {
    resetSeoMetadataInflightDedupeForTests();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const run = (key: string) =>
      shareInFlightSeoMetadataResolution(key, async () => {
        calls += 1;
        await gate;
        return key;
      });

    const firstKey = Array.from({ length: 40 }, () => run("hot"));
    assert.equal(readSeoMetadataDedupeSnapshot().hits, 32);
    assert.equal(readSeoMetadataDedupeSnapshot().bypasses, 7);
    assert.equal(readSeoMetadataDedupeSnapshot().activeFollowers, 32);
    const secondLeader = run("cold");
    const secondFollower = run("cold");
    assert.equal(readSeoMetadataDedupeSnapshot().bypasses, 8);
    assert.equal(readSeoMetadataDedupeSnapshot().activeKeys, 2);
    release();
    await Promise.all([...firstKey, secondLeader, secondFollower]);
    assert.equal(calls, 1 + 7 + 1 + 1);
    assert.equal(readSeoMetadataDedupeSnapshot().activeKeys, 0);
    assert.equal(readSeoMetadataDedupeSnapshot().activeFollowers, 0);
    resetSeoMetadataInflightDedupeForTests();
  });

  it("bypasses when the tracked key limit is full", async () => {
    const result = await burst(20, (index) => `route-${index}`);
    assert.equal(result.resolutions, 20);
    assert.equal(result.during.activeKeys, 8);
    assert.equal(result.during.hits, 0);
    assert.equal(result.during.bypasses, 12);
    assert.equal(result.during.peakKeys, 8);
    assert.equal(result.after.activeKeys, 0);
    assert.equal(result.after.activeFollowers, 0);
  });

  it("collapses equivalent bursts and leaves distinct bursts on the normal path", async () => {
    const equivalent24 = await burst(24, () => "home");
    assert.deepEqual(
      {
        resolutions: equivalent24.resolutions,
        hits: equivalent24.during.hits,
        bypasses: equivalent24.during.bypasses,
        peakKeys: equivalent24.during.peakKeys,
        peakFollowers: equivalent24.during.peakFollowers,
      },
      { resolutions: 1, hits: 23, bypasses: 0, peakKeys: 1, peakFollowers: 23 },
    );
    assert.equal(equivalent24.after.activeKeys, 0);

    const equivalent75 = await burst(75, () => "home");
    assert.deepEqual(
      {
        resolutions: equivalent75.resolutions,
        hits: equivalent75.during.hits,
        bypasses: equivalent75.during.bypasses,
        peakKeys: equivalent75.during.peakKeys,
        peakFollowers: equivalent75.during.peakFollowers,
      },
      { resolutions: 43, hits: 32, bypasses: 42, peakKeys: 1, peakFollowers: 32 },
    );

    const equivalent100 = await burst(100, () => "home");
    assert.deepEqual(
      {
        resolutions: equivalent100.resolutions,
        hits: equivalent100.during.hits,
        bypasses: equivalent100.during.bypasses,
      },
      { resolutions: 68, hits: 32, bypasses: 67 },
    );

    const distinct24 = await burst(24, (index) => `path-${index}`);
    assert.equal(distinct24.resolutions, 24);
    assert.equal(distinct24.during.hits, 0);
    assert.equal(distinct24.during.bypasses, 16);
    assert.equal(distinct24.during.peakKeys, 8);

    const distinct75 = await burst(75, (index) => `path-${index}`);
    assert.equal(distinct75.resolutions, 75);
    assert.equal(distinct75.during.hits, 0);
    assert.equal(distinct75.during.bypasses, 67);
    assert.equal(distinct75.during.peakKeys, 8);

    const distinct100 = await burst(100, (index) => `path-${index}`);
    assert.equal(distinct100.resolutions, 100);
    assert.equal(distinct100.during.hits, 0);
    assert.equal(distinct100.during.bypasses, 92);

    const mixed = await burst(75, (index) => `family-${index % 5}`);
    assert.equal(mixed.resolutions, 43);
    assert.equal(mixed.during.hits, 32);
    assert.equal(mixed.during.bypasses, 38);
    assert.equal(mixed.during.peakKeys, 5);
    assert.equal(mixed.during.peakFollowers, 32);
    assert.equal(mixed.after.activeKeys, 0);
    assert.equal(mixed.after.activeFollowers, 0);
    assert.equal(readWaitingSeoMetadataEligibilityOperations(), 0);
  });

  it("does not share explicit catalog or eligibility overrides", async () => {
    const english = seoCatalog([{ locale: "en", seoIndexingEnabled: true }]);
    const withUkrainian = seoCatalog([
      { locale: "en", seoIndexingEnabled: true },
      { locale: "uk", seoIndexingEnabled: true },
    ]);
    const [onlyEnglish, withUk] = await Promise.all([
      resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: "/",
        catalog: english,
        pathname: "/",
        urlLocaleSegment: null,
      }),
      resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: "/",
        catalog: withUkrainian,
        pathname: "/",
        urlLocaleSegment: null,
      }),
    ]);
    assert.equal(onlyEnglish.languageAlternates?.uk, undefined);
    assert.equal(withUk.languageAlternates?.uk?.endsWith("/uk"), true);

    const [indexed, suppressed] = await Promise.all([
      resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: "/blog",
        catalog: withUkrainian,
        pathname: "/uk/blog",
        urlLocaleSegment: "uk",
        isLocalizedVariantEligible: () => true,
      }),
      resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: "/blog",
        catalog: withUkrainian,
        pathname: "/uk/blog",
        urlLocaleSegment: "uk",
        isLocalizedVariantEligible: () => false,
      }),
    ]);
    assert.equal(indexed.selfCanonicalPath, "/uk/blog");
    assert.equal(indexed.suppressLocalizedIndexing, false);
    assert.equal(suppressed.selfCanonicalPath, "/blog");
    assert.equal(suppressed.suppressLocalizedIndexing, true);
  });

  it("keeps the eligibility queue at four permits", async () => {
    resetSeoMetadataEligibilityGateForTests();
    const finish: Array<() => void> = [];
    const operations = Array.from({ length: 6 }, async () => {
      await acquireSeoMetadataEligibilityPermit();
      try {
        await new Promise<void>((resolve) => {
          finish.push(resolve);
        });
      } finally {
        releaseSeoMetadataEligibilityPermit();
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readWaitingSeoMetadataEligibilityOperations(), 2);
    while (finish.length > 0) {
      finish.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all(operations);
    assert.equal(readWaitingSeoMetadataEligibilityOperations(), 0);
    resetSeoMetadataEligibilityGateForTests();
  });
});
