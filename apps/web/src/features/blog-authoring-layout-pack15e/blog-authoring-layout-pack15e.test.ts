/**
 * Pack 15E — Blog authoring & layout final certification (contract-only).
 * Certifies Packs 15A–15D end-to-end wiring without adding features.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_PUBLICATION_DATE_MIN } from "@hu/types";

import { BLOG_PAGE_SIZE } from "../blog/api.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 15E — Blog authoring & layout final certification", () => {
  it("1–2 cover upload → preview; replace/remove/persist (15A)", () => {
    const field = readWeb("features/blog/components/BlogCoverField.tsx");
    const image = readWeb("features/blog/components/BlogCoverImage.tsx");
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    const css = readWeb("features/blog/publishing.css");

    assert.match(field, /await uploadBlogImage/);
    assert.match(field, /onChange\(\{[\s\S]*mediaUrl: uploaded\.mediaUrl/s);
    assert.match(field, /onChange\(null\)/);
    assert.match(field, /blog-cover-field__preview/);
    assert.match(image, /failedSrc/);
    assert.match(editor, /coverMedia=\{coverMedia\}/);
    assert.match(editor, /setCoverMedia\(saved\.coverMedia/);
    assert.match(css, /\.blog-cover-field__preview[\s\S]*aspect-ratio:\s*16\s*\/\s*9/s);
    assert.match(css, /\.blog-cover-field__image[\s\S]*object-fit:\s*cover/s);
  });

  it("3–6 CKEditor formatting, inline image, alt/caption, toolbar at editor top (15B/18A)", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    const adapter = readWeb("features/blog/ckeditor-upload-adapter.ts");
    const css = readWeb("features/blog/publishing.css");
    const sanitize = readRepo("apps/api/src/modules/blog/blog-content-sanitize.ts");

    assert.match(rich, /ClassicEditor/);
    assert.match(rich, /"bold"/);
    assert.match(rich, /"italic"/);
    assert.match(rich, /"link"/);
    assert.match(rich, /"bulletedList"/);
    assert.match(rich, /"numberedList"/);
    assert.match(rich, /"blockQuote"/);
    assert.match(rich, /heading/);
    assert.match(rich, /"uploadImage"/);
    assert.match(rich, /ImageCaption|toggleImageCaption/);
    assert.match(adapter, /uploadBlogImage/);
    assert.doesNotMatch(adapter, /ckeditor\.cloud|CKBox|EasyImage/i);
    // Pack 18A — toolbar stays at top of Article Content frame (not viewport-sticky).
    assert.match(
      css,
      /\.blog-rich-text--ckeditor\s+\.ck\.ck-editor__top\s*\{[^}]*position:\s*static/s,
    );
    assert.doesNotMatch(css, /\.ck\.ck-editor__top[\s\S]{0,240}--hu-scroll-margin-top/s);
    assert.match(sanitize, /"figure"/);
    assert.match(sanitize, /"figcaption"/);
  });

  it("7–8 authoring canvas dominant + settings sidebar (15B)", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    const css = readWeb("features/blog/publishing.css");
    assert.match(editor, /blog-post-editor--pack15b/);
    assert.match(editor, /blog-settings-media|Publication/);
    assert.match(editor, /Category|categoryId/);
    assert.match(editor, /Tags|tags/);
    assert.match(editor, /publicationDate/);
    assert.match(editor, /Excerpt|excerpt/);
    assert.match(editor, /BlogCoverField/);
    assert.match(css, /minmax\(0,\s*2\.6fr\)/);
  });

  it("8b date/scheduling: min 2022, noon UTC, future→scheduled (13C)", () => {
    assert.equal(BLOG_PUBLICATION_DATE_MIN, "2022-01-01");
    const dates = readRepo("apps/api/src/modules/blog/blog-publication-date.ts");
    assert.match(dates, /T12:00:00\.000Z/);
    assert.match(dates, /BLOG_PUBLICATION_DATE_MIN/);
    assert.match(dates, /isPublicationDue/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /BLOG_PUBLICATION_DATE_MIN/);
    assert.match(editor, /publicationDate < BLOG_PUBLICATION_DATE_MIN/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /targetStatus[\s\S]*scheduled/);
    assert.match(service, /isPublicationDue/);
  });

  it("9 save/submit actions + Admin notify + review 30/40/30 (14B/15D)", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Save Draft|Saving…|Saved|Save failed/);
    assert.match(editor, /Submit for Review/);
    assert.match(editor, /submitBlogPostForReview|submitForReview/);

    const notify = readRepo("apps/api/src/modules/blog/blog-publication-notifications.ts");
    assert.match(notify, /blog_publication_review_requested/);
    assert.match(notify, /blogPublicationReviewNotificationEntityId/);
    assert.match(notify, /blog_post_changes_requested/);
    assert.match(notify, /blog_post_published/);
    assert.match(notify, /blog_post_declined/);

    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /BlogArticleBody/);
    assert.doesNotMatch(review, /dangerouslySetInnerHTML/);
    assert.match(review, /editorial-review--pack15d/);
    assert.match(review, /editorial-review__context/);
    assert.match(review, /editorial-review__preview/);
    assert.match(review, /editorial-review__tools/);
    assert.match(review, /Approve & Publish|Approve & Schedule/);
    assert.match(review, /Request Changes/);
    assert.match(review, /Decline/);
    assert.match(review, /will not\s+publish early|Approve & Schedule/);
    assert.match(review, /detail\.publishedAt \?\? preview\.publishedAt/);

    const editorialCss = readWeb("features/blog/editorial.css");
    assert.match(editorialCss, /minmax\(0,\s*3fr\)\s+minmax\(0,\s*4fr\)\s+minmax\(0,\s*3fr\)/);
    assert.match(editorialCss, /"context preview tools"/);
    assert.match(editorialCss, /top:\s*var\(--hu-scroll-margin-top/);
  });

  it("12–17 /blog 25/50/25, Search span, thumbs, pagination, widgets (15C/16E)", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /minmax\(0,\s*1fr\)\s+minmax\(0,\s*2fr\)\s+minmax\(0,\s*1fr\)/);
    assert.match(css, /"left search search"/);
    assert.match(css, /"left center right"/);
    assert.match(css, /\.blog-latest-mini__thumb-frame[\s\S]*width:\s*5rem/s);
    assert.match(css, /\.blog-latest-mini__thumb[\s\S]*object-fit:\s*cover/s);
    assert.match(css, /flex:\s*none/);

    assert.equal(BLOG_PAGE_SIZE, 9);

    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogDiscoverySearch/);
    assert.match(index, /BlogDiscoveryLeftRail/);
    assert.match(index, /BlogDiscoveryRightRail/);
    assert.match(index, /BlogPagination/);

    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    assert.doesNotMatch(right, /blog-layout__search/);
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);
  });

  it("18–20 widgets + independent desktop scroll; tablet/mobile normal flow (15C)", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-layout__center[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /\.blog-layout__right[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /--hu-scroll-margin-top/);
    assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1099px\)/);
    assert.match(css, /@media \(max-width: 768px\)|"search"\s*"categories"/s);
    assert.match(css, /display:\s*contents/);
  });

  it("21–22 single post + BlogArticleBody; sanitizer rejects script/handlers (15B)", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogArticleBody/);
    assert.match(article, /html=\{post\.content\}/);
    assert.match(article, /BlogDiscoverySearch/);
    assert.match(article, /blog-page--pack15c/);

    const body = readWeb("features/blog/components/BlogArticleBody.tsx");
    assert.match(body, /dangerouslySetInnerHTML/);
    assert.match(body, /Server-sanitized Blog HTML/);

    const sanitize = readRepo("apps/api/src/modules/blog/blog-content-sanitize.ts");
    assert.match(sanitize, /<script\b/i);
    assert.match(sanitize, /javascript:/);
    assert.match(sanitize, /on[a-z]+/i);
    assert.doesNotMatch(sanitize, /"iframe"/);
    assert.doesNotMatch(sanitize, /"script"/);
  });

  it("23–24 blocked/scheduled + public list filters + notifications (13B/14B)", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /status:\s*"scheduled"/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /listPublishedBlogPosts\(\{\s*limit:\s*4/);
    assert.match(service, /authorAdministrativelyBlocked/);

    const admin = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(admin, /Pending Review/);
    assert.match(admin, /Review publication/);
    assert.match(admin, /Block/);

    const notifications = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(notifications, /blog_publication_review_requested/);
  });

  it("25 Blog Views aggregate-only; overflow contracts (11/15C/15D)", () => {
    const views = readWeb("features/blog/components/BlogViewsWidget.tsx");
    assert.match(views, /views:\s*number/);
    assert.match(views, /all-time Blog page views|Aggregate only/);
    assert.doesNotMatch(views, /sessionId|referrer|ipAddress|userAgent/);
    assert.doesNotMatch(views, /props\.(visitor|session|referrer)/i);

    const blogCss = readWeb("features/blog/blog.css");
    assert.match(blogCss, /overflow-x:\s*clip/);
    assert.match(blogCss, /min-width:\s*0/);

    const editorialCss = readWeb("features/blog/editorial.css");
    assert.match(editorialCss, /min-width:\s*0/);
    assert.match(editorialCss, /overflow-x:\s*hidden/);
    assert.match(editorialCss, /"context"\s*"preview"\s*"tools"/s);
  });
});
