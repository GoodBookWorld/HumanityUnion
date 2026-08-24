/**
 * Pack 16B / 17B — Publishing editor sticky / scroll architecture.
 * Pack 17B: chrome is no longer sticky; CK toolbar sticks under platform header;
 * desktop writing viewport scrolls internally.
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

describe("Pack 16B/17B — Publishing editor sticky & scroll architecture", () => {
  it("chrome participates in normal flow (not sticky); toolbar under platform header", () => {
    const css = readWeb("features/blog/publishing.css");
    const chromeBlock = css.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock, "chrome rule present");
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.doesNotMatch(chromeBlock[0], /position:\s*sticky/);

    assert.match(
      css,
      /\.ck\.ck-editor__top[\s\S]*top:\s*var\(--hu-scroll-margin-top/s,
    );
    assert.match(
      css,
      /\.ck\.ck-editor__top[\s\S]*z-index:\s*var\(--hu-z-sticky/s,
    );
  });

  it("aside sticky clears platform header without chrome band magic", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(
      css,
      /\.blog-post-editor__aside[\s\S]*top:\s*var\(--hu-scroll-margin-top/s,
    );
    assert.doesNotMatch(css, /\+ 3\.25rem/);
  });

  it("desktop CK main is a bounded internal scroll viewport; mobile prefers page flow", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /\.ck\.ck-editor__main[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /overscroll-behavior:\s*auto/);
    assert.match(css, /max-height:\s*min\(70vh,\s*42rem\)/);

    const mobile = css.slice(css.indexOf("@media (max-width: 768px)"));
    assert.match(mobile, /\.ck\.ck-editor__main[\s\S]*overflow:\s*visible/s);
    assert.match(
      mobile,
      /\.ck\.ck-editor__top[\s\S]*top:\s*var\(--hu-scroll-margin-top/s,
    );
  });

  it("new + edit publishing routes still mount BlogPostEditor", () => {
    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    const editPage = readWeb("app/workspace/publishing/[postId]/page.tsx");
    assert.match(newPage, /BlogEditorPageContent|BlogPostEditor/);
    assert.match(editPage, /BlogEditorPageContent|BlogPostEditor/);
    assert.match(newPage, /HumanityUnionAssistantWidget/);
    assert.match(editPage, /HumanityUnionAssistantWidget/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /blog-post-editor__chrome/);
    assert.match(editor, /blog-post-editor--pack15b/);
  });
});
