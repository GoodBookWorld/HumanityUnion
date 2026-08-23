import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blogHtmlToPlainText,
  sanitizeBlogHtml,
} from "../../../src/modules/blog/blog-content-sanitize.js";

describe("Blog content sanitize (Pack 02)", () => {
  it("keeps allowed TipTap-compatible tags", () => {
    const html = sanitizeBlogHtml(
      "<h2>Title</h2><p>Hello <strong>world</strong></p><ul><li>One</li></ul><hr /><blockquote>Q</blockquote>",
    );
    assert.match(html, /<h2>/);
    assert.match(html, /<strong>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<blockquote>/);
  });

  it("strips script tags and event handlers", () => {
    const html = sanitizeBlogHtml(
      '<p onclick="alert(1)">Safe</p><script>alert(1)</script><p>After</p>',
    );
    assert.doesNotMatch(html, /script/i);
    assert.doesNotMatch(html, /onclick/i);
    assert.match(html, /Safe/);
  });

  it("rejects javascript: links", () => {
    const html = sanitizeBlogHtml('<a href="javascript:alert(1)">x</a><p>ok</p>');
    assert.doesNotMatch(html, /javascript:/i);
    assert.match(html, /ok/);
  });

  it("allows platform media image src", () => {
    const html = sanitizeBlogHtml(
      '<p>img</p><img src="/api/v1/media/files/blog/x.webp" alt="cover" />',
    );
    assert.match(html, /\/api\/v1\/media\/files\/blog\/x\.webp/);
  });

  it("keeps underline and safe text-align; strips unsafe style", () => {
    const html = sanitizeBlogHtml(
      '<p style="text-align: center"><u>Centered</u></p><p style="color:red">No color</p>',
    );
    assert.match(html, /<u>Centered<\/u>/);
    assert.match(html, /text-align:\s*center/);
    assert.doesNotMatch(html, /color:red/);
  });

  it("extracts plain text for Safety", () => {
    assert.equal(blogHtmlToPlainText("<p>Hello <em>there</em></p>"), "Hello there");
  });
});
