/**
 * Pack 15B — CKEditor sanitizer + wiring contracts (API).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 15B — CKEditor sanitizer contracts", () => {
  it("preserves CKEditor-safe marks, figure/caption, table; rejects scripts", () => {
    const html = sanitizeBlogHtml(
      [
        "<h2>Heading</h2>",
        '<p style="text-align: center"><strong>Bold</strong> <em>Italic</em> <u>Under</u></p>',
        "<blockquote>Quote</blockquote>",
        '<ul><li>One</li></ul>',
        '<p><a href="https://example.com">Link</a></p>',
        '<figure class="image image-style-align-center" style="width: 80%;">',
        '<img src="https://cdn.example/x.jpg" alt="Inline alt" />',
        "<figcaption>A caption</figcaption>",
        "</figure>",
        "<table><tbody><tr><td>Cell</td></tr></tbody></table>",
        "<hr />",
        '<script>alert(1)</script><iframe src="x"></iframe>',
      ].join(""),
    );

    assert.match(html, /<h2>Heading<\/h2>/);
    assert.match(html, /text-align:\s*center/);
    assert.match(html, /<strong>Bold<\/strong>/);
    assert.match(html, /<u>Under<\/u>/);
    assert.match(html, /<figure/);
    assert.match(html, /figcaption/);
    assert.match(html, /alt="Inline alt"/);
    assert.match(html, /<table>/);
    assert.match(html, /<hr/);
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /iframe/i);
  });

  it("review + publish paths remain Pack 14B authority", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /emitBlogPublicationAdminReviewNotifications/);

    const validators = readRepo("apps/api/src/modules/blog/blog.validators.ts");
    assert.match(validators, /sanitizeBlogHtml/);
  });
});
