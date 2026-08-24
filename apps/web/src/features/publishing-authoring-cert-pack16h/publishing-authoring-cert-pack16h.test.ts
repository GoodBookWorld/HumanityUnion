/**
 * Pack 16H — Final Publishing & Authoring certification contracts.
 * Certification-only: documents certified rules; no new product features.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const repoRoot = path.resolve(dir, "../../../../../");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 16H — Final Publishing & Authoring certification", () => {
  it("Published Edit/Correct: standard Authors correct via startPublishedCorrection; capability tiers in-place", () => {
    const item = readWeb("features/blog/components/PublicationListItem.tsx");
    assert.match(item, /startPublishedCorrection/);
    assert.match(item, /canDirectPublish/);
    assert.match(item, /Edit \/ Correct/);
    assert.match(item, /archiveBlogPost/);

    const publishing = readWeb("features/blog/components/PublishingPageContent.tsx");
    // Trusted Publishing must not drive published Edit routing.
    assert.match(
      publishing,
      /Trusted Publishing bypasses manual review on submit\/publish only/,
    );
    assert.doesNotMatch(
      publishing,
      /canDirectPublish[\s\S]*publishWithoutManualReview === true/,
    );
  });

  it("Correction rule: Trusted Publishing alone does not grant in-place published edit", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /startPublishedCorrection/);
    assert.match(service, /Only Trusted Authors, Editors, or Administrators may update published/);
    assert.match(service, /resolvePublishWithoutManualReview/);

    const editorPage = readWeb("features/blog/components/BlogEditorPageContent.tsx");
    assert.match(editorPage, /canBypassManualReviewOnDraft/);
    assert.match(editorPage, /canInPlacePublish/);
  });

  it("Authoring chrome + CK toolbar + 25/50/25 blog grid remain wired", () => {
    const publishingCss = readWeb("features/blog/publishing.css");
    assert.match(publishingCss, /blog-post-editor__chrome/);
    // Pack 17B superseded Pack 16B sticky chrome with document-flow chrome.
    assert.match(publishingCss, /Pack 17B/);
    assert.match(publishingCss, /position:\s*static/);
    assert.match(publishingCss, /ck-toolbar/);

    const blogCss = readWeb("features/blog/blog.css");
    assert.match(blogCss, /1fr\) minmax\(0, 2fr\) minmax\(0, 1fr\)/);
    assert.match(blogCss, /"left search search"/);
    assert.match(blogCss, /"left center right"/);
  });

  it("SEO/social + Assistant + categories + Trusted Publishing surfaces remain present", () => {
    assert.match(
      readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx"),
      /seoTitle|metaDescription|socialTitle/,
    );
    assert.match(
      readWeb("features/blog/components/BlogAuthoringAssistantPanel.tsx"),
      /Apply|Replace|Dismiss/,
    );
    assert.match(
      readWeb("features/administration/components/AdminBlogCategoriesPanel.tsx"),
      /reassignToCategoryId|Activate|Deactivate/,
    );
    assert.match(
      readWeb("features/administration/components/AdminPublishingSection.tsx"),
      /Publish without manual review/,
    );
    assert.match(
      readWeb("features/blog/components/BlogCategoriesSidebar.tsx"),
      /<select|All Categories/,
    );
  });
});
