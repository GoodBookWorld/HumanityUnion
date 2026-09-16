/**
 * Stabilize browser translation for Blog ordinary reading —
 * no post-mount CT title/body HTML replacement.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Stable Browser Translation — Blog ordinary reading", () => {
  const article = readFeatures("blog/components/BlogArticlePageContent.tsx");
  const body = readFeatures("blog/components/BlogArticleBody.tsx");

  it("visible Blog reading does not apply CT presentation post-mount", () => {
    assert.doesNotMatch(article, /resolveBlogPostPresentation/);
    assert.doesNotMatch(article, /setDisplayContentHtml/);
    assert.doesNotMatch(article, /setDisplayTitle/);
    assert.doesNotMatch(article, /usePublicContentReadingContext/);
    assert.match(article, /data-hu-reading-owner="browser-native"/);
  });

  it("canonical article title/body remain the visible reading source", () => {
    assert.match(article, /const titleForDisplay = post\.title/);
    assert.match(article, /const bodyHtml = post\.content/);
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.match(body, /dangerouslySetInnerHTML/);
  });

  it("canonical English reading declares an explicit content-language boundary", () => {
    assert.match(article, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(
      article,
      /className="blog-article__canonical-reading"[\s\S]*lang=\{DEFAULT_PLATFORM_LANGUAGE\}/,
    );
    assert.match(article, /data-hu-content-lang=\{DEFAULT_PLATFORM_LANGUAGE\}/);
    // Document presentation locale remains independent (useLocale still used for dates/chrome).
    assert.match(article, /useLocale\(\)/);
  });

  it("browser translation eligibility is not blocked by translate=no on the article body", () => {
    assert.doesNotMatch(article, /translate=["']no["']/);
    assert.doesNotMatch(body, /translate=["']no["']/);
    assert.doesNotMatch(article, /ProtectedAuthoritativeText/);
    assert.doesNotMatch(body, /ProtectedAuthoritativeText/);
  });

  it("Blog feed cards also use ordinary canonical reading", () => {
    const card = readFeatures("blog/components/BlogPostCard.tsx");
    assert.doesNotMatch(card, /resolveBlogPostPresentation/);
    assert.match(card, /DEFAULT_PLATFORM_LANGUAGE|data-hu-reading-owner="browser-native"/);
  });

  it("CT presentation infrastructure remains available outside ordinary article reading", () => {
    const resolver = readFeatures("blog/resolve-blog-post-presentation.ts");
    assert.match(resolver, /export async function resolveBlogPostPresentation/);
    assert.match(resolver, /sourceKind:\s*"blog_post"/);

    const seed = readFeatures("blog/load-blog-article-presentation-seed.ts");
    assert.match(seed, /resolveTranslatedContent/);
  });
});
