/**
 * Pack 18A — CKEditor toolbar stays at top of Article Content editor frame.
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

describe("Pack 18A — publishing article editor toolbar", () => {
  it("toolbar is static at top of editor frame; not viewport-sticky with header offset", () => {
    const css = readWeb("features/blog/publishing.css");

    assert.match(
      css,
      /\.blog-rich-text--ckeditor\s+\.ck\.ck-editor__top\s*\{[^}]*position:\s*static/s,
    );
    // Must not reintroduce sticky toolbar + header inset (mid-frame overlay bug).
    assert.doesNotMatch(
      css,
      /\.ck\.ck-editor__top[\s\S]{0,240}position:\s*sticky/s,
    );
    assert.doesNotMatch(
      css,
      /\.ck\.ck-editor__top[\s\S]{0,240}--hu-scroll-margin-top/s,
    );
  });

  it("desktop: main scrolls under fixed-top toolbar; chrome stays non-sticky", () => {
    const css = readWeb("features/blog/publishing.css");

    const chromeBlock = css.match(/\.blog-post-editor__chrome\s*\{[^}]+\}/);
    assert.ok(chromeBlock);
    assert.match(chromeBlock[0], /position:\s*static/);
    assert.doesNotMatch(chromeBlock[0], /position:\s*sticky/);

    assert.match(css, /\.ck\.ck-editor__main[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /overscroll-behavior:\s*auto/);
    assert.match(css, /\.ck\.ck-editor__top[\s\S]*flex:\s*0\s+0\s+auto/s);

    const mobile = css.slice(css.indexOf("@media (max-width: 768px)"));
    assert.match(mobile, /\.ck\.ck-editor__main[\s\S]*overflow:\s*visible/s);
    assert.match(mobile, /\.ck\.ck-editor__top[\s\S]*position:\s*static/s);
  });

  it("create/edit publishing routes still mount the rich editor", () => {
    const newPage = readWeb("app/workspace/publishing/new/page.tsx");
    const editPage = readWeb("app/workspace/publishing/[postId]/page.tsx");
    assert.match(newPage, /BlogEditorPageContent|BlogPostEditor/);
    assert.match(editPage, /BlogEditorPageContent|BlogPostEditor/);

    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Article Content/);
    assert.match(editor, /BlogRichTextEditor/);
  });
});
