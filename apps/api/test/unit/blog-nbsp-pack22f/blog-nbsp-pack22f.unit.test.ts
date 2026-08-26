import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blogHtmlToPlainText,
  normalizeBlogNbspArtifacts,
  sanitizeBlogHtml,
} from "../../../src/modules/blog/blog-content-sanitize.js";
import { validateAndSanitizeBlogContent } from "../../../src/modules/blog/blog.validators.js";

describe("Pack 22F — Blog content NBSP normalization", () => {
  it("converts literal &nbsp; between words to regular spaces", () => {
    const html = sanitizeBlogHtml("<p>Hello&nbsp;world</p>");
    assert.equal(html, "<p>Hello world</p>");
    assert.doesNotMatch(html, /&nbsp;/i);
    assert.doesNotMatch(html, /&amp;nbsp;/i);
  });

  it("removes double-encoded &amp;nbsp; artifacts from prior bad saves", () => {
    const html = sanitizeBlogHtml("<p>Hello&amp;nbsp;world</p>");
    assert.equal(html, "<p>Hello world</p>");
    assert.doesNotMatch(html, /nbsp/i);
  });

  it("converts Unicode NBSP (\\u00A0) between words to regular spaces", () => {
    const html = sanitizeBlogHtml("<p>Hello\u00A0world</p>");
    assert.equal(html, "<p>Hello world</p>");
    assert.doesNotMatch(html, /\u00A0/);
  });

  it("converts numeric NBSP entities (&#160; / &#xA0;)", () => {
    assert.equal(sanitizeBlogHtml("<p>A&#160;B</p>"), "<p>A B</p>");
    assert.equal(sanitizeBlogHtml("<p>A&#xA0;B</p>"), "<p>A B</p>");
  });

  it("collapses NBSP-only blank paragraphs into empty paragraphs", () => {
    const html = sanitizeBlogHtml("<p>Before</p><p>&nbsp;</p><p>After</p>");
    assert.equal(html, "<p>Before</p><p></p><p>After</p>");
    assert.doesNotMatch(html, /nbsp/i);
  });

  it("preserves ordinary paragraph spaces and structure", () => {
    const html = sanitizeBlogHtml("<p>Hello world</p><p>Second paragraph</p>");
    assert.equal(html, "<p>Hello world</p><p>Second paragraph</p>");
  });

  it("preserves image / caption HTML while normalizing NBSP in caption text", () => {
    const html = sanitizeBlogHtml(
      '<figure class="image"><img src="/api/v1/media/files/blog/x.webp" alt="cover" /><figcaption>A&nbsp;caption</figcaption></figure>',
    );
    assert.match(html, /<figure class="image">/);
    assert.match(html, /\/api\/v1\/media\/files\/blog\/x\.webp/);
    assert.match(html, /<figcaption>A caption<\/figcaption>/);
    assert.doesNotMatch(html, /nbsp/i);
  });

  it("save → reload (re-sanitize) does not restore visible NBSP artifacts", () => {
    const fromEditor = "<p>Line&nbsp;one</p><p>&nbsp;</p><p>Line two</p>";
    const saved = sanitizeBlogHtml(fromEditor);
    const reloaded = sanitizeBlogHtml(saved);
    assert.equal(reloaded, saved);
    assert.doesNotMatch(saved, /&nbsp;|&amp;nbsp;/i);
    assert.doesNotMatch(reloaded, /&nbsp;|&amp;nbsp;/i);
  });

  it("public render payload contains no literal &nbsp; after validator path", () => {
    const content = validateAndSanitizeBlogContent(
      "<p>Published&nbsp;post</p><p>&amp;nbsp;</p>",
      true,
    );
    assert.doesNotMatch(content, /&nbsp;/i);
    assert.doesNotMatch(content, /&amp;nbsp;/i);
    assert.match(content, /Published post/);
  });

  it("normalizeBlogNbspArtifacts is idempotent on cleaned HTML", () => {
    const once = normalizeBlogNbspArtifacts("<p>Hello&nbsp;world</p>");
    const twice = normalizeBlogNbspArtifacts(once);
    assert.equal(once, "<p>Hello world</p>");
    assert.equal(twice, once);
  });

  it("plain-text extraction treats NBSP as ordinary space", () => {
    assert.equal(blogHtmlToPlainText("<p>Hello&nbsp;there</p>"), "Hello there");
    assert.equal(blogHtmlToPlainText("<p>Hello\u00A0there</p>"), "Hello there");
  });
});
