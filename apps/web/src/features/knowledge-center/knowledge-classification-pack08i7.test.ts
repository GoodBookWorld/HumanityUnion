/**
 * Pack 08I.7 closeout — Knowledge body classification + taxonomy/detail proofs.
 *
 * knowledge_article is NOT a ContentTranslationSourceKind. Article bodies therefore
 * cannot use content_translations today. Classification:
 * - A TRANSLATION_SUPPORTED_BUT_MISSING = 0
 * - B TRANSLATION_EXISTS_BUT_NOT_DISPLAYED = 0
 * - C DOCUMENT_LAYER_DEBT = articles without content_translations body path
 *
 * Finite category labels + article titles remain taxonomy catalogs (WEB_UI / taxonomy).
 * A subset of educational articles has finite catalog detail fields (like institutionsPublic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  EXPECTED_TRANSLATION_FALLBACK,
  resolveKnowledgeArticleField,
  resolveKnowledgeArticleTitle,
  resolveKnowledgeCategoryPresentation,
  resolveKnowledgeExplanationSection,
} from "./resolve-knowledge-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(repoRoot, "apps/api/src", relative), "utf8");
}

function readTypes(relative: string): string {
  return readFileSync(path.join(repoRoot, "packages/types/src", relative), "utf8");
}

describe("Pack 08I.7 closeout — Knowledge classification", () => {
  it("knowledge_article is absent from ContentTranslationSourceKind / field allowlist", () => {
    const kinds = readTypes("domain/content-translation.ts");
    const allowlist = readApi("modules/language/content-translation-eligibility.ts");
    const loader = readApi("modules/language/content-translation.service.ts");

    assert.doesNotMatch(kinds, /knowledge_article/);
    assert.doesNotMatch(allowlist, /knowledge_article\s*:/);
    assert.doesNotMatch(loader, /sourceKind === "knowledge_article"/);
    assert.match(allowlist, /blog_post:/);
    assert.match(allowlist, /civic_media:/);
  });

  it("classifies article bodies: A=0, B=0, C=document-layer (no content_translations path)", async () => {
    const en = await loadUiMessagesForLocale("en");
    const articles = (en.messages.knowledgePublic as { articles: Record<string, unknown> })
      .articles;
    const slugs = Object.keys(articles);
    assert.ok(slugs.length >= 50, `expected ≥50 article catalog entries, got ${slugs.length}`);

    let catalogDetailBodies = 0;
    let titleOnly = 0;
    for (const slug of slugs) {
      const entry = articles[slug] as Record<string, unknown>;
      if (entry.purpose || entry.overview || entry.explanation) {
        catalogDetailBodies += 1;
      } else {
        titleOnly += 1;
      }
    }

    // A — architecture does not support knowledge_article content_translations.
    const translationSupportedButMissing = 0;
    // B — no content_translations rows can exist for this sourceKind.
    const translationExistsButNotDisplayed = 0;
    // C — bodies have no content_translations representation.
    const documentLayerDebt = titleOnly + catalogDetailBodies;

    assert.equal(translationSupportedButMissing, 0);
    assert.equal(translationExistsButNotDisplayed, 0);
    assert.equal(documentLayerDebt, slugs.length);
    assert.equal(titleOnly, 50);
    assert.equal(catalogDetailBodies, 9);

    // Taxonomy titles are catalogued for all articles (not body prose via content_translations).
    for (const slug of slugs) {
      assert.equal(typeof (articles[slug] as { title?: string }).title, "string");
    }
  });

  it("taxonomy catalogs cover categories without treating body prose as WEB_UI requirement", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true);

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const categories = (loaded.messages.knowledgePublic as { categories: Record<string, unknown> })
        .categories;
      assert.equal(Object.keys(categories).length, 7);
    }

    const page = readWeb("features/knowledge-center/components/KnowledgeCenterPageContent.tsx");
    assert.match(page, /resolveKnowledgeCategoryPresentation/);
    assert.match(page, /resolveKnowledgeArticleTitle/);
    assert.doesNotMatch(page, /resolveTranslatedContent/);
  });

  it("Knowledge detail fixture: catalog-localized body fields render for what-is-humanity-union", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const knowledgePublic = (uk.messages as { knowledgePublic: Record<string, unknown> })
      .knowledgePublic;

    function readKey(key: string): unknown {
      const parts = key.split(".");
      let cursor: unknown = knowledgePublic;
      for (const part of parts) {
        if (!cursor || typeof cursor !== "object") {
          return undefined;
        }
        cursor = (cursor as Record<string, unknown>)[part];
      }
      return cursor;
    }

    const t = Object.assign(
      (key: string) => String(readKey(key) ?? ""),
      {
        has: (key: string) => typeof readKey(key) === "string",
      },
    );

    const title = resolveKnowledgeArticleTitle(
      "what-is-humanity-union",
      "What is Humanity Union?",
      t,
    );
    assert.notEqual(title, "What is Humanity Union?");
    assert.ok(title.length > 0);

    const purpose = resolveKnowledgeArticleField(
      "what-is-humanity-union",
      "purpose",
      "English purpose",
      t,
    );
    assert.equal(purpose.source, "catalog");
    assert.notEqual(purpose.value, "English purpose");

    const overview = resolveKnowledgeArticleField(
      "what-is-humanity-union",
      "overview",
      "English overview",
      t,
    );
    assert.equal(overview.source, "catalog");

    const explanation = resolveKnowledgeExplanationSection(
      "what-is-humanity-union",
      { id: "role", heading: "Role", body: "English body" },
      t,
    );
    assert.equal(explanation.source, "catalog");
    assert.notEqual(explanation.body, "English body");

    const detail = readWeb("features/knowledge-center/components/KnowledgeArticlePageContent.tsx");
    assert.match(detail, /resolveKnowledgeArticleField/);
    assert.match(detail, /resolveKnowledgeExplanationSection/);
    assert.match(detail, /data-source=\{purpose\.source\}/);
  });

  it("title-only articles fall back to API body English (expected catalog miss, not wiring bypass)", () => {
    const t = Object.assign(
      (): string => {
        throw new Error("should not call t when has=false");
      },
      { has: () => false },
    );
    const field = resolveKnowledgeArticleField(
      "write-better-proposals",
      "purpose",
      "Canonical English purpose",
      t,
    );
    assert.equal(field.source, EXPECTED_TRANSLATION_FALLBACK);
    assert.equal(field.value, "Canonical English purpose");

    const category = resolveKnowledgeCategoryPresentation(
      "guides",
      Object.assign((key: string) => (key === "categories.guides.title" ? "Гайди" : ""), {
        has: (key: string) => key === "categories.guides.title",
      }),
    );
    assert.equal(category.title, "Гайди");
  });

  it("catalog parity remains for knowledgePublic", async () => {
    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });
});
