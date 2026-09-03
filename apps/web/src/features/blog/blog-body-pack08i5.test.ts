/**
 * Pack 08I.5 — Blog body HTML translation presentation + safety contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveBlogPostPresentation } from "./resolve-blog-post-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(repoRoot, "apps/api/src", relative), "utf8");
}

describe("Pack 08I.5 — Blog body translation presentation", () => {
  it("detail and list use shared Blog presentation resolver", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    const resolver = readWeb("features/blog/resolve-blog-post-presentation.ts");

    assert.match(article, /resolveBlogPostPresentation/);
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.doesNotMatch(article, /EXPECTED_FALLBACK/);
    assert.match(card, /resolveBlogPostPresentation/);
    assert.match(card, /displayExcerpt/);
    assert.match(resolver, /sourceKind: "blog_post"/);
    assert.match(resolver, /contentHtml/);
    assert.match(resolver, /canonical/);
  });

  it("EXISTING current Blog HTML translation → presentation contentHtml (no generate)", async () => {
    const translatedHtml =
      '<p>Український <a href="https://example.com">абзац</a> зі збереженими тегами</p>';
    const presented = await resolveBlogPostPresentation(
      {
        postId: "blog-fixture-1",
        canonical: {
          title: "English title",
          excerpt: "English excerpt",
          contentHtml: "<p>English <a href=\"https://example.com\">paragraph</a></p>",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: {
            title: "Українська назва",
            excerpt: "Український уривок",
            content: translatedHtml,
          },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: {},
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("must not generate when translation exists");
        },
      },
    );

    assert.equal(presented.presentationMode, "translated");
    assert.equal(presented.title, "Українська назва");
    assert.equal(presented.contentHtml, translatedHtml);
    assert.match(presented.contentHtml, /<a href="https:\/\/example\.com">/);
    assert.match(presented.contentHtml, /абзац/);

    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.match(article, /setDisplayContentHtml\(presentation\.contentHtml\)/);
  });

  it("API loads sanitized HTML content for blog_post and re-sanitizes after provider", () => {
    const service = readApi("modules/language/content-translation.service.ts");
    assert.match(service, /sanitizeBlogHtml\(post\.content\)/);
    assert.doesNotMatch(service, /blogHtmlToPlainText\(post\.content\)/);
    assert.match(service, /source\.sourceKind === "blog_post"/);
    assert.match(service, /sanitizeBlogHtml\(translatedFields\.content\)/);
  });

  it("Gemini structured instruction preserves HTML markup/URLs/attributes", () => {
    const gemini = readApi("modules/language/providers/gemini-translation-provider.ts");
    assert.match(gemini, /translate only participant-facing text nodes/i);
    assert.match(gemini, /Do not translate, rename, invent, or remove HTML tags/);
    assert.match(gemini, /Preserve link URLs/);
  });

  it("deterministic provider translates HTML text nodes without rewriting tags", () => {
    const provider = readApi("modules/language/providers/deterministic-translation-provider.ts");
    assert.match(provider, /HTML-looking strings/);
    assert.match(provider, /translate text nodes only/);
  });

  it("blog_post remains on content_translations allowlist including content", () => {
    const eligibility = readApi("modules/language/content-translation-eligibility.ts");
    assert.match(eligibility, /blog_post:\s*\[["']title["'],\s*["']excerpt["'],\s*["']content["']\]/);
  });
});
