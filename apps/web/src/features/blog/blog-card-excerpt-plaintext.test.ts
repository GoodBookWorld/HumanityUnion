import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { blogHtmlToPlainText } from "../../../../api/src/modules/blog/blog-content-sanitize.js";

const cardSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "components/BlogPostCard.tsx"),
  "utf8",
);

describe("Blog card excerpt plain text", () => {
  it("renders card excerpts through the Blog plain-text utility", () => {
    assert.match(cardSource, /blogHtmlToPlainText\(excerptSource\)/);
    assert.match(cardSource, /truncateWordsForDisplay\(plainExcerpt, 10\)/);
    assert.doesNotMatch(cardSource, /excerptForDisplay[\s\S]*dangerouslySetInnerHTML/);

    assert.equal(blogHtmlToPlainText("<p>Hello&nbsp;there</p>"), "Hello there");
    assert.equal(blogHtmlToPlainText("<strong>Keep</strong> text"), "Keep text");
    assert.equal(blogHtmlToPlainText("A &amp; B &lt;tag&gt;"), "A & B <tag>");
    assert.equal(blogHtmlToPlainText("  already plain  "), "already plain");
  });
});
