/**
 * SEO-09 — Streamed metadata location.
 *
 * Config layer (always runs): `htmlLimitedBots` makes Next resolve metadata
 * before streaming for every non-empty user agent, checked through Next's own
 * `shouldServeStreamingMetadata`.
 *
 * Server HTML layer (runs when `SEO09_HTML_BASE_URL` is set, e.g. a local
 * `next start` of a production build or the staging origin): fetches real
 * documents and asserts metadata tags sit inside <head> and nowhere in <body>.
 *
 *   SEO09_HTML_BASE_URL=https://staging.huws.org \
 *   SEO09_EXPECTED_ROBOTS="noindex, nofollow" \
 *   pnpm --filter @hu/web exec node --require ./scripts/register-css-cjs-stub.cjs \
 *     --import tsx --test src/features/seo-head-metadata-placement-seo09/*.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldServeStreamingMetadata } from "next/dist/server/lib/streaming-metadata";

import nextConfig from "../../../next.config";

const USER_AGENTS = {
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  googlebotSmartphone:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  twitterbot: "Twitterbot/1.0",
  linkedin: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  yandex: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  duckduckbot: "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  applebot: "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
  lighthouse:
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  woorank: "Mozilla/5.0 (compatible; WooRank/1.0; +https://www.woorank.com)",
} as const;

describe("SEO-09 — htmlLimitedBots configuration", () => {
  it("is a RegExp, the only shape Next 16 accepts", () => {
    assert.ok(nextConfig.htmlLimitedBots instanceof RegExp);
  });

  it("resolves metadata before streaming for browsers, search engines, social and audit crawlers", () => {
    // Next serializes the RegExp to its source string during loadConfig.
    const configured = (nextConfig.htmlLimitedBots as RegExp).source;
    for (const [name, ua] of Object.entries(USER_AGENTS)) {
      assert.equal(
        shouldServeStreamingMetadata(ua, configured),
        false,
        `${name} must receive blocking (in-<head>) metadata`,
      );
    }
  });

  it("documents the Next default it replaces: browsers and Googlebot would stream into <body>", () => {
    assert.equal(shouldServeStreamingMetadata(USER_AGENTS.browser, undefined), true);
    assert.equal(shouldServeStreamingMetadata(USER_AGENTS.googlebot, undefined), true);
  });
});

type Located = { head: number; body: number };

type MetadataLocation = {
  htmlLang: string | null;
  htmlDir: string | null;
  canonical: Located & { hrefs: string[] };
  robots: Located & { values: string[] };
  title: Located;
  description: Located;
  hreflang: Located & { codes: string[] };
  ogInHead: Map<string, number>;
  ogInBody: number;
  twitterInHead: Map<string, number>;
  twitterInBody: number;
};

const CANONICAL_RE = /<link\b[^>]*\brel="canonical"[^>]*>/gi;
const ROBOTS_RE = /<meta\b[^>]*\bname="robots"[^>]*>/gi;
const TITLE_RE = /<title\b[^>]*>/gi;
const DESCRIPTION_RE = /<meta\b[^>]*\bname="description"[^>]*>/gi;
const HREFLANG_RE = /<link\b[^>]*\bhreflang="[^"]*"[^>]*>/gi;
const OG_RE = /<meta\b[^>]*\bproperty="(og:[^"]+)"[^>]*>/gi;
const TWITTER_RE = /<meta\b[^>]*\bname="(twitter:[^"]+)"[^>]*>/gi;

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function matches(source: string, re: RegExp): RegExpMatchArray[] {
  return [...source.matchAll(re)];
}

function countByName(source: string, re: RegExp): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of matches(source, re)) {
    const name = match[1] ?? "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function locateMetadata(html: string): MetadataLocation {
  const headEnd = html.search(/<\/head>/i);
  assert.ok(headEnd > 0, "document must have a </head>");
  const head = html.slice(0, headEnd);
  // Inline SVG may carry its own <title>; that is not document metadata.
  const body = html.slice(headEnd).replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";

  const located = (re: RegExp): Located => ({
    head: matches(head, re).length,
    body: matches(body, re).length,
  });

  return {
    htmlLang: attr(htmlTag, "lang"),
    htmlDir: attr(htmlTag, "dir"),
    canonical: {
      ...located(CANONICAL_RE),
      hrefs: matches(html, CANONICAL_RE).map((m) => attr(m[0], "href") ?? ""),
    },
    robots: {
      ...located(ROBOTS_RE),
      values: matches(head, ROBOTS_RE).map((m) => attr(m[0], "content") ?? ""),
    },
    title: located(TITLE_RE),
    description: located(DESCRIPTION_RE),
    hreflang: {
      ...located(HREFLANG_RE),
      codes: matches(head, HREFLANG_RE).map((m) => attr(m[0], "hreflang") ?? ""),
    },
    ogInHead: countByName(head, OG_RE),
    ogInBody: matches(body, OG_RE).length,
    twitterInHead: countByName(head, TWITTER_RE),
    twitterInBody: matches(body, TWITTER_RE).length,
  };
}

const SINGLE_VALUED_SOCIAL = [
  "og:title",
  "og:description",
  "og:url",
  "og:type",
  "twitter:card",
  "twitter:title",
  "twitter:description",
];

type PageExpectation = {
  path: string;
  expectHreflang: boolean;
  expectLang?: string;
  expectDir?: "ltr" | "rtl";
};

function assertMetadataInHead(
  located: MetadataLocation,
  page: PageExpectation,
  expectedOrigin: string,
  expectedRobots: string | undefined,
): void {
  assert.equal(located.canonical.head, 1, "exactly one canonical inside <head>");
  assert.equal(located.canonical.body, 0, "no canonical in <body>");
  const canonical = new URL(located.canonical.hrefs[0] ?? "");
  assert.equal(canonical.origin, expectedOrigin, "canonical uses the deployment origin");
  assert.equal(canonical.pathname, page.path, "canonical is self-referencing");

  assert.equal(located.robots.head, 1, "exactly one robots meta inside <head>");
  assert.equal(located.robots.body, 0, "no robots meta in <body>");
  if (expectedRobots) {
    assert.equal(located.robots.values[0], expectedRobots);
  }

  assert.equal(located.title.head, 1, "exactly one <title> inside <head>");
  assert.equal(located.title.body, 0, "no document <title> in <body>");
  assert.equal(located.description.head, 1, "exactly one description inside <head>");
  assert.equal(located.description.body, 0, "no description in <body>");

  assert.equal(located.hreflang.body, 0, "no hreflang alternates in <body>");
  if (page.expectHreflang) {
    assert.ok(located.hreflang.head >= 2, "hreflang alternates inside <head>");
    assert.ok(located.hreflang.codes.includes("x-default"), "x-default alternate present");
    assert.equal(
      new Set(located.hreflang.codes).size,
      located.hreflang.codes.length,
      "no duplicate hreflang codes",
    );
  }

  assert.equal(located.ogInBody, 0, "no Open Graph tags in <body>");
  assert.equal(located.twitterInBody, 0, "no Twitter tags in <body>");
  assert.equal(located.ogInHead.get("og:title"), 1, "og:title inside <head>");
  assert.equal(located.twitterInHead.get("twitter:card"), 1, "twitter:card inside <head>");
  for (const name of SINGLE_VALUED_SOCIAL) {
    const count = located.ogInHead.get(name) ?? located.twitterInHead.get(name) ?? 0;
    assert.ok(count <= 1, `${name} must not be duplicated`);
  }

  if (page.expectLang) {
    assert.equal(located.htmlLang, page.expectLang);
  }
  if (page.expectDir) {
    assert.equal(located.htmlDir, page.expectDir);
  }
}

const baseUrl = process.env.SEO09_HTML_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const expectedOrigin =
  process.env.SEO09_EXPECTED_ORIGIN?.trim() || (baseUrl && new URL(baseUrl).origin);
const expectedRobots = process.env.SEO09_EXPECTED_ROBOTS?.trim() || undefined;
const blogSlug = process.env.SEO09_BLOG_SLUG?.trim() || "leader";

const CASES: Array<{ label: string; ua: keyof typeof USER_AGENTS; page: PageExpectation }> = [
  {
    label: "A Home — browser",
    ua: "browser",
    page: { path: "/", expectHreflang: true, expectLang: "en", expectDir: "ltr" },
  },
  { label: "B Home — Googlebot", ua: "googlebot", page: { path: "/", expectHreflang: true } },
  { label: "C Home — Bingbot", ua: "bingbot", page: { path: "/", expectHreflang: true } },
  {
    label: "D Home — social crawler (facebookexternalhit)",
    ua: "facebook",
    page: { path: "/", expectHreflang: true },
  },
  {
    label: "E Localized Home /ar — browser",
    ua: "browser",
    page: { path: "/ar", expectHreflang: true, expectLang: "ar", expectDir: "rtl" },
  },
  {
    label: "E Localized Home /ar — Googlebot",
    ua: "googlebot",
    page: { path: "/ar", expectHreflang: true, expectLang: "ar", expectDir: "rtl" },
  },
  {
    label: "F Section /blog — browser",
    ua: "browser",
    page: { path: "/blog", expectHreflang: true },
  },
  {
    label: "F Section /blog — Googlebot",
    ua: "googlebot",
    page: { path: "/blog", expectHreflang: true },
  },
  {
    label: "G Blog post — browser",
    ua: "browser",
    page: { path: `/blog/${blogSlug}`, expectHreflang: false },
  },
  {
    label: "G Blog post — Googlebot",
    ua: "googlebot",
    page: { path: `/blog/${blogSlug}`, expectHreflang: false },
  },
];

describe(
  "SEO-09 — server HTML metadata placement",
  { skip: !baseUrl && "set SEO09_HTML_BASE_URL" },
  () => {
    for (const { label, ua, page } of CASES) {
      it(label, async () => {
        const response = await fetch(`${baseUrl}${page.path}`, {
          headers: { "user-agent": USER_AGENTS[ua], accept: "text/html" },
          redirect: "manual",
        });
        assert.equal(response.status, 200, `${page.path} must return 200`);
        const html = await response.text();
        assert.doesNotMatch(html, /https?:\/\/localhost[:/]/i, "no localhost URLs");
        assertMetadataInHead(locateMetadata(html), page, expectedOrigin, expectedRobots);
      });
    }
  },
);
