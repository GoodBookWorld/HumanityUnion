/**
 * Step 07D — Blog detail SEO metadata from compact blog_post CT.
 *
 * Deterministic: mocks resolve API; never calls TranslationProvider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

type ResolveFn = (input: {
  sourceKind: string;
  sourceRecordId: string;
  language?: string;
}) => Promise<{
  presentationMode: string;
  content: Record<string, string> | null;
  isStale?: boolean;
}>;

async function loadBlogFieldsWithMock(
  resolveTranslatedContent: ResolveFn,
  input: { postId: string; language: string },
): Promise<{ translatedTitle?: string; translatedDescription?: string }> {
  // Mirror load-blog-metadata-translation-fields.ts against an injectable resolve.
  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      language: input.language,
    });
    if (resolved.presentationMode === "original") {
      return {};
    }
    const content = resolved.content;
    if (!content || typeof content !== "object") {
      return {};
    }
    const title =
      typeof content.title === "string" && content.title.trim()
        ? content.title.trim()
        : undefined;
    const description =
      typeof content.excerpt === "string" && content.excerpt.trim()
        ? content.excerpt.trim()
        : undefined;
    return {
      ...(title ? { translatedTitle: title } : {}),
      ...(description ? { translatedDescription: description } : {}),
    };
  } catch {
    return {};
  }
}

describe("Step 07D — Blog SEO metadata from compact blog_post CT", () => {
  afterEach(() => {
    // no module mocks to reset
  });

  it("architecture: Blog metadata reads blog_post CT via GET resolve only", () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    assert.match(page, /loadBlogMetadataTranslationFields/);
    assert.match(page, /resolveLocalizedPublicMetadataCopy/);
    assert.match(page, /resolveDocumentHtmlLocale/);
    assert.match(page, /buildPublicPageMetadataForRequest/);
    assert.doesNotMatch(page, /generateContentTranslation/);

    const loader = readWeb("lib/seo/load-blog-metadata-translation-fields.ts");
    assert.match(loader, /sourceKind:\s*"blog_post"/);
    assert.match(loader, /sourceRecordId:\s*input\.postId/);
    assert.match(loader, /content\.excerpt/);
    assert.match(loader, /resolveTranslatedContent/);
    assert.doesNotMatch(loader, /generateContentTranslation|TranslationProvider/);
    assert.doesNotMatch(loader, /\b(uk|ar|zh-Hant|ka|he)\b/);
  });

  it("1. English/default Blog metadata remains unchanged when resolve returns original", async () => {
    const fields = await loadBlogFieldsWithMock(
      async () => ({ presentationMode: "original", content: null }),
      { postId: "post-1", language: "en" },
    );
    const localized = resolveLocalizedPublicMetadataCopy({
      title: "English Title",
      description: "English excerpt",
      locale: "en",
      translatedTitle: fields.translatedTitle,
      translatedDescription: fields.translatedDescription,
    });
    assert.equal(localized.title, "English Title");
    assert.equal(localized.description, "English excerpt");
    assert.equal(localized.usedTranslation, false);
  });

  it("2–3. SEO-prefixed locale with current CT uses localized title + excerpt", async () => {
    let resolveCalls = 0;
    const fields = await loadBlogFieldsWithMock(
      async (input) => {
        resolveCalls += 1;
        assert.equal(input.sourceKind, "blog_post");
        assert.equal(input.sourceRecordId, "post-uk");
        assert.equal(input.language, "uk");
        return {
          presentationMode: "preferred_translation",
          content: {
            title: "Український заголовок",
            excerpt: "Український уривок",
          },
        };
      },
      { postId: "post-uk", language: "uk" },
    );
    assert.equal(resolveCalls, 1);
    const localized = resolveLocalizedPublicMetadataCopy({
      title: "English Title",
      description: "English excerpt",
      locale: "uk",
      translatedTitle: fields.translatedTitle,
      translatedDescription: fields.translatedDescription,
    });
    assert.equal(localized.title, "Український заголовок");
    assert.equal(localized.description, "Український уривок");
    assert.equal(localized.usedTranslation, true);
  });

  it("4. Missing CT falls back to English", async () => {
    const fields = await loadBlogFieldsWithMock(
      async () => {
        throw new Error("not found");
      },
      { postId: "missing", language: "ar" },
    );
    const localized = resolveLocalizedPublicMetadataCopy({
      title: "EN Title",
      description: "EN excerpt",
      locale: "ar",
      ...fields,
    });
    assert.equal(localized.title, "EN Title");
    assert.equal(localized.description, "EN excerpt");
  });

  it("5. Stale / original presentation falls back to English", async () => {
    const fields = await loadBlogFieldsWithMock(
      async () => ({
        presentationMode: "original",
        content: { title: "Stale Title", excerpt: "Stale excerpt" },
        isStale: true,
      }),
      { postId: "stale", language: "uk" },
    );
    const localized = resolveLocalizedPublicMetadataCopy({
      title: "EN Title",
      description: "EN excerpt",
      locale: "uk",
      ...fields,
    });
    assert.equal(localized.title, "EN Title");
    assert.equal(localized.description, "EN excerpt");
  });

  it("6. Partial CT: title only → description falls back", async () => {
    const fields = await loadBlogFieldsWithMock(
      async () => ({
        presentationMode: "preferred_translation",
        content: { title: "Заголовок лише" },
      }),
      { postId: "partial", language: "uk" },
    );
    const localized = resolveLocalizedPublicMetadataCopy({
      title: "EN Title",
      description: "EN excerpt",
      locale: "uk",
      translatedTitle: fields.translatedTitle,
      translatedDescription: fields.translatedDescription,
    });
    assert.equal(localized.title, "Заголовок лише");
    assert.equal(localized.description, "EN excerpt");
  });

  it("7. Compact title/excerpt-only CT is sufficient (no content required)", async () => {
    const fields = await loadBlogFieldsWithMock(
      async () => ({
        presentationMode: "preferred_translation",
        content: {
          title: "Compact Title",
          excerpt: "Compact Excerpt",
        },
      }),
      { postId: "compact", language: "xx-SEOFUT" },
    );
    assert.equal(fields.translatedTitle, "Compact Title");
    assert.equal(fields.translatedDescription, "Compact Excerpt");
    assert.equal(
      (
        await loadBlogFieldsWithMock(
          async () => ({
            presentationMode: "preferred_translation",
            content: {
              title: "T",
              excerpt: "E",
              // body intentionally absent
            },
          }),
          { postId: "compact2", language: "xx-SEOFUT" },
        )
      ).translatedDescription,
      "E",
    );
  });

  it("8. No provider call — loader only uses resolveTranslatedContent path", () => {
    const loader = readWeb("lib/seo/load-blog-metadata-translation-fields.ts");
    assert.match(loader, /resolveTranslatedContent/);
    assert.doesNotMatch(loader, /generateContentTranslation|TRANSLATION_PROVIDER/);
    const page = readWeb("app/blog/[slug]/page.tsx");
    assert.doesNotMatch(page, /generateContentTranslation/);
  });

  it("9–10. Canonical/hreflang remain request-aware (07C); CT does not invent paths", async () => {
    const catalog = [
      {
        languageId: "lang-en",
        locale: "en",
        textDirection: "ltr" as const,
        aliases: [] as string[],
        enabled: true,
        seoIndexingEnabled: true,
      },
      {
        languageId: "lang-uk",
        locale: "uk",
        textDirection: "ltr" as const,
        aliases: [] as string[],
        enabled: true,
        seoIndexingEnabled: true,
      },
    ];
    const meta = await buildPublicPageMetadataForRequest({
      title: "Український заголовок",
      description: "Український уривок",
      titleBrandSuffix: "Blog | Humanity Union",
      canonicalPath: "/blog/hello",
      localeFreeCanonicalPath: "/blog/hello",
      catalog,
      pathname: "/uk/blog/hello",
      urlLocaleSegment: "uk",
    });
    assert.equal(meta.alternates?.canonical, "/uk/blog/hello");
    assert.equal(
      (meta.alternates as { languages?: Record<string, string> }).languages?.[
        "x-default"
      ],
      "/blog/hello",
    );
    assert.match(String(meta.title), /Український заголовок/);
  });

  it("11–12. Synthetic future locale works; no locale hardcoding in loader/page", async () => {
    const fields = await loadBlogFieldsWithMock(
      async (input) => {
        assert.equal(input.language, "xx-SEOFUT");
        return {
          presentationMode: "preferred_translation",
          content: { title: "Future Title", excerpt: "Future Excerpt" },
        };
      },
      { postId: "future", language: "xx-SEOFUT" },
    );
    assert.equal(fields.translatedTitle, "Future Title");
    const loader = readWeb("lib/seo/load-blog-metadata-translation-fields.ts");
    const page = readWeb("app/blog/[slug]/page.tsx");
    for (const locale of ["uk", "ar", "zh-Hant", "ka", "he"]) {
      assert.doesNotMatch(loader, new RegExp(`["']${locale}["']`));
      assert.doesNotMatch(page, new RegExp(`language:\\s*["']${locale}["']`));
    }
  });
});
