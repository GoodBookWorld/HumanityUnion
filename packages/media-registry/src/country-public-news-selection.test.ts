/**
 * RESET 05D — country-first selection + shared selector contract.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
  selectCountryPublicNewsRail,
} from "@hu/media-registry";

function article(
  id: string,
  sourceName: string,
  publishedAt: string,
  geographicScope = "global",
) {
  return { id, sourceName, publishedAt, geographicScope, category: "peace and security" };
}

describe("RESET 05D — country-first public news selection", () => {
  it("selects country-relevant before global supplementation", () => {
    const candidates = [
      article("g1", "BBC World", "2030-01-10T00:00:00.000Z"),
      article("g2", "Reuters", "2030-01-09T00:00:00.000Z"),
      article("ca1", "CBC News", "2030-01-01T00:00:00.000Z"),
      article("ca2", "CBC News", "2029-12-01T00:00:00.000Z"),
      ...Array.from({ length: 30 }, (_, i) =>
        article(`gx-${i}`, "BBC World", `2030-02-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`),
      ),
    ];

    const selected = selectCountryPublicNewsRail(
      candidates,
      {
        countryCode: "CA",
        countryName: "Canada",
        regionName: "Americas",
        recommendedMedia: [{ id: "cbc", name: "CBC News" }],
        language: "en",
      },
      COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
    );

    assert.equal(selected.countryRelevant.length, 2);
    assert.ok(selected.articles.some((a) => a.id === "ca1"));
    assert.ok(selected.articles.some((a) => a.id === "ca2"));
    assert.equal(selected.articles[0]?.id, "ca1");
    assert.equal(selected.articles[1]?.id, "ca2");
    assert.equal(selected.usedFallback, false);
    assert.equal(selected.countryRelevantExcludedByCap, 0);
    assert.equal(selected.articles.length, COUNTRY_PUBLIC_NEWS_RAIL_LIMIT);
  });

  it("does not let upstream global-only truncation replace country set", () => {
    // Simulate old bug: only global top-N present → country excluded.
    const truncatedGlobalOnly = [
      article("g1", "BBC World", "2030-01-10T00:00:00.000Z"),
      article("g2", "Reuters", "2030-01-09T00:00:00.000Z"),
    ];
    const withCountry = [
      ...truncatedGlobalOnly,
      article("ua1", "Kyiv Independent", "2030-01-08T00:00:00.000Z"),
    ];

    const bad = selectCountryPublicNewsRail(
      truncatedGlobalOnly,
      {
        countryCode: "UA",
        countryName: "Ukraine",
        recommendedMedia: [{ id: "ki", name: "Kyiv Independent" }],
        language: "en",
      },
      24,
    );
    assert.equal(bad.countryRelevant.length, 0);
    assert.equal(bad.usedFallback, true);

    const good = selectCountryPublicNewsRail(
      withCountry,
      {
        countryCode: "UA",
        countryName: "Ukraine",
        recommendedMedia: [{ id: "ki", name: "Kyiv Independent" }],
        language: "en",
      },
      24,
    );
    assert.equal(good.countryRelevant.length, 1);
    assert.equal(good.articles[0]?.id, "ua1");
    assert.equal(good.usedFallback, false);
  });

  it("matches geographicScope as country-relevant", () => {
    const selected = selectCountryPublicNewsRail(
      [
        article("about-ca", "BBC World", "2030-01-10T00:00:00.000Z", "Canada"),
        article("global", "BBC World", "2030-01-11T00:00:00.000Z", "global"),
      ],
      {
        countryCode: "CA",
        countryName: "Canada",
        language: "en",
      },
      24,
    );
    assert.ok(selected.countryRelevant.some((a) => a.id === "about-ca"));
    assert.equal(selected.articles[0]?.id, "about-ca");
  });
});
