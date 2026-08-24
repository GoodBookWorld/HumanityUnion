/**
 * Pack 16G — Admin Authors Trusted Publishing UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 16G — Trusted Publishing UI", () => {
  it("Authors table has Status distinct from Trusted publishing checkbox", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /Trusted publishing/);
    assert.match(section, /Publish without manual review/);
    assert.match(section, /publishWithoutManualReview/);
    assert.match(section, /handleTrustedPublishingToggle/);
    assert.match(section, /Blocked/);
    assert.match(section, /Active/);
    assert.match(section, /admin-publishing-table__status--blocked/);
  });

  it("Admin API client patches trusted-publishing; Author UI cannot toggle the setting", () => {
    const api = readWeb("features/administration/admin-publishing-api.ts");
    assert.match(api, /trusted-publishing/);
    assert.match(api, /setAdminAuthorTrustedPublishing/);
    assert.match(api, /publishWithoutManualReview/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.doesNotMatch(editor, /setAdminAuthorTrustedPublishing/);
    assert.doesNotMatch(editor, /trusted-publishing/);

    // Pack 16H — Trusted Publishing enables draft Publish UI, not published in-place Edit.
    const editorPage = readWeb("features/blog/components/BlogEditorPageContent.tsx");
    assert.match(editorPage, /publishWithoutManualReview/);
    assert.match(editorPage, /canBypassManualReviewOnDraft/);

    const publishing = readWeb("features/blog/components/PublishingPageContent.tsx");
    assert.doesNotMatch(
      publishing,
      /canDirectPublish[\s\S]*publishWithoutManualReview === true/,
    );
  });
});