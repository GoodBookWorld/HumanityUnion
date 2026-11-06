/**
 * COUNTRY-MEDIA-NEWS-01 — Country News providers from configured NEWS_SOURCE
 * resources, six-card rails by exact source, labelled global fallback, and
 * Recommended Media logos that keep their proportions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PublicCountryNewsSource, PublicNewsArticleItem } from "@hu/types";
import { COUNTRY_NEWS_RAIL_LIMIT, listCountryNewsFallbackSourceNames } from "@hu/media-registry";

import { fetchCountryNewsSources } from "../country-experience/country-experience-api.js";
import { fetchPublicNewsArticles } from "../public-news/api.js";
import {
  COUNTRY_NEWS_ALL_PROVIDERS,
  loadCountryNewsRail,
  resolveCountryNewsProviderOptions,
  type FetchCountryNewsArticles,
} from "../public-news/country-news-rail.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const read = (relative: string) => readFileSync(path.join(webSrc, relative), "utf8");
const originalFetch = globalThis.fetch;

const FALLBACK = ["BBC World", "DW", "France24", "Euronews", "The Guardian", "The New York Times"];

function source(name: string): PublicCountryNewsSource {
  return { id: name.toLowerCase().replace(/\s+/g, "-"), name, providerId: null, language: "en" };
}

function item(id: string, sourceName: string): PublicNewsArticleItem {
  return {
    id,
    sourceName,
    title: `Title ${id}`,
    articleUrl: `https://example.com/${id}`,
    publishedAt: "2030-01-01T00:00:00.000Z",
    language: "en",
  } as PublicNewsArticleItem;
}

/** Fake exact-source API: returns stored articles for the requested names, records calls. */
function fakeFetch(bySource: Record<string, number>) {
  const calls: string[][] = [];
  const fetchArticles: FetchCountryNewsArticles = async (sources) => {
    calls.push([...sources]);
    return sources.flatMap((name) =>
      Array.from({ length: bySource[name] ?? 0 }, (_, i) => item(`${name}-${i}`, name)),
    );
  };
  return { calls, fetchArticles };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("COUNTRY-MEDIA-NEWS-01 — provider options", () => {
  it("1. providers are the configured country sources, independent of articles", () => {
    const options = resolveCountryNewsProviderOptions([
      source("Ukrinform"),
      source("Kyiv Independent"),
    ]);
    assert.deepEqual(options, { group: "country", names: ["Ukrinform", "Kyiv Independent"] });
  });

  it("2. without country sources the providers are the six global fallback outlets", () => {
    assert.deepEqual(resolveCountryNewsProviderOptions([]), { group: "global", names: FALLBACK });
    assert.deepEqual(listCountryNewsFallbackSourceNames(), FALLBACK);
  });
});

describe("COUNTRY-MEDIA-NEWS-01 — rail loading", () => {
  const countryOptions = resolveCountryNewsProviderOptions([
    source("Ukrinform"),
    source("Suspilne"),
  ]);
  const globalOptions = resolveCountryNewsProviderOptions([]);

  it("3. default view: up to six newest from all country sources, no global padding", async () => {
    const { calls, fetchArticles } = fakeFetch({ Ukrinform: 5, Suspilne: 4, "BBC World": 9 });
    const result = await loadCountryNewsRail({
      options: countryOptions,
      provider: COUNTRY_NEWS_ALL_PROVIDERS,
      fetchArticles,
    });
    assert.equal(result.articles.length, COUNTRY_NEWS_RAIL_LIMIT);
    assert.equal(result.usedGlobalFallback, false);
    assert.deepEqual(calls, [["Ukrinform", "Suspilne"]]);
    assert.ok(
      result.articles.every((article) => ["Ukrinform", "Suspilne"].includes(article.sourceName)),
    );
  });

  it("4. selected provider shows only that exact source", async () => {
    const { calls, fetchArticles } = fakeFetch({ Ukrinform: 2, Suspilne: 4 });
    const result = await loadCountryNewsRail({
      options: countryOptions,
      provider: "Suspilne",
      fetchArticles,
    });
    assert.deepEqual(calls, [["Suspilne"]]);
    assert.equal(result.articles.length, 4);
    assert.ok(result.articles.every((article) => article.sourceName === "Suspilne"));
    assert.equal(result.usedGlobalFallback, false);
  });

  it("5. an empty selected source stays empty (no fallback)", async () => {
    const { calls, fetchArticles } = fakeFetch({ Ukrinform: 3, "BBC World": 6 });
    const result = await loadCountryNewsRail({
      options: countryOptions,
      provider: "Suspilne",
      fetchArticles,
    });
    assert.deepEqual(result.articles, []);
    assert.deepEqual(calls, [["Suspilne"]]);
  });

  it("6. fallback A: country sources exist but have no articles", async () => {
    const { calls, fetchArticles } = fakeFetch({ "BBC World": 4, DW: 4 });
    const result = await loadCountryNewsRail({
      options: countryOptions,
      provider: COUNTRY_NEWS_ALL_PROVIDERS,
      fetchArticles,
    });
    assert.deepEqual(calls, [["Ukrinform", "Suspilne"], FALLBACK]);
    assert.equal(result.usedGlobalFallback, true);
    assert.equal(result.articles.length, 6);
  });

  it("7. fallback A: no country sources; a selected fallback outlet shows only itself", async () => {
    const all = fakeFetch({ Euronews: 3, "The Guardian": 9 });
    const defaultView = await loadCountryNewsRail({
      options: globalOptions,
      provider: COUNTRY_NEWS_ALL_PROVIDERS,
      fetchArticles: all.fetchArticles,
    });
    assert.deepEqual(all.calls, [FALLBACK]);
    assert.equal(defaultView.usedGlobalFallback, true);
    assert.equal(defaultView.articles.length, 6);

    const one = fakeFetch({ Euronews: 3 });
    const selected = await loadCountryNewsRail({
      options: globalOptions,
      provider: "Euronews",
      fetchArticles: one.fetchArticles,
    });
    assert.deepEqual(one.calls, [["Euronews"]]);
    assert.equal(selected.usedGlobalFallback, true);
    assert.ok(selected.articles.every((article) => article.sourceName === "Euronews"));
  });

  it("8. all fallback feeds empty: empty rail, nothing invented", async () => {
    const { fetchArticles } = fakeFetch({});
    const result = await loadCountryNewsRail({
      options: globalOptions,
      provider: COUNTRY_NEWS_ALL_PROVIDERS,
      fetchArticles,
    });
    assert.deepEqual(result.articles, []);
  });

  it("9. API errors propagate and never trigger the fallback", async () => {
    const calls: string[][] = [];
    const failing: FetchCountryNewsArticles = async (sources) => {
      calls.push([...sources]);
      throw new Error("API unavailable");
    };
    await assert.rejects(
      loadCountryNewsRail({
        options: countryOptions,
        provider: COUNTRY_NEWS_ALL_PROVIDERS,
        fetchArticles: failing,
      }),
    );
    assert.deepEqual(calls, [["Ukrinform", "Suspilne"]]);
  });

  it("10. a stale provider from another country falls back to the All view", async () => {
    const { calls, fetchArticles } = fakeFetch({ Ukrinform: 1 });
    await loadCountryNewsRail({ options: countryOptions, provider: "CBC", fetchArticles });
    assert.deepEqual(calls, [["Ukrinform", "Suspilne"]]);
  });
});

describe("COUNTRY-MEDIA-NEWS-01 — API clients", () => {
  it("11. news requests send exact sources as repeated parameters", async () => {
    let requested = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          data: { items: [], generatedAt: "", retentionDays: 7, activeProviders: [] },
          meta: {},
          links: {},
          message: "",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    await fetchPublicNewsArticles({
      sources: ["Kyiv Independent", "Ukrinform"],
      limit: 6,
      language: "en",
    });
    const url = new URL(requested);
    assert.equal(url.pathname, "/api/v1/public/news");
    assert.deepEqual(url.searchParams.getAll("sources"), ["Kyiv Independent", "Ukrinform"]);
    assert.equal(url.searchParams.get("limit"), "6");
    assert.equal(url.searchParams.get("source"), null);
  });

  it("12. country sources come from the public news-sources endpoint; failures throw", async () => {
    let requested = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return new Response(
        JSON.stringify({ success: true, data: [source("Ukrinform")], meta: {} }),
        { status: 200 },
      );
    }) as typeof fetch;
    assert.deepEqual(await fetchCountryNewsSources("UA"), [source("Ukrinform")]);
    assert.match(requested, /\/api\/v1\/public\/countries\/UA\/news-sources$/);

    globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch;
    await assert.rejects(fetchCountryNewsSources("UA"));
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false, data: null }), {
        status: 200,
      })) as typeof fetch;
    await assert.rejects(fetchCountryNewsSources("UA"));
  });
});

