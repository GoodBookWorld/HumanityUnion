/**
 * Pack 16C — Publication Optimization UI + public metadata wiring (Web).
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

describe("Pack 16C — publication SEO and social distribution (web)", () => {
  it("editor places Publication Optimization below Article Content", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /BlogPublicationOptimizationPanel/);
    assert.match(editor, /Article Content/);
    const articleIdx = editor.indexOf("Article Content");
    const panelJsxIdx = editor.indexOf("<BlogPublicationOptimizationPanel");
    assert.ok(articleIdx >= 0 && panelJsxIdx > articleIdx);
    assert.match(editor, /optimization/);
    assert.doesNotMatch(editor, /SEO title\/description controls are deferred/);
  });

  it("optimization panel covers SEO, social preview, and honest distribution", () => {
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /Search Optimization/);
    assert.match(panel, /SEO title/);
    assert.match(panel, /Meta description/);
    assert.match(panel, /canonical URL preview|Slug \/ canonical/);
    assert.match(panel, /Search result preview/);
    assert.match(panel, /Social Preview/);
    assert.match(panel, /Social title/);
    assert.match(panel, /Social description/);
    assert.match(panel, /Social image/);
    assert.match(panel, /Social share preview card/);
    assert.match(panel, /Humanity Union social distribution/);
    assert.match(panel, /Choose the Humanity Union social channels/);
    assert.match(panel, /PLATFORM_SOCIAL_NETWORKS/);
    assert.match(panel, /setChannelPermitted/);
    assert.match(panel, /claim a successful send|does not auto-post/i);
    assert.doesNotMatch(panel, /Author connected social accounts/);
    assert.doesNotMatch(panel, /access_token|oauth_secret|posted to Facebook successfully/i);
  });

  it("public single-post metadata uses post.seo projection", () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    assert.match(page, /post\.seo/);
    assert.match(page, /openGraph/);
    assert.match(page, /twitter/);
    assert.match(page, /canonical/);
    assert.match(page, /socialTitle|seo\?\.socialTitle/);
  });

  it("write payload includes optimization on the canonical post", () => {
    const api = readWeb("features/blog/publishing-api.ts");
    assert.match(api, /optimization\?: BlogPublicationOptimization/);
  });
});
