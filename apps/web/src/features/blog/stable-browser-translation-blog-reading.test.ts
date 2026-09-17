/**
 * Stabilize browser translation for Blog ordinary reading —
 * WEB remains browser-native; PWA Pack 01 may apply ownership-gated CURRENT CT.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveOrdinaryReadingOwner } from "../language/ordinary-reading-ownership.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Stable Browser Translation — Blog ordinary reading", () => {
  const article = readFeatures("blog/components/BlogArticlePageContent.tsx");
  const body = readFeatures("blog/components/BlogArticleBody.tsx");

  it("visible Blog WEB reading stays browser-native; PWA uses ownership gate", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "blog_post",
      }),
      "browser-native",
    );
    assert.doesNotMatch(article, /resolveBlogPostPresentation/);
    assert.doesNotMatch(article, /setDisplayContentHtml/);
    assert.doesNotMatch(article, /setDisplayTitle/);
    assert.match(article, /useHuPersistedOrdinaryFields/);
    assert.match(article, /data-hu-reading-owner=\{readingOwner\}/);
    assert.doesNotMatch(article, /generateContentTranslation/);
  });

  it("canonical article title/body remain the WEB reading source; PWA may overlay CURRENT", () => {
    assert.match(article, /persisted\.owner === "hu-persisted"/);
    assert.match(article, /post\.title/);
    assert.match(article, /post\.content/);
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.match(body, /dangerouslySetInnerHTML/);
  });

  it("content-language boundary follows owner (canonical en or persisted activeLanguage)", () => {
    assert.match(article, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(article, /className="blog-article__canonical-reading"/);
    assert.match(article, /lang=\{contentLang\}/);
    assert.match(article, /data-hu-content-lang=\{contentLang\}/);
    assert.match(article, /useLocale\(\)/);
  });

  it("browser translation eligibility is not blocked by translate=no on the article body", () => {
    assert.doesNotMatch(article, /translate=["']no["']/);
    assert.doesNotMatch(body, /translate=["']no["']/);
    assert.doesNotMatch(article, /ProtectedAuthoritativeText/);
    assert.doesNotMatch(body, /ProtectedAuthoritativeText/);
  });

  it("Blog feed cards also use ownership-gated ordinary reading", () => {
    const card = readFeatures("blog/components/BlogPostCard.tsx");
    assert.doesNotMatch(card, /resolveBlogPostPresentation/);
    assert.match(card, /useHuPersistedOrdinaryFields/);
    assert.match(card, /data-hu-reading-owner=\{persisted\.owner\}/);
  });

  it("CT presentation infrastructure remains available outside ordinary article reading", () => {
    const resolver = readFeatures("blog/resolve-blog-post-presentation.ts");
    assert.match(resolver, /export async function resolveBlogPostPresentation/);
    assert.match(resolver, /sourceKind:\s*"blog_post"/);

    const seed = readFeatures("blog/load-blog-article-presentation-seed.ts");
    assert.match(seed, /resolveTranslatedContent/);
  });
});
