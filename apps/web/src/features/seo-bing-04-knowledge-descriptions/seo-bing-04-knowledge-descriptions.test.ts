/**
 * SEO-BING-04 — Knowledge article meta descriptions are built from the
 * existing editorial `purpose` + `overview`, capped at 200 characters on a
 * word boundary, with Admin SEO overrides still taking priority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { SeoPageOverrideFields } from "@hu/types";

import { applyPageSeoOverrideToMetadataInput } from "../../lib/seo/apply-page-seo-override.js";
import {
  buildPublicPageMetadata,
  type BuildPublicPageMetadataInput,
} from "../../lib/seo/build-public-page-metadata.js";
import { normalizeMetaDescription } from "../../lib/seo/normalize-seo-text.js";
import { buildWebPageJsonLd } from "../../lib/seo/structured-data/index.js";
import {
  KNOWLEDGE_ARTICLE_META_DESCRIPTION_MAX,
  buildKnowledgeArticleMetaDescription,
  truncateAtWordBoundary,
} from "../knowledge-center/knowledge-article-meta-description.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const PAGE = readFileSync(path.join(webSrc, "app/knowledge/[slug]/page.tsx"), "utf8");
const CATALOG_MODULE = path.join(
  repoRoot,
  "apps/api/src/modules/knowledge-center/content/index.ts",
);

interface CatalogArticle {
  readonly slug: string;
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

function collapse(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Mirrors the page's automatic metadata input (wiring asserted in test 7). */
function knowledgeMetadataInput(
  article: CatalogArticle,
  override?: SeoPageOverrideFields | null,
): BuildPublicPageMetadataInput {
  const description = buildKnowledgeArticleMetaDescription(article);
  return applyPageSeoOverrideToMetadataInput(
    {
      title: article.title,
      description,
      canonicalPath: `/knowledge/${encodeURIComponent(article.slug)}`,
      socialTitle: article.title,
      socialDescription: description,
      openGraphType: "website",
    },
    override,
  );
}

const SAMPLE: CatalogArticle = {
  slug: "public-impact",
  title: "Public impact",
  purpose: "What is public impact?",
  overview: "Public impact summarizes observed outcomes linked to civic work, with evidence.",
};

