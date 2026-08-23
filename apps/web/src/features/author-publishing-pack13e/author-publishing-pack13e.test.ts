/**
 * Pack 13E — Final Author & Publishing certification (Web contracts).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 13E — Author & Publishing certification (Web)", () => {
  it("Author application confirmation + Admin review modal remain wired", () => {
    const page = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(page, /Application received/);
    assert.match(page, /respond as soon as possible/);
    assert.match(page, /Submitting…/);
    assert.match(page, /["']Submitted["']/);
    assert.match(page, /MyPublicationsTable/);
    assert.match(page, /author_blocked/);
    assert.match(page, /contact the administrator/i);

    const modal = readWeb("features/blog/components/AuthorApplicationReviewModal.tsx");
    assert.match(modal, /Invite/);
    assert.match(modal, /Refuse/);

    const center = readWeb("features/notifications/components/NotificationCenterPageContent.tsx");
    assert.match(center, /blog_author_application_review_requested/);
    assert.match(center, /AuthorApplicationReviewModal/);
  });

  it("Admin Publishing Authors/Publications tables remain present", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /Authors/);
    assert.match(section, /Publications/);
    assert.match(section, /Block/);
    assert.match(section, /Unblock/);
    assert.match(section, /scheduled/);
  });

  it("public /blog three-column layout + card metadata + icons", () => {
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /blog-layout__search/);
    assert.match(index, /blog-layout__categories/);
    assert.match(index, /blog-layout__authors/);
    assert.match(index, /blog-layout__center/);
    assert.match(index, /blog-layout__right/);
    assert.match(index, /Latest Publications/);

    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    assert.match(card, /\/icons\/workspace\/date\.png/);
    assert.match(card, /\/icons\/workspace\/comments\.png/);
    assert.match(card, /\/icons\/workspace\/opened-folder\.png/);
    assert.match(card, /No Comments/);
    assert.match(card, /#comments/);
    assert.match(card, /commentCount/);

    for (const name of ["date.png", "comments.png", "opened-folder.png"]) {
      assert.equal(existsSync(path.join(webRoot, "public/icons/workspace", name)), true);
    }
  });

  it("publication date field + My Publications ownership API client", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Publication date/);
    assert.match(editor, /BLOG_PUBLICATION_DATE_MIN/);
    assert.match(editor, /type="date"/);

    const table = readWeb("features/blog/components/MyPublicationsTable.tsx");
    assert.match(table, /listOwnBlogPosts/);
    assert.match(table, /mutationsDisabled/);
    assert.doesNotMatch(table, /Unblock/);

    const api = readWeb("features/blog/api.ts");
    assert.match(api, /\/api\/v1\/public\/blog\/authors/);
    assert.match(api, /timeZone:\s*"UTC"/);
  });
});
