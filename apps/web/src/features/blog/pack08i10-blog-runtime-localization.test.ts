/**
 * Pack 08I.10 — Blog runtime localization integrity + SSR-first closeout.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { looksLikeRawI18nKey } from "../public-initiative-experience/normalize-initiative-status-code.js";
import { resolveBlogCategoryDisplayName } from "./resolve-blog-category-display-name.js";
import { resolveBlogPostPresentation } from "./resolve-blog-post-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const UK_TITLE = "Українська назва публікації";
const UK_EXCERPT = "Український уривок публікації";
const UK_HTML =
  '<p class="lead" data-section="intro">Український <a href="https://example.com/path">абзац</a> тіла</p>';
const EN_TITLE = "Canonical English Blog Title";
const EN_EXCERPT = "Canonical English Blog Excerpt";
const EN_HTML =
  '<p class="lead" data-section="intro">Canonical English <a href="https://example.com/path">paragraph</a></p>';

async function ukPresentationFixture() {
  return resolveBlogPostPresentation(
    {
      postId: "blog-08i10-fixture",
      canonical: {
        title: EN_TITLE,
        excerpt: EN_EXCERPT,
        contentHtml: EN_HTML,
      },
      readingContext: {
        ready: true,
        readingLanguage: "uk",
        translationPreference: "preferred",
      },
    },
    {
      resolveTranslatedContent: async () => ({
        presentationMode: "preferred_translation" as const,
        content: {
          title: UK_TITLE,
          excerpt: UK_EXCERPT,
          content: UK_HTML,
        },
        activeLanguage: "uk" as const,
        originalLanguage: "en" as const,
        originalContent: {
          title: EN_TITLE,
          excerpt: EN_EXCERPT,
          content: EN_HTML,
        },
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
}

describe("Pack 08I.10 — Authors / cards / latest mini", () => {
  it("authors list chrome is catalog-driven; author name stays raw identity", () => {
    const authors = readWeb("features/blog/components/BlogAuthorsSidebar.tsx");
    assert.match(authors, /blog-authors-list/);
    assert.match(authors, /blogPublic\.discovery\.authors|useTranslations\("blogPublic\.discovery\.authors"\)/);
    assert.match(authors, /t\("heading"\)/);
    assert.match(authors, /t\("latestLabel"\)/);
    assert.match(authors, /t\("empty"\)/);
    assert.match(authors, /entry\.author\.displayName/);
    assert.match(authors, /resolveBlogPostPresentation/);
    assert.doesNotMatch(authors, /AuthorLatestPublicationTitle[\s\S]*post\.title/);
  });

  it("EXISTING UK translation → post card presentation title/excerpt (BLOG_POST_CARD_TRANSLATION_BYPASS=0)", async () => {
    const presented = await ukPresentationFixture();
    assert.equal(presented.title, UK_TITLE);
    assert.equal(presented.excerpt, UK_EXCERPT);
    assert.notEqual(presented.title, EN_TITLE);

    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    assert.match(card, /blog-post-card__content/);
    assert.match(card, /resolveBlogPostPresentation/);
    assert.match(card, /displayTitle/);
    assert.match(card, /displayExcerpt/);
    assert.match(card, /titleForDisplay/);
    assert.match(card, /resolveBlogCategoryDisplayName/);
    assert.match(card, /formatBlogPublishedDate\(post\.publishedAt, locale\)/);
  });

  it("EXISTING UK translation → latest mini uses same resolver + locale dates", async () => {
    const presented = await ukPresentationFixture();
    assert.equal(presented.title, UK_TITLE);

    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");
    assert.match(latest, /blog-latest-mini__list/);
    assert.match(latest, /blog-latest-mini__body/);
    assert.match(latest, /resolveBlogPostPresentation/);
    assert.match(latest, /resolveBlogCategoryDisplayName/);
    assert.match(latest, /useLocale/);
    assert.match(latest, /formatBlogPublishedDate\(post\.publishedAt, locale\)/);
    assert.doesNotMatch(latest, /formatBlogPublishedDate\(post\.publishedAt\)\s*</);
  });
});

describe("Pack 08I.10 — Category / article meta / body", () => {
  it("one shared category presenter on cards, mini, article, sidebar, chart", () => {
    for (const file of [
      "features/blog/components/BlogPostCard.tsx",
      "features/blog/components/BlogLatestMiniCards.tsx",
      "features/blog/components/BlogArticlePageContent.tsx",
      "features/blog/components/BlogCategoriesSidebar.tsx",
      "features/blog/components/BlogCategoryChart.tsx",
    ]) {
      assert.match(readWeb(file), /resolveBlogCategoryDisplayName/, file);
    }
  });

  it("article meta uses catalogs + locale-aware dates", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /blog-article__meta/);
    assert.match(article, /article\.authorLabel/);
    assert.match(article, /article\.publishedLabel/);
    assert.match(article, /article\.categoryLabel/);
    assert.match(article, /formatBlogPublishedDate\(post\.publishedAt, locale\)/);
    assert.match(article, /resolveBlogCategoryDisplayName/);
  });

  it("EXISTING UK HTML reaches article body prop chain (BLOG_ARTICLE_BODY_TRANSLATION_BYPASS=0)", async () => {
    const presented = await ukPresentationFixture();
    assert.equal(presented.contentHtml, UK_HTML);
    assert.match(presented.contentHtml, /Український/);
    assert.match(presented.contentHtml, /href="https:\/\/example\.com\/path"/);
    assert.match(presented.contentHtml, /class="lead"/);
    assert.match(presented.contentHtml, /data-section="intro"/);
    assert.doesNotMatch(presented.contentHtml, /Canonical English/);

    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const body = readWeb("features/blog/components/BlogArticleBody.tsx");
    assert.match(article, /BlogArticleBody html=\{bodyHtml\}/);
    assert.match(article, /displayContentHtml/);
    assert.match(article, /initialPresentation\?\.contentHtml/);
    assert.match(body, /blog-article-body hu-prose/);
    assert.match(body, /dangerouslySetInnerHTML/);
    // Body is presentation-owned; does not fetch post.content itself.
    assert.doesNotMatch(body, /post\.content/);
  });

  it("authenticated explicit none stays canonical in presentation resolver", async () => {
    const presented = await resolveBlogPostPresentation({
      postId: "blog-none",
      canonical: {
        title: EN_TITLE,
        excerpt: EN_EXCERPT,
        contentHtml: EN_HTML,
      },
      readingContext: {
        ready: true,
        readingLanguage: "uk",
        translationPreference: "none",
      },
    });
    assert.equal(presented.presentationMode, "original");
    assert.equal(presented.title, EN_TITLE);
    assert.equal(presented.contentHtml, EN_HTML);
  });
});

describe("Pack 08I.10 — SSR seed + locale + raw keys", () => {
  it("SSR seed + hydration guard + auth none policy wiring", () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    const seed = readWeb("features/blog/load-blog-article-presentation-seed.ts");
    const policy = readWeb("features/blog/resolve-blog-server-seed-reading-policy.ts");
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const index = readWeb("app/blog/page.tsx");

    assert.match(page, /resolveBlogServerSeedReadingPolicy/);
    assert.match(page, /preferTranslation/);
    assert.match(page, /loadBlogArticlePresentationSeed/);
    assert.match(seed, /preferTranslation === false/);
    assert.match(seed, /resolveTranslatedContent/);
    assert.doesNotMatch(seed, /generateContentTranslation/);
    assert.match(policy, /translationPreference/);
    assert.match(policy, /preferTranslation: false/);
    assert.match(article, /initialPresentation/);
    assert.match(article, /keep SSR seed|!initialPresentation/);
    assert.match(index, /getTranslations\("blogPublic"\)/);
    assert.doesNotMatch(index, /Loading Blog…/);
  });

  it("zh-TW alias + four-language author chrome catalogs", async () => {
    const registry = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/language-registry.ts"),
      "utf8",
    );
    assert.match(registry, /zh-TW/);

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const blog = (messages as Record<string, unknown>).blogPublic as Record<string, unknown>;
      const discovery = blog.discovery as Record<string, unknown>;
      const authors = discovery.authors as Record<string, string>;
      assert.ok(authors.heading?.trim());
      assert.ok(authors.latestLabel?.trim());
      assert.equal(looksLikeRawI18nKey(authors.heading ?? ""), false);
    }
  });

  it("category taxonomy resolves across locales without raw keys", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const blog = (messages as Record<string, unknown>).blogPublic as Record<string, unknown>;
      const categories = blog.categories as Record<string, { name?: string }>;
      const flat: Record<string, string> = {};
      for (const [id, value] of Object.entries(categories ?? {})) {
        if (value?.name) {
          flat[`categories.${id}.name`] = value.name;
        }
      }
      const t = Object.assign((key: string) => flat[key] ?? key, {
        has: (key: string) => key in flat,
      });
      const label = resolveBlogCategoryDisplayName("conscious_existence", t);
      assert.ok(label.trim());
      assert.equal(looksLikeRawI18nKey(label), false);
      assert.doesNotMatch(label, /blogPublic\./);
    }
  });

  it("RTL-safe min-width / wrap present on authors, cards, mini, prose", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /blog-latest-mini__body[\s\S]*min-width:\s*0/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /blog-article-body/);
  });
});
