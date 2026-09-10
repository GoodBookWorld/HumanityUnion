/**
 * Reset 01 — public_news title/summary are PLP MACHINE (replaces Closure 02
 * original-language-only web suite).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
} from "@hu/types";

import {
  evaluateMediaCarouselSemanticClosure,
} from "./media-carousel-semantic-closure.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Reset 01 — web public_news PLP carousel prose", () => {
  it("policy: title/summary MACHINE; identity/URL protected", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.sourceName, "PROTECTED_SOURCE_VALUE");
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], ["title", "summary"]);
  });

  it("hook applies PLP whole-entity; no provider-on-read", () => {
    const hook = readFileSync(
      path.join(here, "../../public-news/use-localized-public-news-card.ts"),
      "utf8",
    );
    assert.match(hook, /resolvePublicNewsCardFieldsFromPlp/);
    assert.doesNotMatch(hook, /TranslationProvider/);
    assert.doesNotMatch(hook, /generateContentTranslation/);
    assert.doesNotMatch(hook, /original-language-only/);
  });

  it("carousel closure counts PLP_ENTITY public_news leaves", () => {
    const cards = Array.from({ length: 12 }, (_, i) => {
      const id = `news-${i + 1}`;
      return `
<article class="public-news-card">
  <span data-hu-semantic-node="1" data-hu-semantic-owner="PLP_ENTITY" data-hu-semantic-result="PUBLISHED_LOCALIZED" data-hu-plp-entity="public_news" data-hu-plp-id="${id}" data-hu-semantic-path="title">Localized title ${i}</span>
  <span data-hu-semantic-node="1" data-hu-semantic-owner="PLP_ENTITY" data-hu-semantic-result="PUBLISHED_LOCALIZED" data-hu-plp-entity="public_news" data-hu-plp-id="${id}" data-hu-semantic-path="summary">Localized summary ${i}</span>
</article>`;
    }).join("\n");
    const report = evaluateMediaCarouselSemanticClosure({
      html: `<main>${cards}</main>`,
      locale: "uk",
    });
    assert.equal(report.PUBLIC_NEWS_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_LOCALIZED_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_FALLBACK_CARD_COUNT, 0);
    assert.equal(report.PUBLIC_NEWS_OMITTED_CARD_COUNT, 0);
  });
});
