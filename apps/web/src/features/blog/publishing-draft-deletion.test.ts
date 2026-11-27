/**
 * HU-UX-01C — Drafts tab delete placement, confirmation, and catalog parity.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webSrc, "../../..");
const LOCALES = ["en", "uk", "de", "fr", "es", "pt", "ar", "he", "ka", "zh-Hant"] as const;
const KEYS = [
  "draftDeleteTitle",
  "draftDeleteBody",
  "draftDeleteConfirm",
  "draftDeletedTitle",
  "draftDeleted",
] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("HU-UX-01C publishing draft deletion", () => {
  const item = read("features/blog/components/PublicationListItem.tsx");
  const dashboard = read("features/blog/components/PublishingDashboard.tsx");
  const css = read("features/blog/publishing.css");
  const api = read("features/blog/publishing-api.ts");

  it("shows Delete only for a never-published draft and keeps published Delete on archive", () => {
    assert.match(item, /post\.status === "draft" && post\.publishedVersion === 0/);
    assert.match(item, /discardUnpublishedBlogDraft\(post\.postId, post\.updatedAt\)/);
    assert.match(item, /draftDeleteTitle/);
    assert.match(item, /draftDeleteBody/);
    assert.match(item, /draftDeleteConfirm/);
    assert.match(item, /onCancel=\{\(\) => setDraftDeleteOpen\(false\)\}/);
    assert.match(item, /disabled=\{busy === "delete"\}/);
    assert.match(item, /actions\.edit/);
    assert.match(item, /actions\.preview/);
    const published = item.slice(item.indexOf("{publishedManageable ? ("), item.indexOf("{post.status === \"draft\""));
    assert.match(published, /setDeleteOpen\(true\)/);
    assert.match(item, /archiveBlogPost\(post\.postId\)/);
    assert.match(item, /title=\{t\("deleteTitle"\)\}/);
    assert.match(item, /description=\{t\("deleteBody"\)\}/);
    assert.doesNotMatch(item, /draftDeleteBody[\s\S]*deleteBody/);
    assert.match(api, /\/discard-draft/);
    assert.match(api, /\/archive/);
  });

  it("places failure under the action group and success on the drafts list", () => {
    const actionsEnd = item.indexOf('className="publication-list-item__actions hu-form-actions"');
    const feedbackAt = item.indexOf("publication-list-item__action-feedback");
    assert.ok(feedbackAt > actionsEnd);
    assert.match(item, /role="alert"/);
    assert.match(item, /setDraftActionError\(formatAuthFormError\(error\)\)/);
    assert.match(dashboard, /onDraftDiscarded=\{\(\) => setDraftDeletedMessage\(t\("draftDeleted"\)\)\}/);
    assert.match(dashboard, /onMutated=\{\(\) => void load\(tab\)\}/);
    assert.match(dashboard, /draftDeletedTitle/);
    assert.match(dashboard, /AuthFeedbackMessage/);
    assert.match(dashboard, /revealContextualFeedback\(draftDeletedRef\.current\)/);
    assert.match(dashboard, /\}, \[draftDeletedMessage\]\)/);
    assert.match(dashboard, /setDraftDeletedMessage\(null\)/);
    assert.doesNotMatch(dashboard, /setError\(t\("draftDeleted"\)\)/);
  });

  it("keeps feedback in normal flow for narrow screens and both directions", () => {
    const feedbackRule = css.slice(css.indexOf(".publication-list-item__action-feedback"), css.indexOf("}", css.indexOf(".publication-list-item__action-feedback")));
    assert.match(feedbackRule, /margin-block-start: 0\.75rem;/);
    assert.doesNotMatch(feedbackRule, /margin-left|margin-right/);
    assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*\.publication-list-item \{[\s\S]*grid-template-columns: 1fr;/);
    const layout = read("app/layout.tsx");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
  });

  it("adds the same new keys to every WEB and API catalog without changing archive copy", () => {
    for (const locale of LOCALES) {
      const web = JSON.parse(read(`features/i18n/messages/${locale}.json`)) as {
        workspace: { publishingPage: Record<string, string> };
      };
      const apiCatalog = JSON.parse(
        readFileSync(
          path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
          "utf8",
        ),
      ) as { workspace: { publishingPage: Record<string, string> } };
      const webPage = web.workspace.publishingPage;
      const apiPage = apiCatalog.workspace.publishingPage;
      for (const key of KEYS) {
        assert.equal(typeof webPage[key], "string", `${locale}.${key}`);
        assert.ok(webPage[key]!.length > 0);
        assert.equal(webPage[key], apiPage[key], `${locale}.${key} parity`);
      }
      assert.notEqual(webPage.draftDeleteBody, webPage.deleteBody);
      assert.ok((webPage.deleteBody ?? "").length > 0);
      if (locale === "en") {
        assert.match(webPage.deleteBody ?? "", /archived/);
        assert.match(webPage.draftDeleteBody ?? "", /unpublished draft/);
      }
      assert.doesNotMatch(webPage.draftDeleteBody ?? "", /\{[a-zA-Z]+\}/);
    }
  });
});
