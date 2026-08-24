/**
 * Pack 14C — sanitizer + layout contracts (API).
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

describe("Pack 14C — rich editor API contracts", () => {
  it("sanitizer allows underline + safe text-align; rejects scripts/iframes", () => {
    const html = sanitizeBlogHtml(
      '<p style="text-align: right"><u>Safe</u></p><script>x</script><iframe src="x"></iframe>',
    );
    assert.match(html, /<u>Safe<\/u>/);
    assert.match(html, /text-align:\s*right/);
    assert.doesNotMatch(html, /script/i);
    assert.doesNotMatch(html, /iframe/i);

    const sanitize = readRepo("apps/api/src/modules/blog/blog-content-sanitize.ts");
    assert.match(sanitize, /"u"/);
    assert.match(sanitize, /TEXT_ALIGN_STYLE_PATTERN/);
    assert.match(sanitize, /figure|figcaption|table/);
  });

  it("submit-for-review path remains Pack 14B notification source", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /emitBlogPublicationAdminReviewNotifications/);
    assert.match(service, /submitted_for_review/);
  });
});
