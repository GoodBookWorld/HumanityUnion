/**
 * Pack 08I.7 — Blog category display names + latest/authors presentation wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_CATEGORIES } from "@hu/types";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveBlogCategoryDisplayName } from "./resolve-blog-category-display-name.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

describe("Pack 08I.7 — Blog categories / cards / authors", () => {
  it("blogPublic.categories parity for seed categoryIds across locales", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const category of BLOG_CATEGORIES) {
        const key = `blogPublic.categories.${category.categoryId}.name`;
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("resolveBlogCategoryDisplayName accepts categoryId or slug", () => {
    const messages: Record<string, string> = {
      "categories.conscious_existence.name": "Свідоме існування",
      "categories.human_security.name": "Людська безпека",
      "categories.our_life.name": "Наше життя",
      "categories.human_potential.name": "Людський потенціал",
    };
    const t = Object.assign((key: string) => messages[key] ?? key, {
      has: (key: string) => key in messages,
    });

    assert.equal(resolveBlogCategoryDisplayName("conscious_existence", t), "Свідоме існування");
    assert.equal(resolveBlogCategoryDisplayName("conscious-existence", t), "Свідоме існування");
    assert.equal(resolveBlogCategoryDisplayName("human-security", t), "Людська безпека");
    assert.equal(resolveBlogCategoryDisplayName("human_potential", t), "Людський потенціал");
  });

  it("resolveBlogCategoryDisplayName prefers API name then humanized token for unknown ids", () => {
    const emptyT = Object.assign((key: string) => key, {
      has: () => false,
    });

    assert.equal(
      resolveBlogCategoryDisplayName("admin_created_topic", emptyT, "Civic Futures"),
      "Civic Futures",
    );
    assert.equal(
      resolveBlogCategoryDisplayName("admin_created_topic", emptyT),
      "Admin Created Topic",
    );
    assert.notEqual(
      resolveBlogCategoryDisplayName("human_potential", emptyT),
      "human_potential",
    );
  });

  it("human_potential catalog labels exist across locales", async () => {
    const expected: Record<string, string> = {
      en: "Human Potential",
      uk: "Людський потенціал",
      ar: "الإمكانات البشرية",
      "zh-Hant": "人類潛能",
    };
    for (const [locale, label] of Object.entries(expected)) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        readNested(loaded.messages, "blogPublic.categories.human_potential.name"),
        label,
        locale,
      );
    }
  });

  it("resolver has no locale-specific runtime branch", () => {
    const resolver = readWeb("features/blog/resolve-blog-category-display-name.ts");
    assert.doesNotMatch(resolver, /locale\s*===\s*["'](uk|ar|zh)/);
    assert.doesNotMatch(resolver, /switch\s*\(/);
    assert.doesNotMatch(resolver, /case\s+["']human_potential["']/);
  });

  it("sidebar / card / chart / article / latest / authors wire helpers", () => {
    const sidebar = readWeb("features/blog/components/BlogCategoriesSidebar.tsx");
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    const chart = readWeb("features/blog/components/BlogCategoryChart.tsx");
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");
    const authors = readWeb("features/blog/components/BlogAuthorsSidebar.tsx");

    assert.match(sidebar, /resolveBlogCategoryDisplayName/);
    assert.match(sidebar, /selectedCategory\.name/);
    assert.match(sidebar, /category\.name/);
    assert.match(card, /resolveBlogCategoryDisplayName/);
    assert.match(chart, /resolveBlogCategoryDisplayName/);
    assert.match(article, /resolveBlogCategoryDisplayName/);

    assert.match(latest, /resolveBlogPostPresentation/);
    assert.match(authors, /resolveBlogPostPresentation/);
    assert.match(authors, /entry\.author\.displayName/);
    assert.match(latest, /titleForDisplay/);
  });
});
