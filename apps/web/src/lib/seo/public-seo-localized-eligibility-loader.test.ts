/**
 * HU-MEM-09B — bounded SEO evidence loading.
 * Isolated loader tests. No live Registry and no network.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { CANONICAL_LEGAL_SOURCE_VERSIONS } from "@hu/types";

import { resetLocalizedBrandCacheForTests } from "../../features/brand-localization/resolve-localized-brand";
import { API_BASE_URL } from "../api-base-url";
import { readWebWorkloadGauges } from "../system-health/web-memory-gauges";
import { resetWebMemorySamplerForTests } from "../system-health/web-memory-sampler";
import {
  buildPublicPageMetadataForRequest,
  resolvePublicSeoMetadataDocumentPaths,
} from "./build-public-page-metadata-for-request";
import {
  isPublicSeoLocalizedVariantEligible,
  type PublicSeoLocalizedPageEvidence,
} from "./public-seo-localized-eligibility";
import { buildPublicSeoLocalizedVariantPredicate } from "./public-seo-localized-eligibility-loader";
import { buildPublicSitemap, collectPublicSitemapPathEntries } from "./sitemap/build-public-sitemap";
import { expandPublicSitemapEntriesForSeoLocales } from "./sitemap/expand-public-sitemap-for-seo-locales";
import {
  readActiveSeoEvidenceFetchesForTests,
  readInFlightSeoEvidenceKeysForTests,
  readQueuedSeoEvidenceFetchesForTests,
  resetSeoEvidenceFetchGateForTests,
  runSeoEvidenceFetch,
  SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT,
} from "./seo-evidence-fetch-gate";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_PLATFORM_MODE = process.env.NEXT_PUBLIC_PLATFORM_MODE;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

const SEO_LOCALES = ["uk", "zh-Hant", "zz-Future"] as const;

type EvidenceCall = {
  readonly kind: string;
  readonly locale: string;
  readonly url: string;
  readonly signal: AbortSignal | null | undefined;
};

class FetchControl {
  mode: "ready" | "hold" = "ready";
  fail = false;
  positiveLocales = new Set<string>(["uk"]);
  calls: EvidenceCall[] = [];
  inFlight = 0;
  maxInFlight = 0;
  maxActive = 0;
  private hold: Promise<void> = Promise.resolve();
  releaseHold: () => void = () => undefined;

  reset(): void {
    this.releaseHold();
    this.mode = "ready";
    this.fail = false;
    this.positiveLocales = new Set(["uk"]);
    this.calls = [];
    this.inFlight = 0;
    this.maxInFlight = 0;
    this.maxActive = 0;
    this.hold = Promise.resolve();
    this.releaseHold = () => undefined;
  }

  armHold(): void {
    this.mode = "hold";
    this.hold = new Promise((resolve) => {
      this.releaseHold = () => {
        this.mode = "ready";
        resolve();
      };
    });
  }

  noteActive(): void {
    this.maxActive = Math.max(this.maxActive, readActiveSeoEvidenceFetchesForTests());
  }

  count(kind: string, locale?: string): number {
    return this.calls.filter((call) => call.kind === kind && (locale === undefined || call.locale === locale))
      .length;
  }

  async handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = requestUrl(input);
    const classified = classifyEvidenceUrl(url);
    if (!classified) {
      return jsonResponse(nonEvidenceBody(url));
    }

    this.calls.push({
      kind: classified.kind,
      locale: classified.locale,
      url,
      signal: init?.signal,
    });
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.noteActive();
    try {
      if (this.mode === "hold") {
        await this.hold;
      }
      this.noteActive();
      if (this.fail) {
        throw new Error(`evidence fetch failed: ${classified.kind}`);
      }
      return evidenceResponse(classified.kind, classified.locale, this.positiveLocales.has(classified.locale));
    } finally {
      this.inFlight -= 1;
    }
  }
}

const control = new FetchControl();

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function classifyEvidenceUrl(url: string): { kind: string; locale: string } | null {
  const parsed = new URL(url);
  if (parsed.pathname === "/api/v1/web-ui-message-packs") {
    return { kind: "web-ui", locale: parsed.searchParams.get("locale") ?? "" };
  }
  if (parsed.pathname === "/api/v1/brand-localization") {
    return { kind: "brand", locale: parsed.searchParams.get("locale") ?? "" };
  }
  if (parsed.pathname === "/api/v1/legal-localization") {
    return {
      kind: `legal:${parsed.searchParams.get("documentType") ?? ""}`,
      locale: parsed.searchParams.get("locale") ?? "",
    };
  }
  const match = parsed.pathname.match(/^\/api\/v1\/translations\/resolve\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return {
    kind: `presentation:${match[1]}:${decodeURIComponent(match[2] ?? "")}`,
    locale: parsed.searchParams.get("language") ?? "",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function nonEvidenceBody(url: string): unknown {
  if (url.includes("/api/v1/languages")) {
    return { success: true, data: { languages: languageRows() } };
  }
  if (url.includes("/api/v1/public/civic-archive")) {
    return { success: true, data: [], meta: { total: 0 } };
  }
  if (url.includes("/api/v1/public/blog")) {
    return { success: true, data: { items: [], total: 0, totalPages: 1, pageSize: 100 } };
  }
  if (url.includes("/api/v1/public/knowledge")) {
    return { success: true, data: { categories: [] } };
  }
  if (url.includes("/api/v1/public/sitemap/")) {
    return { success: true, data: { entries: [] } };
  }
  return { success: true, data: {} };
}

function languageRows() {
  return [
    {
      languageId: "en",
      locale: "en",
      languageCode: "en",
      englishName: "English",
      nativeName: "English",
      textDirection: "ltr",
      fallbackLocale: "en",
      aliases: ["en-US"],
      uiTranslationStatus: "ready",
      seoIndexingEnabled: false,
      contentTranslationEnabled: false,
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
    },
    {
      languageId: "uk",
      locale: "uk",
      languageCode: "uk",
      englishName: "Ukrainian",
      nativeName: "Українська",
      textDirection: "ltr",
      fallbackLocale: "en",
      aliases: ["uk-UA"],
      uiTranslationStatus: "ready",
      seoIndexingEnabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
    },
    {
      languageId: "zh",
      locale: "zh-Hant",
      languageCode: "zh",
      englishName: "Chinese (Traditional)",
      nativeName: "繁體中文",
      textDirection: "ltr",
      fallbackLocale: "en",
      aliases: ["zh-TW", "zh-HK"],
      uiTranslationStatus: "ready",
      seoIndexingEnabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
    },
    {
      languageId: "future",
      locale: "zz-Future",
      languageCode: "zz",
      englishName: "Future",
      nativeName: "Future",
      textDirection: "ltr",
      fallbackLocale: "en",
      aliases: ["zz-FUT"],
      uiTranslationStatus: "ready",
      seoIndexingEnabled: true,
      contentTranslationEnabled: false,
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
    },
  ];
}

function routingCatalog() {
  return languageRows().map((row) => ({
    languageId: row.languageId,
    locale: row.locale,
    textDirection: "ltr" as const,
    aliases: [...row.aliases],
    enabled: true,
    seoIndexingEnabled: row.seoIndexingEnabled,
  }));
}

function evidenceResponse(kind: string, locale: string, positive: boolean): Response {
  if (kind === "web-ui") {
    if (!positive) {
      return jsonResponse({ success: false, data: null }, 404);
    }
    return jsonResponse({
      success: true,
      data: { locale, messages: { greeting: "Hello" }, source: "remote" },
    });
  }
  if (kind === "brand") {
    return jsonResponse({
      success: true,
      data: {
        locale: positive ? locale : "en",
        requestedLocale: locale,
        siteName: "Humanity Union",
        shortName: "HU",
        slogan: "Slogan",
        heroUnityQuote: "Quote",
        seoSiteName: "Humanity Union",
        seoTitleSuffix: "HU",
        defaultMetaDescription: "Description",
        openGraphBrandName: "Humanity Union",
        source: positive ? "published_locale" : "builtin_english",
      },
    });
  }
  if (kind.startsWith("legal:")) {
    const documentType = kind.slice("legal:".length);
    if (!positive) {
      return jsonResponse({ success: false, data: null }, 404);
    }
    return jsonResponse({
      success: true,
      data: {
        documentType,
        locale,
        requestedLocale: locale,
        canonicalSourceVersion:
          documentType === "terms"
            ? CANONICAL_LEGAL_SOURCE_VERSIONS.terms
            : CANONICAL_LEGAL_SOURCE_VERSIONS.privacy,
        localizedBodyHtml: "<p>Localized</p>",
        source: "published_locale",
        isStaleRelativeToCanonical: false,
      },
    });
  }
  if (!positive) {
    return jsonResponse({ data: { presentationMode: "canonical_source", isStale: false } });
  }
  return jsonResponse({ data: { presentationMode: "preferred_translation", isStale: false } });
}

function evidenceFor(locale: string): PublicSeoLocalizedPageEvidence {
  const published = locale === "uk";
  return {
    webUiPublished: published,
    brandPublishedForLocale: published,
    legalPrivacyPublished: published,
    legalTermsPublished: published,
    civicMediaCurrent: published,
    entityCurrent: published,
  };
}

function pureEligible(localeFreePath: string, locale: string): boolean {
  return isPublicSeoLocalizedVariantEligible({
    localeFreePath,
    evidence: evidenceFor(locale),
  });
}

async function waitFor(label: string, predicate: () => boolean): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 4_000) {
      const gauges = readWebWorkloadGauges();
      throw new Error(
        `${label} timed out active=${readActiveSeoEvidenceFetchesForTests()} ` +
          `queued=${readQueuedSeoEvidenceFetchesForTests()} inFlight=${control.inFlight} ` +
          `maxInFlight=${control.maxInFlight} calls=${control.calls.length} ` +
          `eligibility=${gauges.activeSeoEligibilityOperations} ` +
          `metadata=${gauges.activeSeoMetadataOperations} ` +
          `sitemap=${gauges.activeSitemapBuilds}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function restoreEnv(name: "NEXT_PUBLIC_PLATFORM_MODE" | "NEXT_PUBLIC_SITE_URL", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("bounded SEO evidence loading", { concurrency: false }, () => {
  beforeEach(() => {
    control.reset();
    resetLocalizedBrandCacheForTests();
    resetSeoEvidenceFetchGateForTests();
    resetWebMemorySamplerForTests();
    globalThis.fetch = (input, init) => control.handle(input, init);
  });

  afterEach(() => {
    control.releaseHold();
    globalThis.fetch = ORIGINAL_FETCH;
    resetLocalizedBrandCacheForTests();
    resetSeoEvidenceFetchGateForTests();
    resetWebMemorySamplerForTests();
    restoreEnv("NEXT_PUBLIC_PLATFORM_MODE", ORIGINAL_PLATFORM_MODE);
    restoreEnv("NEXT_PUBLIC_SITE_URL", ORIGINAL_SITE_URL);
  });

  it("A. twenty-four overlapping metadata requests share one in-flight fetch per evidence key", async () => {
    control.armHold();
    const pending = Promise.all(
      Array.from({ length: 24 }, () =>
        resolvePublicSeoMetadataDocumentPaths({
          localeFreeCanonicalPath: "/institutions",
          pathname: "/institutions",
        }),
      ),
    );

    await waitFor(
      "metadata overlap",
      () =>
        control.count("web-ui", "uk") === 1 &&
        control.count("web-ui", "zh-Hant") === 1 &&
        control.count("web-ui", "zz-Future") === 1 &&
        readWebWorkloadGauges().activeSeoMetadataOperations === 24 &&
        readWebWorkloadGauges().activeSeoEligibilityOperations === 24,
    );

    assert.equal(control.count("web-ui"), 3);
    assert.equal(control.count("brand"), 0);
    assert.equal(control.count("legal:privacy"), 0);
    assert.equal(control.count("legal:terms"), 0);
    assert.equal(control.calls.filter((call) => call.kind.startsWith("presentation:")).length, 0);
    assert.equal(control.maxInFlight, 3);
    assert.ok(control.maxActive <= SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    for (const call of control.calls) {
      assert.equal(call.signal ?? null, null);
    }
    const keys = readInFlightSeoEvidenceKeysForTests().map((key) => JSON.parse(key) as string[]);
    assert.equal(keys.length, 3);
    for (const locale of SEO_LOCALES) {
      assert.ok(keys.some((parts) => parts[0] === "web-ui" && parts[1] === locale && parts[2] === API_BASE_URL));
    }

    control.releaseHold();
    const documents = await pending;
    assert.equal(control.count("web-ui"), 3);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
    assert.equal(readQueuedSeoEvidenceFetchesForTests(), 0);
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);
    assert.equal(readWebWorkloadGauges().activeSeoMetadataOperations, 0);
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);
    assert.equal(documents.length, 24);
    assert.ok(documents[0]?.languageAlternates?.uk);
    for (const document of documents) {
      assert.deepEqual(document, documents[0]);
    }
  });

  it("B. sitemap and metadata share a process-wide cap of 8 active evidence fetches", async () => {
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
    control.armHold();

    const locales = [...SEO_LOCALES, ...Array.from({ length: 9 }, (_, index) => `loc-${index + 4}`)];
    const paths = ["/blog/hello", "/blog/a", "/blog/b", "/blog/c"];
    const direct = buildPublicSeoLocalizedVariantPredicate({ localeFreePaths: paths, locales });
    const metadata = resolvePublicSeoMetadataDocumentPaths({
      localeFreeCanonicalPath: "/blog/hello",
      pathname: "/uk/blog/hello",
      urlLocaleSegment: "uk",
    });
    const sitemap = buildPublicSitemap();

    await waitFor(
      "global cap",
      () =>
        readActiveSeoEvidenceFetchesForTests() === SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT &&
        readQueuedSeoEvidenceFetchesForTests() > 0 &&
        readWebWorkloadGauges().activeSeoMetadataOperations > 0 &&
        readWebWorkloadGauges().activeSeoEligibilityOperations > 0 &&
        readWebWorkloadGauges().activeSitemapBuilds > 0 &&
        control.maxInFlight === SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT,
    );

    assert.equal(control.inFlight, SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    assert.ok(control.maxActive <= SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    const helloUkBeforeRelease = control.count("presentation:blog_post:hello", "uk");
    assert.equal(helloUkBeforeRelease, 1);

    control.releaseHold();
    const [predicate, metadataDocument, sitemapEntries] = await Promise.all([direct, metadata, sitemap]);
    assert.equal(predicate("/blog/hello", "uk"), true);
    assert.equal(predicate("/blog/hello", "zh-Hant"), false);
    assert.equal(metadataDocument.languageAlternates?.uk?.endsWith("/uk/blog/hello"), true);
    assert.ok(sitemapEntries.some((entry) => entry.url === "https://huws.org/uk/volunteer"));
    assert.equal(control.count("presentation:blog_post:hello", "uk"), 1);
    assert.ok(control.calls.length > SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    assert.equal(control.maxInFlight, SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    assert.ok(control.maxActive <= SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
    assert.equal(readQueuedSeoEvidenceFetchesForTests(), 0);
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);
    assert.equal(readWebWorkloadGauges().activeSeoMetadataOperations, 0);
    assert.equal(readWebWorkloadGauges().activeSeoEligibilityOperations, 0);
    assert.equal(readWebWorkloadGauges().activeSitemapBuilds, 0);
  });

  it("C. every queued evidence task completes or fails closed", async () => {
    control.armHold();
    const locales = Array.from({ length: 12 }, (_, index) => `queue-${index + 1}`);
    const pending = buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/institutions"],
      locales,
    });

    await waitFor(
      "queue fill",
      () =>
        readActiveSeoEvidenceFetchesForTests() === SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT &&
        readQueuedSeoEvidenceFetchesForTests() === locales.length - SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT &&
        control.calls.length === SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT,
    );
    control.fail = true;
    control.releaseHold();

    const predicate = await pending;
    for (const locale of locales) {
      assert.equal(predicate("/institutions", locale), false);
    }
    assert.equal(control.calls.length, locales.length);
    assert.equal(control.maxInFlight <= SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT, true);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
    assert.equal(readQueuedSeoEvidenceFetchesForTests(), 0);
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);

    control.fail = false;
    control.positiveLocales.add("queue-1");
    const recovered = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/institutions"],
      locales: ["queue-1"],
    });
    assert.equal(recovered("/institutions", "queue-1"), true);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
  });

  it("D. a negative result does not survive after its in-flight request settles", async () => {
    control.armHold();
    control.positiveLocales.clear();
    const firstWave = Promise.all(
      Array.from({ length: 24 }, () =>
        buildPublicSeoLocalizedVariantPredicate({
          localeFreePaths: ["/privacy", "/blog/negative-post", "/institutions"],
          locales: ["de"],
        }),
      ),
    );
    await waitFor(
      "negative in flight",
      () =>
        control.count("legal:privacy", "de") === 1 &&
        control.count("presentation:blog_post:negative-post", "de") === 1 &&
        control.count("web-ui", "de") === 1 &&
        readInFlightSeoEvidenceKeysForTests().length === 3,
    );
    const joined = Promise.all(
      Array.from({ length: 8 }, () =>
        buildPublicSeoLocalizedVariantPredicate({
          localeFreePaths: ["/privacy", "/blog/negative-post", "/institutions"],
          locales: ["de"],
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(control.count("legal:privacy", "de"), 1);
    assert.equal(control.count("web-ui", "de"), 1);
    assert.equal(control.count("presentation:blog_post:negative-post", "de"), 1);
    const privacyKey = readInFlightSeoEvidenceKeysForTests().find((key) => key.includes("privacy"));
    assert.ok(privacyKey);
    const parts = JSON.parse(privacyKey) as string[];
    assert.deepEqual(parts, [
      "legal",
      "privacy",
      "de",
      CANONICAL_LEGAL_SOURCE_VERSIONS.privacy,
      API_BASE_URL,
    ]);

    control.releaseHold();
    const predicates = await firstWave;
    await joined;
    for (const predicate of predicates) {
      assert.equal(predicate("/privacy", "de"), false);
      assert.equal(predicate("/blog/negative-post", "de"), false);
      assert.equal(predicate("/institutions", "de"), false);
    }
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);

    control.positiveLocales.add("de");
    const again = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/privacy", "/blog/negative-post", "/institutions"],
      locales: ["de"],
    });
    assert.equal(control.count("legal:privacy", "de"), 2);
    assert.equal(control.count("web-ui", "de"), 2);
    assert.equal(control.count("presentation:blog_post:negative-post", "de"), 2);
    assert.equal(again("/privacy", "de"), true);
    assert.equal(again("/blog/negative-post", "de"), true);
    assert.equal(again("/institutions", "de"), true);
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);
  });

  it("E. page-family evidence and eligibility stay aligned with the existing predicate", async () => {
    const cases: ReadonlyArray<{ path: string; kinds: readonly string[]; eligible: boolean }> = [
      { path: "/", kinds: ["web-ui", "brand"], eligible: true },
      { path: "/institutions", kinds: ["web-ui"], eligible: true },
      { path: "/initiatives", kinds: ["web-ui"], eligible: true },
      { path: "/blog", kinds: ["web-ui"], eligible: true },
      { path: "/knowledge", kinds: ["web-ui"], eligible: true },
      { path: "/volunteer", kinds: ["web-ui"], eligible: true },
      { path: "/contact", kinds: ["web-ui"], eligible: true },
      { path: "/membership", kinds: ["web-ui"], eligible: true },
      { path: "/privacy", kinds: ["legal:privacy"], eligible: true },
      { path: "/terms", kinds: ["legal:terms"], eligible: true },
      { path: "/media", kinds: ["presentation:civic_media:civic-media-center"], eligible: true },
      { path: "/initiatives/public/init-1", kinds: ["presentation:initiative:init-1"], eligible: true },
      { path: "/blog/hello", kinds: ["presentation:blog_post:hello"], eligible: true },
      { path: "/knowledge/guide", kinds: [], eligible: false },
      { path: "/support", kinds: [], eligible: false },
    ];

    for (const entry of cases) {
      control.calls = [];
      resetLocalizedBrandCacheForTests();
      const predicate = await buildPublicSeoLocalizedVariantPredicate({
        localeFreePaths: [entry.path],
        locales: ["uk"],
      });
      assert.deepEqual(
        control.calls.map((call) => call.kind).sort(),
        [...entry.kinds].sort(),
        entry.path,
      );
      assert.equal(predicate(entry.path, "uk"), entry.eligible, entry.path);
      assert.equal(predicate(entry.path, "uk"), pureEligible(entry.path, "uk"), entry.path);
      assert.equal(predicate(entry.path, "fr"), false);
    }

    control.calls = [];
    control.positiveLocales.add("en");
    const english = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/", "/institutions", "/privacy", "/blog/hello", "/knowledge/guide"],
      locales: ["en"],
    });
    assert.equal(control.count("web-ui"), 0);
    assert.equal(english("/", "en"), false);
    assert.equal(english("/institutions", "en"), false);
    assert.equal(english("/privacy", "en"), true);
    assert.equal(english("/blog/hello", "en"), true);
    assert.equal(english("/knowledge/guide", "en"), false);

    control.calls = [];
    control.positiveLocales = new Set(["uk"]);
    resetLocalizedBrandCacheForTests();
    const mixed = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: cases.map((entry) => entry.path),
      locales: ["uk", "zh-Hant"],
    });
    const kinds = new Set(control.calls.map((call) => `${call.kind}:${call.locale}`));
    for (const kind of ["web-ui", "brand", "legal:privacy", "legal:terms", "presentation:civic_media:civic-media-center", "presentation:initiative:init-1", "presentation:blog_post:hello"]) {
      assert.equal(kinds.has(`${kind}:uk`), true, kind);
      assert.equal(kinds.has(`${kind}:zh-Hant`), true, kind);
    }
    assert.equal(control.calls.length, 14);
    for (const entry of cases) {
      assert.equal(mixed(entry.path, "uk"), pureEligible(entry.path, "uk"), entry.path);
      assert.equal(mixed(entry.path, "zh-Hant"), pureEligible(entry.path, "zh-Hant"), entry.path);
    }
    for (const call of control.calls.filter((call) => call.kind === "web-ui")) {
      assert.equal(call.signal ?? null, null);
    }
    for (const call of control.calls.filter((call) => call.kind.startsWith("presentation:") || call.kind.startsWith("legal:"))) {
      assert.ok(call.signal);
    }
  });

  it("F. sitemap and hreflang match the existing eligibility predicate", async () => {
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";

    const familyPaths = [
      "/",
      "/privacy",
      "/terms",
      "/media",
      "/volunteer",
      "/contact",
      "/blog/hello",
      "/initiatives/public/init-1",
      "/knowledge/guide",
      "/support",
    ];
    const loader = await buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: familyPaths,
      locales: SEO_LOCALES,
    });
    const expandedByLoader = expandPublicSitemapEntriesForSeoLocales({
      entries: familyPaths.map((path, index) => ({
        path,
        lastModified: `2026-01-${String(index + 1).padStart(2, "0")}`,
      })),
      seoIndexableLocales: SEO_LOCALES,
      isLocalizedVariantEligible: loader,
    });
    const expandedByPredicate = expandPublicSitemapEntriesForSeoLocales({
      entries: familyPaths.map((path, index) => ({
        path,
        lastModified: `2026-01-${String(index + 1).padStart(2, "0")}`,
      })),
      seoIndexableLocales: SEO_LOCALES,
      isLocalizedVariantEligible: pureEligible,
    });
    assert.deepEqual(expandedByLoader, expandedByPredicate);
    assert.ok(expandedByLoader.some((entry) => entry.path === "/uk/volunteer"));
    assert.ok(expandedByLoader.some((entry) => entry.path === "/uk/blog/hello"));
    assert.equal(expandedByLoader.some((entry) => entry.path.endsWith("/knowledge/guide") && entry.path !== "/knowledge/guide"), false);
    assert.equal(expandedByLoader.some((entry) => entry.path.includes("/zh-hant/")), false);
    assert.equal(expandedByLoader[1]?.lastModified, expandedByPredicate[1]?.lastModified);

    const canonical = await collectPublicSitemapPathEntries({
      includeDynamicProviders: false,
      seoIndexableLocales: [],
    });
    const produced = await buildPublicSitemap();
    const expected = expandPublicSitemapEntriesForSeoLocales({
      entries: canonical,
      seoIndexableLocales: [...SEO_LOCALES],
      isLocalizedVariantEligible: pureEligible,
    }).map((entry) => `https://huws.org${entry.path}`);
    assert.deepEqual(produced.map((entry) => entry.url), expected);
    assert.ok(produced.some((entry) => entry.url === "https://huws.org/uk/privacy"));
    assert.equal(produced.some((entry) => entry.url.includes("/zh-hant/")), false);

    for (const path of ["/volunteer", "/blog/hello", "/knowledge/guide", "/support"]) {
      const loaded = await resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: path,
        pathname: `/uk${path === "/" ? "" : path}`,
        urlLocaleSegment: "uk",
      });
      const explicit = await resolvePublicSeoMetadataDocumentPaths({
        localeFreeCanonicalPath: path,
        pathname: `/uk${path === "/" ? "" : path}`,
        urlLocaleSegment: "uk",
        catalog: routingCatalog(),
        isLocalizedVariantEligible: pureEligible,
      });
      assert.deepEqual(loaded, explicit, path);

      const fromLoaderMetadata = await buildPublicPageMetadataForRequest({
        title: "Document",
        canonicalPath: path,
        localeFreeCanonicalPath: path,
        catalog: routingCatalog(),
        pathname: `/uk${path === "/" ? "" : path}`,
        urlLocaleSegment: "uk",
        isLocalizedVariantEligible: loader,
      });
      const fromPureMetadata = await buildPublicPageMetadataForRequest({
        title: "Document",
        canonicalPath: path,
        localeFreeCanonicalPath: path,
        catalog: routingCatalog(),
        pathname: `/uk${path === "/" ? "" : path}`,
        urlLocaleSegment: "uk",
        isLocalizedVariantEligible: pureEligible,
      });
      assert.deepEqual(fromLoaderMetadata.alternates, fromPureMetadata.alternates, path);
    }
  });

  it("G. a rejected evidence fetch releases its permit", async () => {
    let releaseHold: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    let ninthStarted = false;
    const failures = Array.from({ length: SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT }, (_, index) =>
      runSeoEvidenceFetch(`error-${index}`, async () => {
        await hold;
        throw new Error(`boom-${index}`);
      }),
    );
    const ninth = runSeoEvidenceFetch("after-errors", async () => {
      ninthStarted = true;
      return "ok" as const;
    });

    await waitFor(
      "error cap",
      () =>
        readActiveSeoEvidenceFetchesForTests() === SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT &&
        readQueuedSeoEvidenceFetchesForTests() === 1 &&
        ninthStarted === false,
    );
    releaseHold();
    const settled = await Promise.allSettled(failures);
    assert.deepEqual(
      settled.map((result) => result.status),
      Array.from({ length: SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT }, () => "rejected"),
    );
    assert.equal(await ninth, "ok");
    assert.equal(ninthStarted, true);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
    assert.equal(readQueuedSeoEvidenceFetchesForTests(), 0);
    assert.equal(readInFlightSeoEvidenceKeysForTests().length, 0);

    control.armHold();
    control.fail = true;
    const locales = Array.from({ length: SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT }, (_, index) => `err-${index}`);
    const pending = buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/terms"],
      locales,
    });
    await waitFor("loader errors", () => control.calls.length === locales.length);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    control.releaseHold();
    const predicate = await pending;
    for (const locale of locales) {
      assert.equal(predicate("/terms", locale), false);
    }
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
    assert.equal(readQueuedSeoEvidenceFetchesForTests(), 0);

    let followUpEntered = 0;
    control.fail = false;
    control.armHold();
    control.positiveLocales = new Set(locales);
    const originalHandle = control.handle.bind(control);
    control.handle = async (input, init) => {
      followUpEntered += 1;
      return originalHandle(input, init);
    };
    const followUp = buildPublicSeoLocalizedVariantPredicate({
      localeFreePaths: ["/terms"],
      locales,
    });
    await waitFor("permits available", () => followUpEntered === locales.length && readQueuedSeoEvidenceFetchesForTests() === 0);
    assert.equal(readActiveSeoEvidenceFetchesForTests(), SEO_EVIDENCE_FETCH_CONCURRENCY_LIMIT);
    control.releaseHold();
    const recovered = await followUp;
    for (const locale of locales) {
      assert.equal(recovered("/terms", locale), true);
    }
    assert.equal(readActiveSeoEvidenceFetchesForTests(), 0);
  });
});
