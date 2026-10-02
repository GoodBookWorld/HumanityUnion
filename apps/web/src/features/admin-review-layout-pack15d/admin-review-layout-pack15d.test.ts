/**
 * Pack 15D — Admin publication review 30/40/30 workspace contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 15D — Admin publication review 30/40/30", () => {
  it("desktop grid is context 2fr, preview 3fr, and the canonical sidebar track", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /editorial-review--pack15d/);
    assert.match(review, /editorial-review__context/);
    assert.match(review, /editorial-review__preview/);
    assert.match(review, /editorial-review__tools/);

    const page = readWeb("features/blog/components/EditorialReviewWorkspacePage.tsx");
    assert.match(page, /headerBar=/);
    assert.match(page, /editorial-review-header/);
    assert.match(page, /HumanityUnionAssistantWidget/);
    assert.match(page, /surfaceId="blog"/);
    assert.doesNotMatch(page, /assistant=\{/);

    const css = readWeb("features/blog/editorial.css");
    assert.match(
      css,
      /minmax\(0,\s*2fr\)\s+minmax\(0,\s*3fr\)\s+minmax\(0,\s*var\(--hu-initiative-sidebar-width\)\)/,
    );
    assert.match(css, /column-gap:\s*var\(--hu-space-6\)/);
    assert.match(css, /grid-area:\s*context/);
    assert.match(css, /grid-area:\s*preview/);
    assert.match(css, /grid-area:\s*tools/);
    assert.match(css, /"context preview tools"/);
    assert.match(css, /\.editorial-review__preview[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
    assert.match(review, /editorial-review__guidance/);
    assert.match(review, /ResizeObserver/);
    assert.match(review, /getBoundingClientRect\(\)/);
    assert.doesNotMatch(css, /\.editorial-review__tools\s*\{[^}]*overflow-y:\s*auto/);
    assert.doesNotMatch(css, /height:\s*\d+px/);
    assert.doesNotMatch(css, /position:\s*sticky/);
    assert.doesNotMatch(css, /3fr\)\s+minmax\(0,\s*4fr\)/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /min-width:\s*0/);
  });

  it("left context uses existing metadata including dates, lifecycle, block independence", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /authorDisplayName/);
    assert.match(review, /Category/);
    assert.match(review, /Tags/);
    assert.match(review, /Publication date/);
    assert.match(review, /Submission date/);
    assert.match(review, /Pending Review/);
    assert.match(review, /Scheduled/);
    assert.match(review, /Admin block/);
    assert.match(review, /authorAdministrativelyBlocked/);
    assert.match(review, /administrativelyBlocked/);
    assert.match(review, /does not automatically block this\s+publication/);
    assert.match(review, /detail\.publishedAt \?\? preview\.publishedAt/);
    assert.doesNotMatch(review, /publishedAt \?\? preview\.publishedAt \?\? detail\.submittedAt/);
    assert.doesNotMatch(review, /trust score|reputation|author score/i);
  });

  it("center preview renders via BlogArticleBody with stable 16:9 cover", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /BlogArticleBody/);
    assert.match(review, /html=\{preview\.content\}/);
    assert.match(review, /blog-article__cover-image/);
    assert.match(review, /preview\.title/);
    assert.match(review, /preview\.excerpt/);
    assert.doesNotMatch(review, /dangerouslySetInnerHTML/);

    const css = readWeb("features/blog/editorial.css");
    assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(css, /object-fit:\s*cover/);
  });

  it("right moderation keeps canonical actions; sticky below header; schedule hint", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /Approve & Publish|Approve & Schedule/);
    assert.match(review, /Request Changes/);
    assert.match(review, /Decline/);
    assert.match(review, /Publish After Safety Review/);
    assert.match(review, /will not\s+publish early/);
    assert.match(review, /Admin Publishing/);

    const css = readWeb("features/blog/editorial.css");
    assert.match(css, /\.editorial-review__preview[\s\S]*overflow-y:\s*auto/);
    assert.doesNotMatch(css, /\.editorial-review__tools\s*\{[^}]*overflow-y:\s*auto/);
    assert.doesNotMatch(css, /position:\s*sticky/);
    assert.doesNotMatch(css, /100vh/);
  });

  it("notification + schedule authority remain server-side (14B regression)", () => {
    const notify = readRepo("apps/api/src/modules/blog/blog-publication-notifications.ts");
    assert.match(notify, /blog_post_changes_requested/);
    assert.match(notify, /blog_post_published/);
    assert.match(notify, /blog_post_declined/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /targetStatus[\s\S]*scheduled/);
    assert.match(service, /authorAdministrativelyBlocked/);
    assert.match(service, /getEditorialReviewDetail/);
  });

  it("tablet/mobile disable the desktop rail; mobile order context→preview→tools", () => {
    const css = readWeb("features/blog/editorial.css");
    assert.match(css, /@media \(max-width:\s*1024px\)/);
    assert.doesNotMatch(css, /1099px/);
    assert.match(css, /@media \(max-width:\s*768px\)/);
    assert.match(css, /"context preview"\s*"tools tools"/);
    assert.match(css, /"context"\s*"preview"\s*"tools"/s);
    assert.match(css, /position:\s*static/);
    assert.match(css, /@media \(max-width:\s*1024px\)[\s\S]*overflow:\s*visible/);
    assert.match(css, /\.humanity-app--pwa-standalone \.editorial-review__preview[\s\S]*overflow:\s*visible/);
    assert.match(css, /\.humanity-app--pwa-standalone \.editorial-review-header/);
    assert.match(
      css,
      /\.humanity-app--pwa-standalone \.editorial-review[\s\S]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(0,\s*3fr\)/,
    );
  });

  it("authorization messaging unchanged (Editors/Administrators only)", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(
      review,
      /Editorial Review is available to Editors and Administrators only/,
    );
    assert.match(review, /isForbiddenError/);
  });
});