describe("SEO-BING-04 — Knowledge meta descriptions", () => {
  it("1. all 59 catalog articles get 70–200 character unique descriptions", () => {
    assert.equal(catalog.length, 59);
    const descriptions = catalog.map((article) => buildKnowledgeArticleMetaDescription(article));

    for (const [index, description] of descriptions.entries()) {
      const article = catalog[index]!;
      assert.ok(
        description.length >= 70 && description.length <= KNOWLEDGE_ARTICLE_META_DESCRIPTION_MAX,
        `${article.slug}: ${description.length} chars`,
      );
      assert.ok(
        description.startsWith(collapse(article.purpose)),
        `${article.slug} starts with purpose`,
      );
      assert.equal(
        normalizeMetaDescription(description),
        description,
        `${article.slug} not re-cut`,
      );
    }
    assert.equal(new Set(descriptions).size, descriptions.length, "no duplicates");
  });

  it("2. descriptions are verbatim editorial text and never cut mid-word", () => {
    let truncated = 0;
    for (const article of catalog) {
      const combined = collapse(`${article.purpose} ${article.overview}`);
      const description = buildKnowledgeArticleMetaDescription(article);
      if (!description.endsWith("…")) {
        assert.equal(description, combined, `${article.slug} is purpose + overview`);
        continue;
      }
      truncated += 1;
      const kept = description.slice(0, -1);
      assert.ok(combined.startsWith(kept), `${article.slug} keeps an editorial prefix`);
      assert.match(combined.charAt(kept.length), /[\s,;:.—–-]/u, `${article.slug} ends on a word`);
    }
    assert.equal(truncated, 3);
  });

  it("3. the previously short purposes (<50) now all exceed 70 characters", () => {
    const formerlyShort = catalog.filter((article) => collapse(article.purpose).length < 50);
    assert.equal(formerlyShort.length, 47);
    for (const article of formerlyShort) {
      assert.ok(buildKnowledgeArticleMetaDescription(article).length >= 70, article.slug);
    }
  });

  it("4. word-boundary truncation keeps whole words, Unicode and the 200 limit", () => {
    const words = Array.from({ length: 60 }, (_, i) => `слово${i}🌍`);
    const text = words.join(" ");
    const cut = truncateAtWordBoundary(text);
    assert.ok(cut.length <= 200);
    assert.ok(cut.endsWith("…"));
    const keptWords = cut.slice(0, -1).split(" ");
    assert.deepEqual(keptWords, words.slice(0, keptWords.length));
    assert.equal(truncateAtWordBoundary("short text"), "short text");
    assert.equal(truncateAtWordBoundary("x".repeat(250)), "");
    assert.equal(truncateAtWordBoundary(`${"a ".repeat(98)}bb, cc dd`, 200).endsWith("bb…"), true);
  });

  it("5. empty overview uses purpose; empty purpose keeps the title fallback", () => {
    assert.equal(
      buildKnowledgeArticleMetaDescription({ ...SAMPLE, overview: "  \n " }),
      "What is public impact?",
    );
    assert.equal(
      buildKnowledgeArticleMetaDescription({ ...SAMPLE, purpose: "  " }),
      "Public impact — Knowledge on Humanity Union",
    );
    assert.equal(
      buildKnowledgeArticleMetaDescription({
        ...SAMPLE,
        purpose: " What is\n public impact? ",
        overview: " Outcomes\tmatter. ",
      }),
      "What is public impact? Outcomes matter.",
    );
  });

  it("6. metadata: OG/Twitter match, overrides keep priority, title/canonical unchanged", () => {
    const article = catalog.find((entry) => entry.slug === "public-impact") ?? SAMPLE;
    const automatic = buildKnowledgeArticleMetaDescription(article);

    const plain = buildPublicPageMetadata(knowledgeMetadataInput(article));
    assert.equal(plain.description, automatic);
    assert.equal(plain.openGraph?.description, automatic);
    assert.equal(plain.twitter?.description, automatic);
    assert.equal(plain.title, `${article.title} | Humanity Union`);
    assert.equal(plain.alternates?.canonical, `https://huws.org/knowledge/${article.slug}`);

    const seoOnly = buildPublicPageMetadata(
      knowledgeMetadataInput(article, {
        seoDescription: "Admin description wins.",
      } as SeoPageOverrideFields),
    );
    assert.equal(seoOnly.description, "Admin description wins.");
    assert.equal(seoOnly.openGraph?.description, automatic, "existing social fallback unchanged");

    const social = buildPublicPageMetadata(
      knowledgeMetadataInput(article, {
        seoDescription: "Admin description wins.",
        socialDescription: "Admin social text.",
        seoTitle: "Admin title",
      } as SeoPageOverrideFields),
    );
    assert.equal(social.description, "Admin description wins.");
    assert.equal(social.openGraph?.description, "Admin social text.");
    assert.equal(social.twitter?.description, "Admin social text.");
    assert.equal(social.title, "Admin title | Humanity Union");
    assert.equal(social.alternates?.canonical, `https://huws.org/knowledge/${article.slug}`);
  });

  it("7. JSON-LD uses the same description and the page wiring is unchanged otherwise", () => {
    const article = catalog.find((entry) => entry.slug === "platform-overview") ?? SAMPLE;
    const description = buildKnowledgeArticleMetaDescription(article);
    const nodes = buildWebPageJsonLd(
      { name: article.title, description, canonicalPath: `/knowledge/${article.slug}` },
      "https://huws.org",
    );
    const webPage = nodes?.find((node) => node["@type"] === "WebPage");
    assert.equal(webPage?.description, description);

    assert.equal((PAGE.match(/buildKnowledgeArticleMetaDescription\(article\)/g) ?? []).length, 2);
    assert.equal(PAGE.includes("article.purpose?.trim() ||"), false);
    assert.match(
      PAGE,
      /title: article\.title,\s*description,\s*canonicalPath: localeFreeCanonicalPath,/,
    );
    assert.match(PAGE, /socialTitle: article\.title,\s*socialDescription: description,/);
    assert.match(PAGE, /applyPageSeoOverrideToMetadataInput\(/);
    assert.match(PAGE, /override\?\.fields\.seoDescription\?\.trim\(\) \|\| description/);
    assert.match(PAGE, /description: effectiveDescription,/);
  });
});
