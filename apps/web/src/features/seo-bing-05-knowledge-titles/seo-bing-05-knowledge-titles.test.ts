/**
 * SEO-BING-05 — glossary Knowledge articles get a "— Glossary" document title
 * qualifier so they no longer duplicate their concept articles. Everything
 * else (H1, social titles, JSON-LD name, description, canonical) is unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { KnowledgeCategoryId, SeoPageOverrideFields } from "@hu/types";

import { applyPageSeoOverrideToMetadataInput } from "../../lib/seo/apply-page-seo-override.js";
import {
  buildPublicPageMetadata,
  type BuildPublicPageMetadataInput,
} from "../../lib/seo/build-public-page-metadata.js";
import { formatPublicPageTitle } from "../../lib/seo/normalize-seo-text.js";
import { buildKnowledgeArticleMetaDescription } from "../knowledge-center/knowledge-article-meta-description.js";
import { buildKnowledgeArticleSeoTitle } from "../knowledge-center/knowledge-article-seo-title.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const PAGE = readFileSync(path.join(webSrc, "app/knowledge/[slug]/page.tsx"), "utf8");
const ARTICLE_CONTENT = readFileSync(
  path.join(webSrc, "features/knowledge-center/components/KnowledgeArticlePageContent.tsx"),
  "utf8",
);
const CATALOG_MODULE = path.join(
  repoRoot,
  "apps/api/src/modules/knowledge-center/content/index.ts",
);

interface CatalogArticle {
  readonly slug: string;
  readonly categoryId: KnowledgeCategoryId;
  readonly title: string;
  readonly purpose: string;
  readonly overview: string;
}

let catalog: readonly CatalogArticle[] = [];
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

before(async () => {
  const mod = (await import(pathToFileURL(CATALOG_MODULE).href)) as {
    ALL_KNOWLEDGE_ARTICLES: readonly CatalogArticle[];
  };
  catalog = mod.ALL_KNOWLEDGE_ARTICLES;
  process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
});

after(() => {
  if (previousSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  }
});

/** Mirrors the page's automatic metadata input (wiring asserted in test 6). */
function knowledgeMetadataInput(
  article: CatalogArticle,
  title: string,
  override?: SeoPageOverrideFields | null,
): BuildPublicPageMetadataInput {
  const description = buildKnowledgeArticleMetaDescription(article);
  return applyPageSeoOverrideToMetadataInput(
    {
      title,
      description,
      canonicalPath: `/knowledge/${encodeURIComponent(article.slug)}`,
      socialTitle: article.title,
      socialDescription: description,
      openGraphType: "website",
    },
    override,
  );
}

describe("SEO-BING-05 — Knowledge document titles", () => {
  it("1. all 59 catalog articles have unique document titles", () => {
    assert.equal(catalog.length, 59);
    const titles = catalog.map((article) =>
      formatPublicPageTitle(buildKnowledgeArticleSeoTitle(article)),
    );
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    assert.deepEqual(duplicates, []);
  });

  it("2. all 12 glossary articles get the qualifier; other categories keep their titles", () => {
    const glossary = catalog.filter((article) => article.categoryId === "glossary");
    assert.equal(glossary.length, 12);
    for (const article of glossary) {
      assert.equal(buildKnowledgeArticleSeoTitle(article), `${article.title} — Glossary`);
      assert.equal(
        formatPublicPageTitle(buildKnowledgeArticleSeoTitle(article)),
        `${article.title} — Glossary | Humanity Union`,
      );
    }
    for (const article of catalog.filter((entry) => entry.categoryId !== "glossary")) {
      assert.equal(buildKnowledgeArticleSeoTitle(article), article.title, article.slug);
    }
  });

  it("3. no double qualifier and no malformed titles from empty values", () => {
    const glossary = (title: string) =>
      buildKnowledgeArticleSeoTitle({ title, categoryId: "glossary" });
    assert.equal(glossary("Steward — Glossary"), "Steward — Glossary");
    assert.equal(glossary("Steward - glossary"), "Steward - glossary");
    assert.equal(glossary("Steward (Glossary)"), "Steward (Glossary)");
    assert.equal(glossary("  Decision\n Session  "), "Decision Session — Glossary");
    assert.equal(glossary(""), "");
    assert.equal(glossary("   "), "");
    assert.equal(formatPublicPageTitle(glossary("   ")), "Humanity Union");
    assert.equal(
      buildKnowledgeArticleSeoTitle({ title: " Spaced ", categoryId: "explanations" }),
      " Spaced ",
    );
  });

  it("4. only the document title changes: social, description, canonical and robots stay", () => {
    const article = catalog.find((entry) => entry.slug === "decision-session-glossary")!;
    const before = buildPublicPageMetadata(knowledgeMetadataInput(article, article.title));
    const after = buildPublicPageMetadata(
      knowledgeMetadataInput(article, buildKnowledgeArticleSeoTitle(article)),
    );

    assert.equal(after.title, "Decision Session — Glossary | Humanity Union");
    assert.equal(before.title, "Decision Session | Humanity Union");
    assert.equal(after.openGraph?.title, "Decision Session");
    assert.equal(after.twitter?.title, "Decision Session");
    assert.deepEqual({ ...after, title: undefined }, { ...before, title: undefined });
  });

  it("5. Admin seoTitle and socialTitle overrides keep priority", () => {
    const article = catalog.find((entry) => entry.slug === "public-impact-glossary")!;
    const automatic = buildKnowledgeArticleSeoTitle(article);

    const seoOnly = buildPublicPageMetadata(
      knowledgeMetadataInput(article, automatic, {
        seoTitle: "Admin glossary title",
      } as SeoPageOverrideFields),
    );
    assert.equal(seoOnly.title, "Admin glossary title | Humanity Union");
    assert.equal(seoOnly.openGraph?.title, "Public Impact");

    const social = buildPublicPageMetadata(
      knowledgeMetadataInput(article, automatic, {
        seoTitle: "Admin glossary title",
        socialTitle: "Admin social title",
      } as SeoPageOverrideFields),
    );
    assert.equal(social.title, "Admin glossary title | Humanity Union");
    assert.equal(social.openGraph?.title, "Admin social title");
    assert.equal(social.twitter?.title, "Admin social title");
  });

  it("6. page wiring: helper used only for the automatic document title", () => {
    assert.equal((PAGE.match(/buildKnowledgeArticleSeoTitle\(/g) ?? []).length, 1);
    assert.match(PAGE, /title: buildKnowledgeArticleSeoTitle\(article\),\s*description,/);
    assert.match(PAGE, /socialTitle: article\.title,/);
    assert.match(
      PAGE,
      /const effectiveTitle = override\?\.fields\.seoTitle\?\.trim\(\) \|\| article\.title;/,
    );
    assert.match(PAGE, /name: effectiveTitle,/);
    assert.equal(ARTICLE_CONTENT.includes("buildKnowledgeArticleSeoTitle"), false, "H1 unchanged");
  });
});
