/**
 * SEO-BING-06 — the Knowledge index renders the public listing in its first
 * (server) render when the page passes server-fetched initial data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { KnowledgeCenterListing } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { KnowledgeCenterPageContent } from "../knowledge-center/components/KnowledgeCenterPageContent.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const PAGE = readFileSync(path.join(webSrc, "app/knowledge/page.tsx"), "utf8");
const CONTENT = readFileSync(
  path.join(webSrc, "features/knowledge-center/components/KnowledgeCenterPageContent.tsx"),
  "utf8",
);
const SERVICE_MODULE = path.join(
  repoRoot,
  "apps/api/src/modules/knowledge-center/knowledge-center.service.ts",
);

let listing: KnowledgeCenterListing;

before(async () => {
  const service = (await import(pathToFileURL(SERVICE_MODULE).href)) as {
    listKnowledgeCategories: () => KnowledgeCenterListing;
  };
  listing = service.listKnowledgeCategories();
});

async function render(
  locale: string,
  initialListing?: KnowledgeCenterListing | null,
): Promise<{ html: string; messages: { knowledgePublic: Record<string, string> } }> {
  const loaded = await loadUiMessagesForLocale(locale);
  const props: React.ComponentProps<typeof KnowledgeCenterPageContent> =
    initialListing === undefined ? {} : { initialListing };
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: loaded.messages,
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(KnowledgeCenterPageContent, props),
    ),
  );
  return {
    html,
    messages: loaded.messages as unknown as { knowledgePublic: Record<string, string> },
  };
}

function count(haystack: string, pattern: RegExp): number {
  return (haystack.match(pattern) ?? []).length;
}

function articleHrefs(html: string): Set<string> {
  return new Set(Array.from(html.matchAll(/href="\/knowledge\/([a-z0-9-]+)"/g), (m) => m[1]!));
}

describe("SEO-BING-06 — Knowledge index server render", () => {
  it("1. with the public listing: one H1, intro, 7 category cards and all 59 article links", async () => {
    assert.equal(listing.categories.length, 7);
    assert.equal(listing.totalArticles, 59);
    const { html, messages } = await render("en", listing);

    assert.equal(count(html, /<h1\b/g), 1);
    assert.ok(html.includes(`<h1>${messages.knowledgePublic.pageTitle}</h1>`));
    assert.match(html, /class="knowledge-center__intro"/);
    assert.equal(count(html, /<div class="knowledge-category-grid">/g), 1);
    const grid = html.slice(html.indexOf('<div class="knowledge-category-grid">'));
    assert.equal(count(grid, /<h2>/g), 7, "seven category cards");

    const slugs = listing.categories.flatMap((category) => category.articles.map((a) => a.slug));
    assert.equal(slugs.length, 59);
    const hrefs = articleHrefs(html);
    for (const slug of slugs) assert.ok(hrefs.has(slug), `link /knowledge/${slug}`);
    assert.equal(count(html, /role="status"/g), 0, "no loading placeholder");
  });

  it("2. Ukrainian renders the localized H1 and the same 59 links", async () => {
    const english = await render("en", listing);
    const { html, messages } = await render("uk", listing);
    assert.equal(count(html, /<h1\b/g), 1);
    assert.ok(html.includes(`<h1>${messages.knowledgePublic.pageTitle}</h1>`));
    assert.notEqual(messages.knowledgePublic.pageTitle, english.messages.knowledgePublic.pageTitle);
    assert.equal(articleHrefs(html).size, 59);
  });

  it("3. without server data the existing loading state is unchanged", async () => {
    for (const initial of [undefined, null] as const) {
      const { html, messages } = await render("en", initial);
      assert.ok(html.includes(`<p role="status">${messages.knowledgePublic.loading}</p>`));
      assert.equal(count(html, /<h1\b/g), 0);
      assert.equal(articleHrefs(html).size, 0);
    }
  });

  it("4. page fetches the public listing on the server with a safe fallback", () => {
    assert.match(PAGE, /export default async function KnowledgePage\(\)/);
    assert.match(PAGE, /const listing = await fetchKnowledgeListing\(\)\.catch\(\(\) => null\);/);
    assert.match(PAGE, /<KnowledgeCenterPageContent initialListing=\{listing\} \/>/);
    assert.match(PAGE, /export async function generateMetadata\(\): Promise<Metadata>/);
  });

  it("5. client skips the browser listing fetch when server data exists", () => {
    assert.match(CONTENT, /useState<KnowledgeCenterListing \| null>\(initialListing\)/);
    assert.match(
      CONTENT,
      /useEffect\(\(\) => \{\s*if \(initialListing\) \{\s*return;\s*\}\s*void fetchKnowledgeListing\(\)/,
    );
    assert.match(CONTENT, /<KnowledgeSearchPanel \/>/);
  });
});