describe("COUNTRY-MEDIA-NEWS-01 — component wiring", () => {
  const section = read("features/public-news/components/PublicNewsSection.tsx");

  it("13. country provider list comes from configured sources, not displayed articles", () => {
    assert.match(section, /useCountryNewsRail\(\{/);
    assert.match(section, /const countryProviders = countryRail\.options\?\.names \?\? \[\];/);
    assert.doesNotMatch(
      section,
      /selectCountryPublicNewsRail|countryScopedArticles|recommendedMedia/,
    );
    assert.doesNotMatch(
      read("features/public-news/components/CountryPublicNewsWidget.tsx"),
      /recommendedMedia/,
    );
  });

  it("14. global outlets are labelled as global and never as country media", () => {
    assert.match(section, /<optgroup label=\{tCountry\("globalSources", \{ countryName \}\)\}>/);
    assert.match(
      section,
      /countryProvidersAreGlobal\s*\?\s*tCountry\("globalSources", \{ countryName \}\)\s*:\s*tCountry\("allTrustedMedia", \{ countryName \}\)/,
    );
    assert.match(section, /usedGlobalFallback\s*\?\s*tDiscovery\(/);
  });

  it("15. empty and error states: noResults for the country rail, error never falls back", () => {
    assert.match(section, /isCountryRail\s*\?\s*processedArticles\.length === 0/);
    assert.match(section, /tCountry\("noResults", \{ countryName \}\)/);
    assert.match(section, /countryRail\.failed\s*\?\s*tErrors\("temporarilyUnavailable"\)/);
    assert.match(section, /isCountryRail \? countryRail\.retry\(\) : void loadArticles\(\)/);
    const hook = read("features/public-news/use-country-news-rail.ts");
    assert.match(hook, /limit: COUNTRY_NEWS_RAIL_LIMIT/);
    assert.match(hook, /language: "en"/);
  });

  it("16. discovery (global News) path is unchanged", () => {
    assert.match(section, /limit: PUBLIC_NEWS_RAIL_LIMIT,\s*language: "en"/);
    assert.match(section, /if \(hasInitialArticles \|\| isCountryRail\) \{/);
    assert.match(section, /filterPublicNewsArticles\(articles, filters\)/);
  });

  it("17. translation alignment: API pre-build covers the same exact-source rails", () => {
    const selection = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/media-plp-carousel/media-plp-news-selection.ts",
      ),
      "utf8",
    );
    assert.match(selection, /export async function selectCountrySourceNewsArticles/);
    assert.match(selection, /limit: COUNTRY_NEWS_RAIL_LIMIT/);
    assert.match(selection, /sources: \[name\]/);
    assert.match(selection, /listCountryNewsFallbackSourceNames\(\)/);
    assert.match(selection, /await selectCountrySourceNewsArticles\(\{ now: input\?\.now \}\)/);
  });
});

describe("COUNTRY-MEDIA-NEWS-01 — Recommended Media logos", () => {
  it("18. country-only rule keeps proportions within 90x48", () => {
    const css = read("features/country-experience/country-experience-dynamic.css");
    const rule = css.match(
      /\[data-hu-surface="country-recommended-media"\] \.civic-media-center__logo-image \{([^}]*)\}/,
    );
    assert.ok(rule);
    for (const declaration of [
      /width:\s*auto/,
      /height:\s*auto/,
      /max-width:\s*90px/,
      /max-height:\s*48px/,
      /object-fit:\s*contain/,
    ]) {
      assert.match(rule[1]!, declaration);
    }
    const mediaCss = read("features/civic-media-center/civic-media-center.css");
    assert.match(mediaCss, /\.civic-media-center__logo-image \{[^}]*max-width: 6\.75rem/);
    assert.doesNotMatch(mediaCss, /country-recommended-media/);
  });
});
