/**
 * Pack 08I.5 — Blog HTML content translation stays on content_translations with sanitize boundary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";
import { DeterministicTranslationProvider } from "../../../src/modules/language/providers/deterministic-translation-provider.js";

describe("Pack 08I.5 — Blog HTML translation safety", () => {
  it("deterministic provider preserves tags, hrefs, and classes while translating text", async () => {
    const provider = new DeterministicTranslationProvider();
    const sourceHtml =
      '<p class="lead">Hello <a href="https://example.com/path" data-id="x1">world</a></p>';
    const result = await provider.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: JSON.stringify({
        title: "Civic title",
        excerpt: "Short excerpt",
        content: sourceHtml,
      }),
      contentType: "structured_json",
      safetyCleared: true,
    });

    const fields = JSON.parse(result.translatedText) as Record<string, string>;
    assert.match(fields.title, /^\[uk\]/);
    assert.match(fields.content, /href="https:\/\/example\.com\/path"/);
    assert.match(fields.content, /class="lead"/);
    assert.match(fields.content, /data-id="x1"/);
    assert.match(fields.content, /\[uk\]/);
    assert.doesNotMatch(fields.content, /<script/i);

    const sanitized = sanitizeBlogHtml(fields.content);
    assert.match(sanitized, /href="https:\/\/example\.com\/path"/);
    assert.doesNotMatch(sanitized, /onerror=/i);
    assert.doesNotMatch(sanitized, /<script/i);
  });

  it("sanitize strips unsafe markup introduced around translation", () => {
    const dirty =
      '<p>Safe</p><script>alert(1)</script><img src="https://cdn.example/a.png" onerror="alert(1)" />';
    const clean = sanitizeBlogHtml(dirty);
    assert.doesNotMatch(clean, /<script/i);
    assert.doesNotMatch(clean, /onerror/i);
    assert.match(clean, /Safe/);
  });
});
