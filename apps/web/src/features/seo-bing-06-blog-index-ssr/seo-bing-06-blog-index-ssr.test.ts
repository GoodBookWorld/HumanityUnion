/**
 * SEO-BING-06 — the default `/blog` view renders server-fetched public
 * publications in its first (server) render; filtered views keep loading in
 * the browser exactly as before.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import type {
  BlogCategory,
  BlogCategoryId,
  PublicBlogPostListItem,
  PublicBlogPostListResponse,
} from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  BlogIndexPageContent,
  type BlogIndexInitialData,
} from "../blog/components/BlogIndexPageContent.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const PAGE = readFileSync(path.join(webSrc, "app/blog/page.tsx"), "utf8");
const CONTENT = readFileSync(
  path.join(webSrc, "features/blog/components/BlogIndexPageContent.tsx"),
  "utf8",
);

const CATEGORIES: BlogCategory[] = [
  {
    categoryId: "human-security" as BlogCategoryId,
    slug: "human-security",
    name: "Human Security",
  },
  { categoryId: "civic-life" as BlogCategoryId, slug: "civic-life", name: "Civic Life" },
];

function post(index: number): PublicBlogPostListItem {
  const category = CATEGORIES[index % 2]!;
  return {
    postId: `post-${index}`,
    slug: `fixture-post-${index}`,
    title: `Fixture publication ${index}`,
    excerpt: `Excerpt for fixture publication ${index}.`,
    coverImage: null,
    author: { displayName: `Author ${index}` },
    publishedAt: `2026-10-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
    category,
    tags: [],
    commentCount: index,
  };
}

const LISTING: PublicBlogPostListResponse = {
  items: Array.from({ length: 9 }, (_, i) => post(i + 1)),
  total: 31,
  limit: 9,
  offset: 0,
  page: 1,
  pageSize: 9,
  totalPages: 4,
  categoryCounts: CATEGORIES.map((c, i) => ({ ...c, count: 15 + i })),
  latestPublications: Array.from({ length: 4 }, (_, i) => post(i + 1)),
  blogIndexViews: 1234,
};
const INITIAL: BlogIndexInitialData = { categories: CATEGORIES, listing: LISTING };

interface BlogPublicCopy {
  readonly pageTitle: string;
  readonly loadingPublications: string;
}

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

async function render(
  locale: string,
  search: string,
  initialData?: BlogIndexInitialData | null,
): Promise<{ html: string; t: BlogPublicCopy }> {
  const loaded = await loadUiMessagesForLocale(locale);
  const props: React.ComponentProps<typeof BlogIndexPageContent> =
    initialData === undefined ? {} : { initialData };
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: loaded.messages, timeZone: "UTC" } as React.ComponentProps<
        typeof NextIntlClientProvider
      >,
      createElement(
        AppRouterContext.Provider,
        { value: ROUTER },
        createElement(
          PathnameContext.Provider,
          { value: "/blog" },
          createElement(
            SearchParamsContext.Provider,
            { value: new URLSearchParams(search) as never },
            createElement(BlogIndexPageContent, props),
          ),
        ),
      ),
    ),
  );
  const t = (loaded.messages as unknown as { blogPublic: BlogPublicCopy }).blogPublic;
  return { html, t };
}

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const postLinks = (html: string) =>
  new Set(Array.from(html.matchAll(/href="\/blog\/(fixture-post-\d+)"/g), (m) => m[1]!));

describe("SEO-BING-06 — Blog index server render", () => {
  for (const locale of ["en", "uk"]) {
    it(`1. ${locale}: default view renders 9 cards, rails and no loading state`, async () => {
      const { html, t } = await render(locale, "", INITIAL);
      assert.equal(count(html, /<h1\b/g), 1);
      assert.ok(html.includes(`<h1 class="hu-heading-1">${t.pageTitle}</h1>`));
      const feed = html.slice(html.indexOf('class="blog-post-feed"'));
      assert.equal(
        count(feed.slice(0, feed.indexOf("</section>")), /class="hu-card blog-post-card"/g),
        9,
      );
      for (let i = 1; i <= 9; i += 1) assert.ok(postLinks(html).has(`fixture-post-${i}`));
      assert.ok(html.includes("category=human-security"), "category information");
      assert.match(html, /1[\s\u00a0\u202f.,]?234/u, "views");
      assert.equal(html.includes(t.loadingPublications), false, "no loading placeholder");
      assert.match(html, /class="blog-subscribe"/, "subscription form preserved");
    });
  }

  it("2. without initial data the existing loading state is unchanged", async () => {
    for (const initial of [undefined, null] as const) {
      const { html, t } = await render("en", "", initial);
      assert.ok(html.includes(t.loadingPublications));
      assert.equal(postLinks(html).size, 0);
    }
  });

  it("3. non-default URLs ignore server data and load in the browser", async () => {
    for (const search of ["q=earth", "category=human-security", "page=2"]) {
      const { html, t } = await render("en", search, INITIAL);
      assert.ok(html.includes(t.loadingPublications), search);
      assert.equal(postLinks(html).size, 0, search);
    }
    const explicitDefault = await render("en", "category=all&page=1", INITIAL);
    assert.equal(postLinks(explicitDefault.html).size >= 9, true);
  });

  it("4. page fetches public data only for the default view, in parallel, with fallback", () => {
    assert.match(
      PAGE,
      /export default async function BlogPage\(\{ searchParams \}: BlogPageProps\)/,
    );
    assert.match(PAGE, /\(firstParam\(params\.q\) \?\? ""\) === ""/);
    assert.match(PAGE, /\(firstParam\(params\.category\) \?\? "all"\) === "all"/);
    assert.match(PAGE, /parseBlogPageParam\(firstParam\(params\.page\)\) === 1/);
    assert.match(
      PAGE,
      /await Promise\.all\(\[\s*fetchPublicBlogCategories\(\)\.catch\(\(\) => null\),/,
    );
    assert.match(
      PAGE,
      /fetchPublicBlogPosts\(\{ page: 1, pageSize: BLOG_PAGE_SIZE, includeDiscovery: true \}\)/,
    );
    assert.match(PAGE, /<BlogIndexPageContent initialData=\{initialData\} \/>/);
    // A Suspense boundary or route loading.tsx would stream the cards in hidden blocks.
    assert.equal(/Suspense/.test(PAGE), false);
    assert.equal(existsSync(path.join(webSrc, "app/blog/loading.tsx")), false);
    assert.match(PAGE, /export async function generateMetadata\(\): Promise<Metadata>/);
  });

  it("5. client skips only the seeded initial fetches and keeps abort handling", () => {
    assert.match(CONTENT, /if \(seededOnMount\.current\) \{\s*return;\s*\}/);
    assert.match(
      CONTENT,
      /if \(skipSeededPostsFetch\.current\) \{\s*skipSeededPostsFetch\.current = false;\s*return;\s*\}/,
    );
    assert.match(CONTENT, /const controller = new AbortController\(\);/);
    assert.match(CONTENT, /controller\.abort\(\);/);
    assert.match(CONTENT, /q === "" && categorySlug === "all" && page === 1/);
  });
});
