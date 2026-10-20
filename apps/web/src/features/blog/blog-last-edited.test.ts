import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_LAST_EDITED_AFTER_MS, shouldShowBlogLastEdited } from "./blog-last-edited.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Blog public last-edited date", () => {
  it("shows the localized edit date beside the article and not inside its HTML", () => {
    const publishedAt = "2024-06-01T12:00:00.000Z";
    const editedAt = "2026-10-20T01:40:00.000Z";
    assert.equal(shouldShowBlogLastEdited(publishedAt, editedAt), true);
    assert.equal(
      shouldShowBlogLastEdited(publishedAt, new Date(Date.parse(publishedAt) + BLOG_LAST_EDITED_AFTER_MS).toISOString()),
      false,
    );
    assert.equal(shouldShowBlogLastEdited(publishedAt, undefined), false);

    const page = readFileSync(path.join(here, "components/BlogArticlePageContent.tsx"), "utf8");
    const body = readFileSync(path.join(here, "components/BlogArticleBody.tsx"), "utf8");
    assert.match(page, /shouldShowBlogLastEdited\(post\.publishedAt, post\.updatedAt\)/);
    assert.match(page, /t\("updated", \{ date: formatBlogPublishedDate\(post\.updatedAt, locale\) \}\)/);
    assert.match(page, /<BlogArticleBody html=\{bodyHtml\} \/>/);
    assert.doesNotMatch(body, /t\("updated"/);
    assert.doesNotMatch(body, /last edited/i);
  });
});
