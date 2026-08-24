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
  it("desktop grid is explicit 30/40/30 with context | preview | tools", () => {
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(review, /editorial-review--pack15d/);
    assert.match(review, /editorial-review__context/);
    assert.match(review, /editorial-review__preview/);
    assert.match(review, /editorial-review__tools/);

    const css = readWeb("features/blog/editorial.css");
    assert.match(css, /minmax\(0,\s*3fr\)\s+minmax\(0,\s*4fr\)\s+minmax\(0,\s*3fr\)/);
    assert.match(css, /"context preview tools"/);
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
    assert.match(css, /\.editorial-review__tools[\s\S]*position:\s*sticky/s);
    assert.match(css, /top:\s*var\(--hu-scroll-margin-top/);
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

  it("tablet/mobile disable 30/40/30 sticky panes; mobile order context→preview→tools", () => {
    const css = readWeb("features/blog/editorial.css");
    assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1099px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /"context"\s*"preview"\s*"tools"/s);
    assert.match(css, /position:\s*static/);
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
