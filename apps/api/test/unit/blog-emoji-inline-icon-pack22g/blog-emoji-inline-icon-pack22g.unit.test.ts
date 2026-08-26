/**
 * Pack 22G — emoji + inline icon sanitizer / persistence contracts (API).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";

describe("Pack 22G — Blog emoji / inline icon sanitizer", () => {
  it("preserves Unicode emoji through sanitize (single + multiple)", () => {
    const html = sanitizeBlogHtml("<p>Hello 😀 world 🚀</p>");
    assert.match(html, /😀/);
    assert.match(html, /🚀/);
    assert.equal(html, "<p>Hello 😀 world 🚀</p>");
  });

  it("preserves multi-codepoint emoji sequences", () => {
    const html = sanitizeBlogHtml("<p>Flags 🇺🇳 🇺🇸 and tech 🖥️</p>");
    assert.match(html, /🇺🇳/);
    assert.match(html, /🇺🇸/);
    assert.match(html, /🖥️/);
  });

  it("does not allow raw HTML injection disguised as emoji markup", () => {
    const html = sanitizeBlogHtml('<p>safe 😊<script>alert(1)</script><img src=x onerror=alert(1) /></p>');
    assert.match(html, /😊/);
    assert.doesNotMatch(html, /script/i);
    assert.doesNotMatch(html, /onerror/i);
  });

  it("inline icon HTML survives with style + empty decorative alt", () => {
    const html = sanitizeBlogHtml(
      '<p>Go <img class="image_resized image-style-inline" style="width:8%;" src="/api/v1/media/files/blog/icon.webp" alt="" /> next</p>',
    );
    assert.match(html, /image-style-inline/);
    assert.match(html, /image_resized/);
    assert.match(html, /width:\s*8%/);
    assert.match(html, /alt=""/);
    assert.match(html, /\/api\/v1\/media\/files\/blog\/icon\.webp/);
  });

  it("descriptive alt text persists for meaningful icons", () => {
    const html = sanitizeBlogHtml(
      '<p><img class="image-style-inline" style="width:10%;" src="/api/v1/media/files/blog/a.png" alt="Peace dove" /></p>',
    );
    assert.match(html, /alt="Peace dove"/);
  });

  it("GIF inline icon path remains allowed", () => {
    const html = sanitizeBlogHtml(
      '<p><img class="image-style-inline" style="width:6%;" src="/api/v1/media/files/blog/spark.gif" alt="" /></p>',
    );
    assert.match(html, /\.gif/);
    assert.match(html, /image-style-inline/);
  });

  it("block / aligned images remain unchanged", () => {
    const html = sanitizeBlogHtml(
      '<figure class="image image-style-align-center"><img src="/api/v1/media/files/blog/hero.webp" alt="Hero" /><figcaption>Cap</figcaption></figure>',
    );
    assert.match(html, /image-style-align-center/);
    assert.match(html, /<figcaption>Cap<\/figcaption>/);
  });

  it("save → reload does not restore visible NBSP from emoji/icon context", () => {
    const fromEditor =
      "<p>Hello&nbsp;😀</p><p>Icon <img class=\"image-style-inline\" src=\"/api/v1/media/files/blog/i.webp\" alt=\"\" />&nbsp;end</p>";
    const saved = sanitizeBlogHtml(fromEditor);
    const reloaded = sanitizeBlogHtml(saved);
    assert.equal(reloaded, saved);
    assert.doesNotMatch(saved, /&nbsp;|&amp;nbsp;/i);
    assert.match(saved, /😀/);
    assert.match(saved, /image-style-inline/);
  });

  it("public render payload contains emoji Unicode (no entity encoding of emoji)", () => {
    const content = sanitizeBlogHtml("<p>Public ❤️ choice</p>");
    assert.match(content, /❤️|❤/);
    assert.doesNotMatch(content, /&amp;#|&#128/);
  });
});
